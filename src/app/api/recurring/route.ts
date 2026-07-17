import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { attemptIncomeReconciliation } from "@/lib/income-reconciliation";
import { normalizeMerchant } from "@/lib/utils";

const schema = z.object({
  transactionId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  expectedAmountCents: z.number().int().positive(),
  cadence: z.enum(["weekly", "biweekly", "semimonthly", "monthly", "annual"]),
  nextDate: z.iso.date(),
  acceptableVarianceCents: z.number().int().min(0).nullable(),
});

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Check the recurring details." }, { status: 400 });
  const supabase = await createClient();
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id,merchant,normalized_merchant,amount_cents")
    .eq("id", body.data.transactionId)
    .eq("household_id", auth.householdId)
    .maybeSingle();
  if (!transaction) return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  const normalizedMerchant = (transaction.normalized_merchant as string | null) ?? normalizeMerchant(transaction.merchant as string);
  const now = new Date().toISOString();
  let error: { message: string } | null = null;
  let reconciled = true;
  if (Number(transaction.amount_cents) > 0) {
    const { data: existing } = await supabase
      .from("expected_income_sources")
      .select("id")
      .eq("household_id", auth.householdId)
      .eq("source_type", "recurring")
      .eq("normalized_merchant", normalizedMerchant)
      .maybeSingle();
    const values = {
      name: body.data.name,
      expected_amount_cents: body.data.expectedAmountCents,
      cadence: body.data.cadence,
      next_expected_date: body.data.nextDate,
      explicit_dates: [],
      active: true,
      acceptable_variance_cents: body.data.acceptableVarianceCents,
      source_type: "recurring",
      normalized_merchant: normalizedMerchant,
      auto_match_enabled: true,
      updated_at: now,
    };
    const result = existing
      ? await supabase.from("expected_income_sources").update(values).eq("id", existing.id).eq("household_id", auth.householdId)
      : await supabase.from("expected_income_sources").insert({ ...values, household_id: auth.householdId, created_by: auth.userId });
    error = result.error;
    if (!error) reconciled = await attemptIncomeReconciliation(supabase, auth.householdId, auth.userId);
  } else {
    const result = await supabase.from("recurring_items").upsert({
      household_id: auth.householdId,
      type: "expense",
      name: body.data.name,
      merchant_pattern: normalizedMerchant,
      amount_cents: body.data.expectedAmountCents,
      cadence: body.data.cadence,
      next_due_date: body.data.nextDate,
      is_confirmed: true,
      active: true,
      state: "confirmed",
      updated_at: now,
    }, { onConflict: "household_id,type,merchant_pattern" });
    error = result.error;
  }
  if (error) return NextResponse.json({ message: "Recurring schedule could not be saved." }, { status: 500 });
  await supabase.from("transactions").update({ is_recurring: true, updated_at: now }).eq("id", transaction.id).eq("household_id", auth.householdId);
  await supabase.from("audit_events").insert({
    household_id: auth.householdId,
    actor_user_id: auth.userId,
    entity_type: "transaction",
    entity_id: transaction.id,
    action: "recurring_schedule_configured",
    metadata: { cadence: body.data.cadence, nextDate: body.data.nextDate },
  });
  return NextResponse.json({ message: reconciled ? "Recurring schedule saved." : "Recurring schedule saved. Income occurrences will finish syncing shortly." });
}
