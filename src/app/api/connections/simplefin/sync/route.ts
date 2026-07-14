import { NextResponse } from "next/server";
import { authenticatedHousehold } from "@/lib/server-auth";
import { syncConnection } from "@/lib/simplefin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: connection } = await admin.from("financial_connections")
    .select("id, last_synced_at").eq("household_id", auth.householdId).eq("provider", "simplefin").eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.json({ message: "No active connection." }, { status: 404 });
  if (connection.last_synced_at && Date.now() - new Date(connection.last_synced_at as string).getTime() < 5 * 60_000) {
    return NextResponse.json({ message: "A sync completed recently. Try again in a few minutes." }, { status: 429 });
  }
  const result = await syncConnection(connection.id as string);
  return NextResponse.json({ message: "Sync complete.", ...result });
}

