import { addMonths, format } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeBudgetMonth } from "@/lib/data";
import { isDemoMode } from "@/lib/env";

const schema = z.union([
  z.object({ categoryId: z.string().uuid(), budgetedCents: z.number().int().min(0).max(100_000_000), month: z.string().regex(/^\d{4}-\d{2}(?:-01)?$/).optional() }),
  z.object({ budgets: z.array(z.object({ categoryId: z.string().uuid(), budgetedCents: z.number().int().min(0).max(100_000_000) })).min(1).max(100), month: z.string().regex(/^\d{4}-\d{2}(?:-01)?$/).optional() }),
  z.object({ fromCategoryId: z.string().uuid(), toCategoryId: z.string().uuid(), amountCents: z.number().int().positive().max(100_000_000), month: z.string().regex(/^\d{4}-\d{2}(?:-01)?$/).optional() }).refine((value) => value.fromCategoryId !== value.toCategoryId, "Choose two different categories."),
  z.object({ action: z.enum(["copy_previous", "save_template", "apply_template"]), month: z.string().regex(/^\d{4}-\d{2}(?:-01)?$/) }),
]);

export async function POST(request: Request) {
  const requestBody = await request.json();
  if (isDemoMode) {
    const action = typeof requestBody === "object" && requestBody && "action" in requestBody ? String(requestBody.action) : "";
    return NextResponse.json({ message: action === "save_template" ? "Demo template saved for this session." : action ? "Demo month setup applied for this session." : "Monthly budget updated." });
  }
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(requestBody);
  if (!body.success) return NextResponse.json({ message: "Enter a valid monthly amount." }, { status: 400 });
  const supabase = await createClient();
  const month = format(normalizeBudgetMonth(body.data.month), "yyyy-MM-dd");
  if ("action" in body.data) {
    if (body.data.action === "save_template") {
      const { data: current } = await supabase.from("monthly_budgets").select("category_id,budgeted_cents").eq("household_id", auth.householdId).eq("month", month).gt("budgeted_cents", 0);
      if (!current?.length) return NextResponse.json({ message: "Add monthly amounts before saving a template." }, { status: 400 });
      const { error: deleteError } = await supabase.from("budget_templates").delete().eq("household_id", auth.householdId);
      const { error } = deleteError ? { error: deleteError } : await supabase.from("budget_templates").insert(current.map((item) => ({ household_id: auth.householdId, category_id: item.category_id, budgeted_cents: item.budgeted_cents })));
      if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "budget_template", action: "saved", metadata: { month, categoryCount: current.length } });
      return NextResponse.json({ message: error ? "Default template could not be saved." : `Default template saved with ${current.length} categories.`, categoryCount: current.length, totalCents: current.reduce((sum, item) => sum + Number(item.budgeted_cents), 0) }, { status: error ? 500 : 200 });
    }
    const { count } = await supabase.from("monthly_budgets").select("id", { count: "exact", head: true }).eq("household_id", auth.householdId).eq("month", month).gt("budgeted_cents", 0);
    if (count) return NextResponse.json({ message: "This month already has assigned amounts. Edit exceptions directly instead." }, { status: 409 });
    const source = body.data.action === "copy_previous"
      ? await supabase.from("monthly_budgets").select("category_id,budgeted_cents").eq("household_id", auth.householdId).eq("month", format(addMonths(normalizeBudgetMonth(month), -1), "yyyy-MM-dd")).gt("budgeted_cents", 0)
      : await supabase.from("budget_templates").select("category_id,budgeted_cents").eq("household_id", auth.householdId).gt("budgeted_cents", 0);
    if (!source.data?.length) return NextResponse.json({ message: body.data.action === "copy_previous" ? "The previous month has no assigned amounts." : "No default template has been saved." }, { status: 400 });
    const rows = source.data.map((item) => ({ household_id: auth.householdId, month, category_id: item.category_id, budgeted_cents: item.budgeted_cents, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("monthly_budgets").insert(rows);
    if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "monthly_budget", action: body.data.action, metadata: { month, categoryCount: rows.length } });
    return NextResponse.json({ message: error ? "Month setup could not be applied." : `${rows.length} category amounts applied.`, categoryCount: rows.length, totalCents: rows.reduce((sum, item) => sum + Number(item.budgeted_cents), 0) }, { status: error ? 500 : 200 });
  }
  if ("fromCategoryId" in body.data) {
    const { error } = await supabase.rpc("move_budget_money", { p_household_id: auth.householdId, p_month: month, p_from_category_id: body.data.fromCategoryId, p_to_category_id: body.data.toCategoryId, p_amount_cents: body.data.amountCents });
    return NextResponse.json({ message: error ? "Money could not be moved." : "Budget money moved." }, { status: error ? 400 : 200 });
  }
  if ("budgets" in body.data) {
    const rows = body.data.budgets.map((budget) => ({ household_id: auth.householdId, category_id: budget.categoryId, month, budgeted_cents: budget.budgetedCents, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("monthly_budgets").upsert(rows, { onConflict: "household_id,month,category_id" });
    if (!error) await supabase.from("audit_events").insert(body.data.budgets.map((budget) => ({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "monthly_budget", action: "updated", metadata: { month, categoryId: budget.categoryId, budgetedCents: budget.budgetedCents } })));
    return NextResponse.json({ message: error ? "Monthly budget could not be saved." : "Monthly budget updated." }, { status: error ? 500 : 200 });
  }
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
