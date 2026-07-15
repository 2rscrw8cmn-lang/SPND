import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(40).refine((name) => name.toLowerCase() !== "all", "All is reserved for the budget filter.") });

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: body.error.issues[0]?.message ?? "Enter a group name." }, { status: 400 });
  if (isDemoMode) return NextResponse.json({ message: "Demo category group added for this session.", group: { id: crypto.randomUUID(), name: body.data.name, sortOrder: 100, isSystem: false } });

  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const supabase = await createClient();
  const { data: lastGroup } = await supabase.from("category_groups").select("sort_order").eq("household_id", auth.householdId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = Number(lastGroup?.sort_order ?? 90) + 10;
  const { data, error } = await supabase.from("category_groups").insert({ household_id: auth.householdId, name: body.data.name, sort_order: sortOrder, is_system: false }).select("id,name,sort_order,is_system").single();
  if (error || !data) return NextResponse.json({ message: error?.code === "23505" ? "That category group already exists." : "Category group could not be added." }, { status: error?.code === "23505" ? 409 : 500 });
  await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "category_group", entity_id: data.id, action: "created", metadata: { name: data.name } });
  return NextResponse.json({ message: "Category group added.", group: { id: data.id, name: data.name, sortOrder: Number(data.sort_order), isSystem: Boolean(data.is_system) } });
}
