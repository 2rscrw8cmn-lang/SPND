import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ occurrenceId: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { occurrenceId } = await params;
  if (!z.string().uuid().safeParse(occurrenceId).success) return NextResponse.json({ message: "Invalid income occurrence." }, { status: 400 });
  const supabase = await createClient();
  const { data: occurrence } = await supabase.from("planned_items").select("id,matched_transaction_id").eq("id", occurrenceId).eq("household_id", auth.householdId).eq("type", "income").maybeSingle();
  if (!occurrence) return NextResponse.json({ message: "Income occurrence not found." }, { status: 404 });
  const { error } = await supabase.from("planned_items").update({ state: "confirmed", matched_transaction_id: null, match_method: null, updated_at: new Date().toISOString() }).eq("id", occurrenceId).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "planned_item", entity_id: occurrenceId, action: "income_unmatched", metadata: { transactionId: occurrence.matched_transaction_id } });
  return NextResponse.json({ message: error ? "The income match could not be removed." : "Deposit unmatched." }, { status: error ? 500 : 200 });
}
