import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ mode: z.enum(["cash", "net_worth", "excluded"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  const { id } = await params;
  if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid account setting." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ cash_flow_mode: body.data.mode, updated_at: new Date().toISOString() }).eq("id", id).eq("household_id", auth.householdId);
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "account", entity_id: id, action: "cash_flow_mode_updated", metadata: body.data });
  return NextResponse.json({ message: error ? "Account setting could not be saved." : "Account setting saved." }, { status: error ? 500 : 200 });
}

