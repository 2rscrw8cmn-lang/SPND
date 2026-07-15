import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), icon: z.string().min(1).max(40), categoryGroup: z.string().trim().min(1).max(40), behaviorType: z.enum(["spending", "obligation", "goal", "income", "excluded"]), isActive: z.boolean(), isExcluded: z.boolean(), showInBudget: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid category." }, { status: 400 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Check the category settings." }, { status: 400 });
  const supabase = await createClient();
  const { data: existing } = await supabase.from("categories").select("name,is_system").eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!existing) return NextResponse.json({ message: "Category not found." }, { status: 404 });
  if (existing.name === "Unsorted" && (!body.data.isActive || body.data.name !== "Unsorted")) return NextResponse.json({ message: "Unsorted is a protected review queue." }, { status: 400 });
  const { data: group } = await supabase.from("category_groups").select("name").eq("household_id", auth.householdId).eq("name", body.data.categoryGroup).maybeSingle();
  if (!group) return NextResponse.json({ message: "Choose an existing category group." }, { status: 400 });
  const excluded = body.data.behaviorType === "excluded" || body.data.categoryGroup === "Excluded" || body.data.isExcluded;
  const { error } = await supabase.from("categories").update({ name: body.data.name, color: body.data.color, icon: body.data.icon, category_group: body.data.categoryGroup, behavior_type: excluded ? "excluded" : body.data.behaviorType, is_active: body.data.isActive, is_excluded: excluded, show_in_budget: excluded || body.data.behaviorType === "income" ? false : body.data.showInBudget, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
  if (error) return NextResponse.json({ message: error.code === "23505" ? "That category name is already used." : "Category could not be saved." }, { status: error.code === "23505" ? 409 : 500 });
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "category", entity_id: id, action: body.data.isActive ? "updated" : "archived", metadata: { beforeName: existing.name, name: body.data.name, categoryGroup: body.data.categoryGroup, behaviorType: body.data.behaviorType, isActive: body.data.isActive } });
  return NextResponse.json({ message: body.data.isActive ? "Category saved." : "Category archived." });
}
