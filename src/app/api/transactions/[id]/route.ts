import { addMonths, format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { allocationsBalance } from "@/lib/transaction-updates";
import { normalizeMerchant } from "@/lib/utils";

const allocationSchema = z.object({ categoryId: z.string().uuid(), amountCents: z.number().int() });
const schema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  allocations: z.array(allocationSchema).min(2).max(20).optional(),
  excluded: z.boolean().optional(), note: z.string().max(1000).optional(),
  alwaysCategorize: z.boolean().default(false), isTransfer: z.boolean().optional(),
  isRecurring: z.boolean().optional(), reviewed: z.boolean().optional(), undo: z.boolean().optional(),
});

type Snapshot = {
  note: string | null; excluded: boolean; isTransfer: boolean; isRecurring: boolean;
  reviewStatus: string; reviewedAt: string | null; reviewedBy: string | null;
  allocations: Array<{ categoryId: string; amountCents: number }>;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  const { id } = await params;
  if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid transaction update." }, { status: 400 });
  const supabase = await createClient();
  const { data: transaction } = await supabase.from("transactions").select("id,merchant,normalized_merchant,amount_cents,note,excluded,is_transfer,is_recurring,review_status,reviewed_at,reviewed_by,transacted_at")
    .eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!transaction) return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  const { data: currentAllocations } = await supabase.from("transaction_allocations").select("category_id,amount_cents").eq("transaction_id", id).eq("household_id", auth.householdId);
  const before: Snapshot = { note: transaction.note as string | null, excluded: Boolean(transaction.excluded), isTransfer: Boolean(transaction.is_transfer), isRecurring: Boolean(transaction.is_recurring), reviewStatus: transaction.review_status as string, reviewedAt: transaction.reviewed_at as string | null, reviewedBy: transaction.reviewed_by as string | null, allocations: (currentAllocations ?? []).map((item) => ({ categoryId: item.category_id as string, amountCents: Number(item.amount_cents) })) };

  if (body.data.undo) {
    const { data: lastEvent } = await supabase.from("audit_events").select("metadata").eq("household_id", auth.householdId).eq("entity_type", "transaction").eq("entity_id", id).neq("action", "undone").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const snapshot = (lastEvent?.metadata as { before?: Snapshot } | null)?.before;
    if (!snapshot) return NextResponse.json({ message: "There is no edit to undo." }, { status: 409 });
    const { error } = await supabase.from("transactions").update({ note: snapshot.note, excluded: snapshot.excluded, is_transfer: snapshot.isTransfer, is_recurring: snapshot.isRecurring, review_status: snapshot.reviewStatus, reviewed_at: snapshot.reviewedAt, reviewed_by: snapshot.reviewedBy, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
    if (error) return NextResponse.json({ message: "The previous edit could not be restored." }, { status: 500 });
    await replaceAllocations(supabase, auth.householdId, id, snapshot.allocations);
    await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: id, action: "undone", metadata: { restored: snapshot } });
    return NextResponse.json({ message: "Last transaction edit undone." });
  }

  let requestedAllocations = body.data.allocations;
  if (requestedAllocations && !allocationsBalance(Number(transaction.amount_cents), requestedAllocations)) return NextResponse.json({ message: "Split amounts must be non-zero and equal the transaction total exactly." }, { status: 400 });
  if (body.data.categoryId !== undefined && !requestedAllocations) {
    let categoryId = body.data.categoryId;
    if (categoryId === null) {
      const { data: unsorted } = await supabase.from("categories").select("id").eq("household_id", auth.householdId).eq("name", "Unsorted").single();
      categoryId = unsorted?.id as string | undefined ?? null;
    }
    requestedAllocations = categoryId ? [{ categoryId, amountCents: Number(transaction.amount_cents) }] : [];
  }
  const categoryIds = [...new Set((requestedAllocations ?? []).map((item) => item.categoryId))];
  if (categoryIds.length) {
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("household_id", auth.householdId).in("id", categoryIds);
    if (count !== categoryIds.length) return NextResponse.json({ message: "One or more split categories are invalid." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  if (body.data.note !== undefined) updates.note = body.data.note;
  if (body.data.excluded !== undefined) updates.excluded = body.data.excluded;
  if (body.data.isTransfer !== undefined) { updates.is_transfer = body.data.isTransfer; if (body.data.isTransfer) updates.excluded = true; }
  if (body.data.isRecurring !== undefined) updates.is_recurring = body.data.isRecurring;
  if (body.data.reviewed !== undefined) { updates.review_status = body.data.reviewed ? "reviewed" : "needs_review"; updates.reviewed_at = body.data.reviewed ? now : null; updates.reviewed_by = body.data.reviewed ? auth.userId : null; }
  const { error: updateError } = await supabase.from("transactions").update(updates).eq("id", id).eq("household_id", auth.householdId);
  if (updateError) return NextResponse.json({ message: "Transaction could not be updated." }, { status: 500 });
  if (requestedAllocations) {
    const allocationError = await replaceAllocations(supabase, auth.householdId, id, requestedAllocations);
    if (allocationError) return NextResponse.json({ message: "Transaction allocations could not be saved." }, { status: 500 });
  }
  if (body.data.alwaysCategorize && body.data.categoryId) {
    await supabase.from("merchant_rules").upsert({ household_id: auth.householdId, merchant_pattern: transaction.merchant, normalized_merchant: normalizeMerchant(transaction.merchant as string), category_id: body.data.categoryId, priority: 1000, active: true, created_by: auth.userId, updated_at: now }, { onConflict: "household_id,normalized_merchant" });
  }
  if (body.data.isRecurring) {
    const amount = Math.abs(Number(transaction.amount_cents));
    const nextDue = addMonths(new Date(transaction.transacted_at as string), 1);
    await supabase.from("recurring_items").upsert({ household_id: auth.householdId, type: Number(transaction.amount_cents) >= 0 ? "income" : "expense", name: transaction.merchant, merchant_pattern: normalizeMerchant(transaction.merchant as string), amount_cents: amount, cadence: "monthly", next_due_date: format(nextDue, "yyyy-MM-dd"), is_confirmed: true, active: true, updated_at: now }, { onConflict: "household_id,type,merchant_pattern" });
  } else if (body.data.isRecurring === false) {
    await supabase.from("recurring_items").update({ active: false, updated_at: now }).eq("household_id", auth.householdId).eq("type", Number(transaction.amount_cents) >= 0 ? "income" : "expense").eq("merchant_pattern", normalizeMerchant(transaction.merchant as string));
  }
  const actions = [body.data.allocations ? "split" : null, body.data.categoryId !== undefined ? "categorized" : null, body.data.excluded !== undefined ? "exclusion_changed" : null, body.data.isTransfer !== undefined ? "transfer_changed" : null, body.data.isRecurring !== undefined ? "recurring_changed" : null, body.data.reviewed !== undefined ? "review_changed" : null, body.data.alwaysCategorize ? "merchant_rule_created" : null].filter(Boolean);
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: id, action: "edited", metadata: { before, actions, categoryId: body.data.categoryId, splitCount: body.data.allocations?.length } });
  return NextResponse.json({ message: body.data.reviewed ? "Transaction reviewed." : "Transaction updated." });
}

async function replaceAllocations(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, transactionId: string, allocations: Array<{ categoryId: string; amountCents: number }>) {
  const { error: deleteError } = await supabase.from("transaction_allocations").delete().eq("transaction_id", transactionId).eq("household_id", householdId);
  if (deleteError) return deleteError;
  if (!allocations.length) return null;
  const { error } = await supabase.from("transaction_allocations").insert(allocations.map((allocation) => ({ household_id: householdId, transaction_id: transactionId, category_id: allocation.categoryId, amount_cents: allocation.amountCents, source: "manual" })));
  return error;
}
