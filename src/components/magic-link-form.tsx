"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const allowedEmails = new Set(["zack@turco.family", "stephanie@turco.family"]);

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!allowedEmails.has(normalized)) {
      setMessage("This email isn’t approved for the Turco Household.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setLoading(false);
    if (error) {
      const detail = error.message.toLowerCase();
      if (detail.includes("rate") || detail.includes("too many") || detail.includes("60 seconds")) {
        setMessage("Please wait a minute before requesting another link. Supabase also limits email volume without custom SMTP.");
      } else if (detail.includes("email") || detail.includes("smtp") || detail.includes("provider")) {
        setMessage("Email delivery is not configured for this address yet. The household owner needs to enable custom SMTP in Supabase Auth settings.");
      } else {
        setMessage(`Sign-in could not start: ${error.message}`);
      }
    } else {
      setMessage("Check your email for a secure sign-in link.");
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@turco.family" />
      </div>
      <button className="primary-button" style={{ width: "100%" }} disabled={loading}>{loading ? "Sending…" : "Email me a sign-in link"}</button>
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}
