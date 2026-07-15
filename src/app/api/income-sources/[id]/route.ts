import { NextResponse } from "next/server";
import { z } from "zod";
import { incomeSourceSchema } from "@/lib/income-source-schema";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params; const body = incomeSourceSchema.safeParse(await request.json()); if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Check the expected income details." }, { status: 400 });
  const value = body.data; const supabase = await createClient();
  const { error } = await supabase.from("expected_income_sources").update({ name: value.name, expected_amount_cents: value.expectedAmountCents, cadence: value.sourceType === "recurring" ? value.cadence ?? "monthly" : null, next_expected_date: value.nextExpectedDate, explicit_dates: value.explicitDates, active: value.active, acceptable_variance_cents: value.acceptableVarianceCents, source_type: value.sourceType, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "expected_income_source", entity_id: id, action: "updated", metadata: { name: value.name, active: value.active } });
  return NextResponse.json({ message: error ? "Expected income could not be saved." : "Expected income saved." }, { status: error ? 500 : 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid expected income." }, { status: 400 });
  const supabase = await createClient(); const { error } = await supabase.from("expected_income_sources").delete().eq("id", id).eq("household_id", auth.householdId);
  return NextResponse.json({ message: error ? "Expected income could not be deleted." : "Expected income deleted." }, { status: error ? 500 : 200 });
}
