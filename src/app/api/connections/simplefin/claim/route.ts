import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import { isDemoMode } from "@/lib/env";
import { authenticatedHousehold } from "@/lib/server-auth";
import { syncConnection } from "@/lib/simplefin";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ setupToken: z.string().trim().min(20).max(4096) });

function trustedClaimUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !(url.hostname === "simplefin.org" || url.hostname.endsWith(".simplefin.org"))) {
    throw new Error("The Setup Token did not contain a trusted SimpleFIN URL.");
  }
  return url;
}

function trustedAccessUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("SimpleFIN returned an insecure access URL.");
  return url;
}

export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ message: "Connection is disabled while demo mode is active." }, { status: 409 });
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Sign in to connect an account." }, { status: 401 });

  try {
    const { setupToken } = bodySchema.parse(await request.json());
    const decodedClaimUrl = Buffer.from(setupToken.replace(/\s+/g, ""), "base64").toString("utf8").trim();
    const claimUrl = trustedClaimUrl(decodedClaimUrl);
    const claimResponse = await fetch(claimUrl, { method: "POST", headers: { "content-length": "0" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!claimResponse.ok) return NextResponse.json({ message: "That token is invalid, expired, or already claimed." }, { status: 400 });
    const accessUrl = (await claimResponse.text()).trim();
    trustedAccessUrl(accessUrl);
    const encrypted = encryptSecret(accessUrl);
    const admin = createAdminClient();
    const { data: connection, error } = await admin.from("financial_connections").upsert({
      household_id: auth.householdId,
      provider: "simplefin",
      encrypted_access_url: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_auth_tag: encrypted.authTag,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "household_id,provider" }).select("id").single();
    if (error || !connection) throw new Error("Unable to store the encrypted connection.");
    await syncConnection(connection.id as string, true);
    return NextResponse.json({ message: "SimpleFIN connected and the initial sync is complete." });
  } catch (error) {
    const message = error instanceof z.ZodError ? "The Setup Token format is invalid." : error instanceof Error ? error.message : "Connection failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
