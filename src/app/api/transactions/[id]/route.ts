import { addMonths, format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { allocationsBalance } from "@/lib/transaction-updates";
import { allocationAggregateDeltas } from "@/lib/remembered-rules";
import { normalizeMerchant } from "@/lib/utils";

const allocationSchema = z.object({ categoryId: z.string().uuid(), amountCents: z.number().int() });
const schema = z.object({
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  allocations: z.array(allocationSchema).min(2).max(20).optional(),
  excluded: z.boolean().optional(), note: z.string().max(1000).optional(),
  alwaysCategorize: z.boolean().default(false), isTransfer: z.boolean().optional(),
  isRecurring: z.boolean().optional(), reviewed: z.boolean().optional(), undo: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

type Snapshot = {
  displayName: string | null; note: string | null; excluded: boolean; isTransfer: boolean; isRecurring: boolean;
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
  const { data: transaction } = await supabase.from("transactions").select("id,merchant,display_name,normalized_merchant,amount_cents,note,excluded,is_transfer,is_recurring,review_status,reviewed_at,reviewed_by,transacted_at,updated_at")
    .eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!transaction) return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  const { data: currentAllocations } = await supabase.from("transaction_allocations").select("category_id,amount_cents").eq("transaction_id", id).eq("household_id", auth.householdId);
  const before: Snapshot = { displayName: transaction.display_name as string | null, note: transaction.note as string | null, excluded: Boolean(transaction.excluded), isTransfer: Boolean(transaction.is_transfer), isRecurring: Boolean(transaction.is_recurring), reviewStatus: transaction.review_status as string, reviewedAt: transaction.reviewed_at as string | null, reviewedBy: transaction.reviewed_by as string | null, allocations: (currentAllocations ?? []).map((item) => ({ categoryId: item.category_id as string, amountCents: Number(item.amount_cents) })) };

  if (body.data.undo) {
    const { data: recentEvents } = await supabase.from("audit_events").select("action,metadata").eq("household_id", auth.householdId).eq("entity_type", "transaction").eq("entity_id", id).order("created_at", { ascending: false }).limit(20);
    const undoIndex = (recentEvents ?? []).findIndex((event) => event.action === "undone");
    const undoableEvents = undoIndex < 0 ? recentEvents ?? [] : (recentEvents ?? []).slice(0, undoIndex);
    const snapshot = undoableEvents.map((event) => (event.metadata as { before?: Snapshot } | null)?.before).find((value): value is Snapshot => Boolean(value));
    if (!snapshot) return NextResponse.json({ message: "There is no edit to undo." }, { status: 409 });
    const { error } = await supabase.rpc("update_transaction_with_allocations", { p_household_id: auth.householdId, p_transaction_id: id, p_updates: { display_name: snapshot.displayName, note: snapshot.note, excluded: snapshot.excluded, is_transfer: snapshot.isTransfer, is_recurring: snapshot.isRecurring, review_status: snapshot.reviewStatus }, p_allocations: snapshot.allocations.map((item) => ({ category_id: item.categoryId, amount_cents: item.amountCents })) });
    if (error) return NextResponse.json({ message: "The previous edit could not be restored." }, { status: 500 });
    await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: id, action: "undone", metadata: { restored: snapshot } });
    return NextResponse.json({ message: "Last transaction edit undone.", restored: snapshot });
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
  const updates: Record<string, unknown> = {};
  if (body.data.displayName !== undefined) updates.display_name = body.data.displayName;
  if (body.data.note !== undefined) updates.note = body.data.note;
  if (body.data.excluded !== undefined) updates.excluded = body.data.excluded;
  if (body.data.isTransfer !== undefined) { updates.is_transfer = body.data.isTransfer; if (body.data.isTransfer) updates.excluded = true; }
  if (body.data.isRecurring !== undefined) updates.is_recurring = body.data.isRecurring;
  if (body.data.reviewed !== undefined) updates.review_status = body.data.reviewed ? "reviewed" : "needs_review";
  if (body.data.excluded === true || body.data.isTransfer === true) updates.review_status = "reviewed";
  if (body.data.expectedUpdatedAt) updates.expected_updated_at = body.data.expectedUpdatedAt;
  if (body.data.alwaysCategorize && body.data.categoryId) {
    updates.allocation_source = "merchant_rule";
    updates.remember_normalized_merchant = normalizeMerchant(transaction.merchant as string);
    updates.remember_category_id = body.data.categoryId;
  }
  const { error: updateError } = await supabase.rpc("update_transaction_with_allocations", { p_household_id: auth.householdId, p_transaction_id: id, p_updates: updates, p_allocations: requestedAllocations ? requestedAllocations.map((item) => ({ category_id: item.categoryId, amount_cents: item.amountCents })) : null });
  if (updateError?.code === "40001") return NextResponse.json({ message: "This transaction was changed by another household member. Review their changes before saving yours." }, { status: 409 });
  if (updateError) return NextResponse.json({ message: "Transaction and category allocations could not be saved." }, { status: 500 });
  if (body.data.isRecurring) {
    const amount = Math.abs(Number(transaction.amount_cents));
    const nextDue = addMonths(new Date(transaction.transacted_at as string), 1);
    await supabase.from("recurring_items").upsert({ household_id: auth.householdId, type: Number(transaction.amount_cents) >= 0 ? "income" : "expense", name: transaction.merchant, merchant_pattern: normalizeMerchant(transaction.merchant as string), amount_cents: amount, cadence: "monthly", next_due_date: format(nextDue, "yyyy-MM-dd"), is_confirmed: true, active: true, state: "confirmed", updated_at: now }, { onConflict: "household_id,type,merchant_pattern" });
  } else if (body.data.isRecurring === false) {
    await supabase.from("recurring_items").update({ active: false, state: "inactive", updated_at: now }).eq("household_id", auth.householdId).eq("type", Number(transaction.amount_cents) >= 0 ? "income" : "expense").eq("merchant_pattern", normalizeMerchant(transaction.merchant as string));
  }
  const actions = [body.data.displayName !== undefined ? "display_name_changed" : null, body.data.allocations ? "split" : null, body.data.categoryId !== undefined ? "categorized" : null, body.data.excluded !== undefined ? "exclusion_changed" : null, body.data.isTransfer !== undefined ? "transfer_changed" : null, body.data.isRecurring !== undefined ? "recurring_changed" : null, body.data.reviewed !== undefined ? "review_changed" : null, body.data.alwaysCategorize ? "merchant_rule_created" : null].filter(Boolean);
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: id, action: "edited", metadata: { before, actions, categoryId: body.data.categoryId, splitCount: body.data.allocations?.length } });
  const [{ data: updatedTransaction }, { data: updatedAllocations }] = await Promise.all([
    supabase.from("transactions").select("id,merchant,display_name,amount_cents,status,transacted_at,review_status,reviewed_at,reviewed_by,note,excluded,is_transfer,is_recurring,updated_at").eq("id", id).eq("household_id", auth.householdId).single(),
    supabase.from("transaction_allocations").select("category_id,amount_cents,source").eq("transaction_id", id).eq("household_id", auth.householdId),
  ]);
  const afterAllocations = (updatedAllocations ?? []).map((item) => ({ categoryId: item.category_id as string, amountCents: Number(item.amount_cents), source: item.source as string }));
  return NextResponse.json({ message: body.data.reviewed ? "Transaction reviewed." : "Transaction updated.", transaction: { ...updatedTransaction, allocations: afterAllocations }, aggregateDeltas: allocationAggregateDeltas(before.allocations, afterAllocations) });
}
