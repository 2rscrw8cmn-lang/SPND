"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Account = { id: string; name: string; institutionName: string; balanceCents: number; mode: "cash" | "net_worth" | "excluded" };

export function AccountSettings({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [message, setMessage] = useState("");
  return (
    <>
      <section className="card">
        {accounts.map((account) => (
          <div className="settings-row" key={account.id} style={{ alignItems: "flex-start" }}>
            <div><strong>{account.name}</strong><br /><span>{account.institutionName} · {formatCurrency(account.balanceCents)}</span></div>
            <label><span className="sr-only">Cash flow treatment for {account.name}</span><select value={account.mode} onChange={async (event) => {
              const mode = event.target.value as Account["mode"];
              setAccounts(accounts.map((item) => item.id === account.id ? { ...item, mode } : item));
              const response = await fetch(`/api/accounts/${account.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
              const body = (await response.json()) as { message?: string };
              setMessage(response.status === 401 || response.status === 400 ? "Preview updated. Production sign-in is required to save." : body.message ?? "Saved.");
            }}><option value="cash">Available cash</option><option value="net_worth">Net worth only</option><option value="excluded">Excluded</option></select></label>
          </div>
        ))}
      </section>
      {!accounts.length ? <div className="empty-state card"><h2>No accounts yet</h2><p>Connect SimpleFIN first, then choose how each account should affect your plan.</p></div> : null}
      <p className="form-message" role="status">{message}</p>
    </>
  );
}

