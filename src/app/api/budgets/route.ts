import { format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeBudgetMonth } from "@/lib/data";

const schema = z.object({ categoryId: z.string().uuid(), budgetedCents: z.number().int().min(0).max(100_000_000), month: z.string().regex(/^\d{4}-\d{2}(?:-01)?$/).optional() });

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Enter a valid monthly amount." }, { status: 400 });
  const supabase = await createClient();
  const month = format(normalizeBudgetMonth(body.data.month), "yyyy-MM-dd");
  const { error } = await supabase.from("monthly_budgets").upsert({
    household_id: auth.householdId,
    category_id: body.data.categoryId,
    month,
    budgeted_cents: body.data.budgetedCents,
    updated_at: new Date().toISOString(),
  }, { onConflict: "household_id,month,category_id" });
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "monthly_budget", action: "updated", metadata: { month, categoryId: body.data.categoryId, budgetedCents: body.data.budgetedCents } });
  return NextResponse.json({ message: error ? "Budget could not be saved." : "Monthly budget saved." }, { status: error ? 500 : 200 });
}
