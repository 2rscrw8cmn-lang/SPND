import { NextResponse } from "next/server";
import { authenticatedHousehold } from "@/lib/server-auth";
import { syncConnection } from "@/lib/simplefin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: connection } = await admin.from("financial_connections")
    .select("id, last_synced_at, status, encrypted_access_url").eq("household_id", auth.householdId).eq("provider", "simplefin").in("status", ["active", "error"]).maybeSingle();
  if (!connection?.encrypted_access_url) return NextResponse.json({ message: "Reconnect SimpleFIN before syncing." }, { status: 404 });
  if (connection.status === "active" && connection.last_synced_at && Date.now() - new Date(connection.last_synced_at as string).getTime() < 5 * 60_000) {
    return NextResponse.json({ message: "A sync completed recently. Try again in a few minutes." }, { status: 429 });
  }
  try {
    const result = await syncConnection(connection.id as string);
    return NextResponse.json({ message: result.partial ? "Sync completed with provider warnings." : "Sync complete.", ...result }, { status: result.partial ? 207 : 200 });
  }
  catch (error) { return NextResponse.json({ message: error instanceof Error && !/https?:\/\//i.test(error.message) ? error.message : "SimpleFIN sync needs attention." }, { status: 502 }); }
}
