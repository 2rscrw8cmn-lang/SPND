import { csvDownload, toCsv } from "@/lib/csv";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await authenticatedHousehold();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("transactions")
    .select("transacted_at, merchant, amount_cents, status, excluded, note")
    .eq("household_id", auth.householdId).order("transacted_at", { ascending: false });
  return csvDownload(toCsv((data ?? []).map((row) => ({
    date: row.transacted_at,
    merchant: row.merchant,
    amount: Number(row.amount_cents) / 100,
    status: row.status,
    excluded: row.excluded,
    note: row.note,
  }))), "spnd-transactions.csv");
}

