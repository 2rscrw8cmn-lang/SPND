import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const nameSchema = z.object({ name: z.string().trim().min(1).max(40).refine((name) => name.toLowerCase() !== "all", "All is reserved for the budget filter.") });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = nameSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: body.error.issues[0]?.message ?? "Enter a group name." }, { status: 400 });
  if (isDemoMode) return NextResponse.json({ message: "Demo category group renamed for this session.", group: { id, name: body.data.name } });
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid category group." }, { status: 400 });

  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const supabase = await createClient();
  const { data: existing } = await supabase.from("category_groups").select("name,is_system").eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!existing) return NextResponse.json({ message: "Category group not found." }, { status: 404 });
  if (existing.is_system) return NextResponse.json({ message: "Built-in groups cannot be renamed." }, { status: 400 });
  const { error } = await supabase.rpc("rename_category_group", { p_household_id: auth.householdId, p_group_id: id, p_name: body.data.name });
  if (error) return NextResponse.json({ message: error.code === "23505" ? "That category group already exists." : "Category group could not be renamed." }, { status: error.code === "23505" ? 409 : 500 });
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "category_group", entity_id: id, action: "renamed", metadata: { beforeName: existing.name, name: body.data.name } });
  return NextResponse.json({ message: "Category group renamed.", group: { id, name: body.data.name } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode) return NextResponse.json({ message: "Demo category group deleted for this session." });
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid category group." }, { status: 400 });

  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const supabase = await createClient();
  const { data: existing } = await supabase.from("category_groups").select("name,is_system").eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!existing) return NextResponse.json({ message: "Category group not found." }, { status: 404 });
  if (existing.is_system) return NextResponse.json({ message: "Built-in groups cannot be deleted." }, { status: 400 });
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("household_id", auth.householdId).eq("category_group", existing.name);
  if (count) return NextResponse.json({ message: `Move ${count} categor${count === 1 ? "y" : "ies"} to another group before deleting this one.` }, { status: 409 });
  const { error } = await supabase.from("category_groups").delete().eq("id", id).eq("household_id", auth.householdId);
  if (error) {
    const occupied = error.code === "23503" || error.message.includes("Move categories");
    return NextResponse.json({ message: occupied ? "Move the categories to another group before deleting this one." : "Category group could not be deleted." }, { status: occupied ? 409 : 500 });
  }
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "category_group", entity_id: id, action: "deleted", metadata: { name: existing.name } });
  return NextResponse.json({ message: "Category group deleted." });
}
