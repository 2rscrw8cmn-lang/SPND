import { NextResponse } from "next/server";
import { z } from "zod";
import { incomeSourceSchema } from "@/lib/income-source-schema";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { attemptIncomeReconciliation } from "@/lib/income-reconciliation";
import { normalizeMerchant } from "@/lib/utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params; const body = incomeSourceSchema.safeParse(await request.json()); if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Check the expected income details." }, { status: 400 });
  const value = body.data; const supabase = await createClient();
  const { error } = await supabase.from("expected_income_sources").update({ name: value.name, expected_amount_cents: value.expectedAmountCents, cadence: value.sourceType === "recurring" ? value.cadence ?? "monthly" : null, next_expected_date: value.nextExpectedDate, explicit_dates: value.explicitDates, active: value.active, acceptable_variance_cents: value.acceptableVarianceCents, source_type: value.sourceType, normalized_merchant: value.normalizedMerchant ? normalizeMerchant(value.normalizedMerchant) : null, auto_match_enabled: value.autoMatchEnabled, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "expected_income_source", entity_id: id, action: "updated", metadata: { name: value.name, active: value.active } });
  const reconciled = !error ? await attemptIncomeReconciliation(supabase, auth.householdId, auth.userId) : false;
  return NextResponse.json({ message: error ? "Expected income could not be saved." : reconciled ? "Expected income saved." : "Expected income saved. Occurrences will finish syncing shortly." }, { status: error ? 500 : 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid expected income." }, { status: 400 });
  const supabase = await createClient(); const { error } = await supabase.from("expected_income_sources").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "expected_income_source", entity_id: id, action: "archived" });
  const reconciled = !error ? await attemptIncomeReconciliation(supabase, auth.householdId, auth.userId) : false;
  return NextResponse.json({ message: error ? "Expected income could not be archived." : reconciled ? "Expected income archived." : "Expected income archived. Occurrences will finish syncing shortly." }, { status: error ? 500 : 200 });
}
