import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(60), categoryGroup: z.enum(["Essentials", "Lifestyle", "Goals", "Excluded"]) });

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Enter a category name and group." }, { status: 400 });
  const supabase = await createClient();
  const excluded = body.data.categoryGroup === "Excluded";
  const { data, error } = await supabase.from("categories").insert({ household_id: auth.householdId, name: body.data.name, color: "#A6ACB8", icon: "CircleHelp", category_group: body.data.categoryGroup, is_active: true, is_excluded: excluded, show_in_budget: !excluded, sort_order: 500 }).select("id,name,color,icon,category_group,is_active,is_excluded,show_in_budget").single();
  if (error || !data) return NextResponse.json({ message: error?.code === "23505" ? "That category already exists." : "Category could not be added." }, { status: error?.code === "23505" ? 409 : 500 });
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "category", entity_id: data.id, action: "created", metadata: { name: data.name, categoryGroup: data.category_group } });
  return NextResponse.json({ message: "Category added.", category: { id: data.id, name: data.name, color: data.color, icon: data.icon, categoryGroup: data.category_group, isActive: data.is_active, isExcluded: data.is_excluded, showInBudget: data.show_in_budget, budgetedCents: 0, spentCents: 0, pendingCents: 0 } });
}
