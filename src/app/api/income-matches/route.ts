import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeMerchant } from "@/lib/utils";

const schema = z.object({ occurrenceId: z.string().uuid(), transactionId: z.string().uuid(), previousOccurrenceId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Choose an expected deposit and transaction." }, { status: 400 });
  const supabase = await createClient();
  const [{ data: occurrence }, { data: transaction }] = await Promise.all([
    supabase.from("planned_items").select("id,name,expected_income_source_id,matched_transaction_id").eq("id", body.data.occurrenceId).eq("household_id", auth.householdId).eq("type", "income").maybeSingle(),
    supabase.from("transactions").select("id,merchant,normalized_merchant,amount_cents,status,excluded,is_transfer").eq("id", body.data.transactionId).eq("household_id", auth.householdId).maybeSingle(),
  ]);
  if (!occurrence || !transaction || transaction.status !== "posted" || Number(transaction.amount_cents) <= 0 || transaction.excluded || transaction.is_transfer) {
    return NextResponse.json({ message: "This deposit cannot be matched." }, { status: 409 });
  }
  if (occurrence.matched_transaction_id && occurrence.matched_transaction_id !== transaction.id) return NextResponse.json({ message: "That expected income is already matched." }, { status: 409 });
  const { data: previousOccurrence } = body.data.previousOccurrenceId
    ? await supabase.from("planned_items").select("id,name,matched_transaction_id").eq("id", body.data.previousOccurrenceId).eq("household_id", auth.householdId).eq("type", "income").maybeSingle()
    : { data: null };
  if (body.data.previousOccurrenceId && previousOccurrence?.matched_transaction_id !== transaction.id) return NextResponse.json({ message: "The existing income match changed. Refresh and try again." }, { status: 409 });
  const { data: duplicateMatches } = await supabase.from("planned_items").select("id").eq("household_id", auth.householdId).eq("matched_transaction_id", transaction.id);
  const allowedIds = new Set([occurrence.id, previousOccurrence?.id].filter(Boolean));
  if ((duplicateMatches ?? []).some((item) => !allowedIds.has(item.id))) return NextResponse.json({ message: "This deposit is already matched." }, { status: 409 });
  const now = new Date().toISOString();
  const targetUpdate = supabase.from("planned_items").update({ state: "matched", matched_transaction_id: transaction.id, match_method: "manual", updated_at: now }).eq("id", occurrence.id).eq("household_id", auth.householdId);
  if (!occurrence.matched_transaction_id) targetUpdate.is("matched_transaction_id", null);
  const { error } = await targetUpdate;
  if (error) return NextResponse.json({ message: "The income match could not be saved." }, { status: 500 });
  if (previousOccurrence && previousOccurrence.id !== occurrence.id) {
    const { error: previousError } = await supabase.from("planned_items").update({ state: "confirmed", matched_transaction_id: null, match_method: null, updated_at: now }).eq("id", previousOccurrence.id).eq("household_id", auth.householdId).eq("matched_transaction_id", transaction.id);
    if (previousError) {
      await supabase.from("planned_items").update({ state: "confirmed", matched_transaction_id: null, match_method: null, updated_at: now }).eq("id", occurrence.id).eq("household_id", auth.householdId).eq("matched_transaction_id", transaction.id);
      return NextResponse.json({ message: "The previous income match could not be replaced." }, { status: 500 });
    }
  }
  if (occurrence.expected_income_source_id) {
    const normalizedMerchant = (transaction.normalized_merchant as string | null) ?? normalizeMerchant(transaction.merchant as string);
    await supabase.from("expected_income_sources").update({ normalized_merchant: normalizedMerchant, auto_match_enabled: true, updated_at: new Date().toISOString() }).eq("id", occurrence.expected_income_source_id).eq("household_id", auth.householdId).is("normalized_merchant", null);
  }
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "planned_item", entity_id: occurrence.id, action: previousOccurrence ? "income_match_changed" : "income_manually_matched", metadata: { transactionId: transaction.id, previousOccurrenceId: previousOccurrence?.id ?? null } });
  return NextResponse.json({ message: `${transaction.merchant} matched to ${occurrence.name}.`, previousOccurrenceId: previousOccurrence?.id ?? null });
}
