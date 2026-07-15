"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ demoMode = false }: { demoMode?: boolean }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    if (!demoMode) await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <button className="settings-row settings-row-button" disabled={signingOut} onClick={() => void signOut()}><div><strong>{signingOut ? "Signing out…" : "Sign out"}</strong><br /><span>End this session</span></div><LogOut /></button>;
}
