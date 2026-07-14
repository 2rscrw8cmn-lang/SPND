import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

export async function requireUser() {
  if (isDemoMode) {
    return { id: "demo-zack", email: "zack@turco.family", firstName: "Zack" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    firstName:
      typeof data.claims.email === "string"
        ? data.claims.email.split("@")[0]?.replace(/^./, (letter) => letter.toUpperCase()) ?? "there"
        : "there",
  };
}

