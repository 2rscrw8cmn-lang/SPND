"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const allowedEmails = new Set(["zack@turco.family", "stephanie@turco.family"]);

export function PasswordLoginForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
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
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      setLoading(false);
      setMessage("That email and password didn’t match. Check them and try again.");
      return;
    }
    // Full navigation so the server picks up the freshly set session cookie.
    window.location.assign("/");
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@turco.family" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
      </div>
      <button className="primary-button" style={{ width: "100%" }} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}
