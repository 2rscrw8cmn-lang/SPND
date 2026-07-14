"use client";

import { useState } from "react";

export function SimpleFinConnection() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/connections/simplefin/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupToken: token }),
    });
    const body = (await response.json()) as { message?: string };
    setToken("");
    setLoading(false);
    setStatus(body.message ?? (response.ok ? "Connected." : "Connection failed."));
  }

  return (
    <form onSubmit={connect}>
      <div className="field">
        <label htmlFor="setup-token">One-time Setup Token</label>
        <textarea id="setup-token" value={token} onChange={(event) => setToken(event.target.value)} required rows={3} autoComplete="off" spellCheck={false} placeholder="Paste only into this secure field" />
      </div>
      <button className="primary-button" disabled={loading}>{loading ? "Connecting…" : "Connect SimpleFIN"}</button>
      <p className="form-message" role="status">{status}</p>
    </form>
  );
}

