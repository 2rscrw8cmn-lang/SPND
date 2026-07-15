import { NextResponse } from "next/server";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { incomeSourceSchema } from "@/lib/income-source-schema";

export async function POST(request: Request) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = incomeSourceSchema.safeParse(await request.json()); if (!body.success) return NextResponse.json({ message: "Check the expected income details." }, { status: 400 });
  const supabase = await createClient(); const value = body.data;
  const { data, error } = await supabase.from("expected_income_sources").insert({ household_id: auth.householdId, name: value.name, expected_amount_cents: value.expectedAmountCents, cadence: value.sourceType === "recurring" ? value.cadence ?? "monthly" : null, next_expected_date: value.nextExpectedDate, explicit_dates: value.explicitDates, active: value.active, acceptable_variance_cents: value.acceptableVarianceCents, source_type: value.sourceType, created_by: auth.userId }).select("id").single();
  if (!error && data) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "expected_income_source", entity_id: data.id, action: "created", metadata: { name: value.name, expectedAmountCents: value.expectedAmountCents } });
  return NextResponse.json({ message: error ? "Expected income could not be added." : "Expected income added.", id: data?.id }, { status: error ? 500 : 200 });
}
