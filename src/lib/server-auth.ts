import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function authenticatedHousehold() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return null;
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", claims.claims.sub)
    .maybeSingle();
  if (!membership) return null;
  return { userId: claims.claims.sub, householdId: membership.household_id as string, role: membership.role as string };
}

