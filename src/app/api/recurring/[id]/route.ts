import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ confirmed: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  const { id } = await params;
  if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid recurring item." }, { status: 400 });
  const supabase = await createClient();
  const updates = body.data.confirmed ? { is_confirmed: true, active: true, state: "confirmed", updated_at: new Date().toISOString() } : { active: false, state: "dismissed", updated_at: new Date().toISOString() };
  const { error } = await supabase.from("recurring_items").update(updates).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "recurring_item", entity_id: id, action: body.data.confirmed ? "confirmed" : "dismissed" });
  return NextResponse.json({ message: error ? "Item could not be updated." : body.data.confirmed ? "Added to your forecast." : "Suggestion dismissed." }, { status: error ? 500 : 200 });
}
