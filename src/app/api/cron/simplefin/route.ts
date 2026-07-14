import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { syncConnection } from "@/lib/simplefin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const env = getServerEnv();
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: connections } = await admin.from("financial_connections").select("id").eq("status", "active");
  const results = [];
  for (const connection of connections ?? []) {
    try {
      results.push({ id: connection.id, ok: true, ...(await syncConnection(connection.id as string)) });
    } catch {
      results.push({ id: connection.id, ok: false });
    }
  }
  return NextResponse.json({ connections: results.length, results });
}

