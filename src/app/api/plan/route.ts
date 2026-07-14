import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ name: z.string().trim().min(1).max(120), date: z.iso.date(), amountCents: z.number().int().positive(), type: z.enum(["income", "expense"]) });

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ message: "Complete every planned item field." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("planned_items").insert({ household_id: auth.householdId, ...body.data });
  if (!error) await supabase.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "planned_item", action: "created", metadata: body.data });
  return NextResponse.json({ message: error ? "Planned item could not be saved." : "Planned item added." }, { status: error ? 500 : 200 });
}

