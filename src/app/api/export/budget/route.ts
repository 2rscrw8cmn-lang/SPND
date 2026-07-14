import { csvDownload, toCsv } from "@/lib/csv";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await authenticatedHousehold();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("monthly_budgets")
    .select("month, budgeted_cents, categories(name)").eq("household_id", auth.householdId).order("month", { ascending: false });
  return csvDownload(toCsv((data ?? []).map((row) => ({
    month: row.month,
    category: (row.categories as unknown as { name?: string } | null)?.name ?? "",
    budgeted: Number(row.budgeted_cents) / 100,
  }))), "spnd-budgets.csv");
}

