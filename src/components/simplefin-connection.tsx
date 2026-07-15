"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Link2Off, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConnectionHealth } from "@/lib/data";

export function SimpleFinConnection({ initialHealth }: { initialHealth: ConnectionHealth }) {
  const router = useRouter();
  const [token, setToken] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false); const [showReconnect, setShowReconnect] = useState(initialHealth.status === "unconfigured" || initialHealth.status === "disconnected");
  const label = initialHealth.status === "active" ? "Active" : initialHealth.status === "error" ? "Needs attention" : initialHealth.status === "disconnected" ? "Disconnected" : "Not connected";
  const Icon = initialHealth.status === "active" ? CheckCircle2 : initialHealth.status === "error" ? AlertTriangle : Link2Off;
  async function request(url: string, method: string, body?: unknown) { setLoading(true); setMessage(""); const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const result = await response.json() as { message?: string; accountCount?: number; transactionCount?: number; createdCount?: number; updatedCount?: number; reconciledCount?: number }; setLoading(false); setMessage(result.accountCount !== undefined ? `${result.message} ${result.accountCount} accounts; ${result.transactionCount ?? 0} unique transactions received (${result.createdCount ?? 0} created, ${result.updatedCount ?? 0} updated, ${result.reconciledCount ?? 0} reconciled).` : result.message ?? "Request complete."); if (response.ok) router.refresh(); return response.ok; }
  async function connect(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const ok = await request("/api/connections/simplefin/claim", "POST", { setupToken: token }); setToken(""); if (ok) setShowReconnect(false); }
  return <div>
    <div className={`connection-health ${initialHealth.status}`}><div className="connection-status"><Icon /><span><small>Connection status</small><strong>{label}</strong></span></div><dl><div><dt>Last successful sync</dt><dd>{relative(initialHealth.lastSuccessfulSync)}</dd></div><div><dt>Last attempted sync</dt><dd>{relative(initialHealth.lastAttemptedSync)}</dd></div><div><dt>Accounts imported</dt><dd>{initialHealth.accountCount}</dd></div><div><dt>Transactions received</dt><dd>{initialHealth.transactionCount}</dd></div><div><dt>Last result</dt><dd>{initialHealth.lastResult ?? "No sync yet"}</dd></div></dl>{initialHealth.sanitizedError ? <p className="connection-error">{initialHealth.sanitizedError}</p> : null}</div>
    {initialHealth.status !== "unconfigured" && initialHealth.status !== "disconnected" ? <div className="connection-actions"><button className="primary-button" disabled={loading} onClick={() => request("/api/connections/simplefin/sync", "POST")}><RefreshCw size={17} /> {initialHealth.status === "error" ? "Retry sync" : "Sync now"}</button><button className="secondary-button" disabled={loading} onClick={() => setShowReconnect(!showReconnect)}>Reconnect</button><button className="danger-button" disabled={loading} onClick={() => request("/api/connections/simplefin/disconnect", "DELETE")}>Disconnect</button></div> : null}
    {showReconnect ? <form className="connection-form" onSubmit={connect}><div className="field"><label htmlFor="setup-token">One-time Setup Token</label><textarea id="setup-token" value={token} onChange={(event) => setToken(event.target.value)} required rows={3} autoComplete="off" spellCheck={false} placeholder="Paste only into this secure field" /></div><button className="primary-button" disabled={loading}>{loading ? "Connecting…" : initialHealth.status === "unconfigured" ? "Connect SimpleFIN" : "Replace connection"}</button></form> : null}
    <p className="form-message" role="status">{message}</p>
  </div>;
}

function relative(value: string | null) { return value ? `${formatDistanceToNow(new Date(value))} ago` : "Never"; }
