import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMerchant } from "@/lib/utils";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  categoryId: z.string().uuid().optional(),
  allocations: z.array(z.object({ categoryId: z.string().uuid(), amountCents: z.number().int() })).min(2).max(20).optional(),
  excluded: z.boolean().optional(),
  note: z.string().max(1000).optional(),
  alwaysCategorize: z.boolean().default(false),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  const { id } = await params;
  if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid transaction update." }, { status: 400 });
  const supabase = await createClient();
  const { data: transaction } = await supabase.from("transactions").select("id,merchant,amount_cents").eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!transaction) return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.excluded !== undefined) updates.excluded = body.data.excluded;
  if (body.data.note !== undefined) updates.note = body.data.note;
  const { error: updateError } = await supabase.from("transactions").update(updates).eq("id", id).eq("household_id", auth.householdId);
  if (body.data.allocations && body.data.allocations.reduce((sum, item) => sum + item.amountCents, 0) !== Number(transaction.amount_cents)) {
    return NextResponse.json({ message: "Split amounts must equal the transaction total." }, { status: 400 });
  }
  if (body.data.categoryId || body.data.allocations) {
    await supabase.from("transaction_allocations").delete().eq("transaction_id", id).eq("household_id", auth.householdId);
    const allocations = body.data.allocations ?? [{ categoryId: body.data.categoryId!, amountCents: Number(transaction.amount_cents) }];
    await supabase.from("transaction_allocations").insert(allocations.map((allocation) => ({ household_id: auth.householdId, transaction_id: id, category_id: allocation.categoryId, amount_cents: allocation.amountCents, source: "manual" })));
    if (body.data.alwaysCategorize && body.data.categoryId && !body.data.allocations) {
      const normalized = normalizeMerchant(transaction.merchant as string);
      await supabase.from("merchant_rules").upsert({ household_id: auth.householdId, merchant_pattern: transaction.merchant, normalized_merchant: normalized, category_id: body.data.categoryId, priority: 1000, active: true, created_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: "household_id,normalized_merchant" });
    }
  }
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "transaction", entity_id: id, action: "edited", metadata: { categoryId: body.data.categoryId, splitCount: body.data.allocations?.length, excluded: body.data.excluded, ruleCreated: body.data.alwaysCategorize } });
  return NextResponse.json({ message: updateError ? "Transaction could not be updated." : "Transaction updated." }, { status: updateError ? 500 : 200 });
}
