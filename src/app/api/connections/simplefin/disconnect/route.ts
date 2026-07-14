import { NextResponse } from "next/server";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("financial_connections").update({
    encrypted_access_url: null,
    encryption_iv: null,
    encryption_auth_tag: null,
    status: "disconnected",
    updated_at: new Date().toISOString(),
  }).eq("household_id", auth.householdId).eq("provider", "simplefin");
  return NextResponse.json({ message: error ? "Unable to disconnect." : "SimpleFIN disconnected." }, { status: error ? 500 : 200 });
}

