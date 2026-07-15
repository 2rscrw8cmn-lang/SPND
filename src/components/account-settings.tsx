"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { calculateNetWorth } from "@/lib/safe-to-spnd";

type Account = {
  id: string; name: string; institutionName: string; balanceCents: number; availableBalanceCents: number | null; balanceAsOf: string | null;
  role: "cash" | "credit_card" | "investment" | "other_liability" | "excluded"; payInFull: boolean;
  liabilityBalanceSign: -1 | 1 | null; balanceBasis: "needs_review" | "current" | "available";
  pendingTransactionsInBalance: boolean | null; creditCardDueDate: string | null;
};

const roleDescriptions: Record<Account["role"], string> = {
  cash: "Included as spendable household cash.",
  credit_card: "Reserved as an amount owed when paid in full.",
  investment: "Included in net worth only.",
  other_liability: "Included in net worth; payments are handled as obligations.",
  excluded: "Excluded from Safe to SPND and net worth.",
};

export function AccountSettings({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [message, setMessage] = useState("");
  const netWorth = calculateNetWorth(accounts.map((account) => ({ id: account.id, name: account.name, role: account.role, currentBalanceCents: account.balanceCents, liabilityBalanceSign: account.liabilityBalanceSign })));
  async function save(account: Account) {
    setAccounts((items) => items.map((item) => item.id === account.id ? account : item));
    const response = await fetch(`/api/accounts/${account.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(account) });
    const body = (await response.json()) as { message?: string };
    setMessage(response.status === 401 ? "Preview updated. Production sign-in is required to save." : body.message ?? "Saved.");
  }
  return <>
    <section className="card account-net-worth"><span>Connected net worth</span><strong>{netWorth.needsReview ? "Needs review" : formatCurrency(netWorth.netWorthCents)}</strong><small>{netWorth.needsReview ? "Verify liability balance signs" : `${formatCurrency(netWorth.assetCents)} assets − ${formatCurrency(netWorth.liabilityCents)} liabilities`}</small></section>
    <section className="account-treatment-list">
      {accounts.map((account) => {
        const liability = account.role === "credit_card" || account.role === "other_liability";
        const owed = account.liabilityBalanceSign === null ? null : Math.max(0, account.balanceCents * account.liabilityBalanceSign);
        return <article className="card account-treatment-card" key={account.id}>
          <div className="account-treatment-heading"><div><strong>{account.name}</strong><span>{account.institutionName}</span></div><strong>{liability && owed !== null ? `${formatCurrency(owed)} owed` : formatCurrency(account.balanceCents)}</strong></div>
          <dl className="account-balance-details"><div><dt>Current</dt><dd>{formatCurrency(account.balanceCents)}</dd></div><div><dt>Available</dt><dd>{account.availableBalanceCents === null ? "Not supplied" : formatCurrency(account.availableBalanceCents)}</dd></div><div><dt>As of</dt><dd>{account.balanceAsOf ? format(new Date(account.balanceAsOf), "MMM d, h:mm a") : "Unknown"}</dd></div></dl>
          <p className={account.balanceBasis === "needs_review" ? "connection-error" : "account-safe-effect"}>{account.balanceBasis === "needs_review" ? "Needs review before this account can be trusted in the calculation." : roleDescriptions[account.role]}</p>
          <div className="account-treatment-fields">
            <label>Account role<select value={account.role} onChange={(event) => save({ ...account, role: event.target.value as Account["role"], balanceBasis: "needs_review", payInFull: event.target.value === "credit_card" ? account.payInFull : false })}><option value="cash">Cash</option><option value="credit_card">Credit card</option><option value="investment">Investment</option><option value="other_liability">Other liability</option><option value="excluded">Excluded</option></select></label>
            <label>Balance basis<select value={account.balanceBasis} onChange={(event) => save({ ...account, balanceBasis: event.target.value as Account["balanceBasis"] })}><option value="needs_review">Needs review</option><option value="current">Verified current balance</option>{account.role === "cash" && account.availableBalanceCents !== null ? <option value="available">Provider available balance</option> : null}</select></label>
            {(account.role === "cash" || account.role === "credit_card") ? <label>Pending treatment<select value={account.pendingTransactionsInBalance === null ? "unknown" : String(account.pendingTransactionsInBalance)} onChange={(event) => save({ ...account, pendingTransactionsInBalance: event.target.value === "unknown" ? null : event.target.value === "true" })}><option value="unknown">Needs review</option><option value="true">Already reflected in balance</option><option value="false">Not reflected in balance</option></select></label> : null}
            {liability ? <label>Balance sign<select value={account.liabilityBalanceSign ?? ""} onChange={(event) => save({ ...account, liabilityBalanceSign: event.target.value ? Number(event.target.value) as -1 | 1 : null })}><option value="">Needs review</option><option value="-1">Negative means amount owed</option><option value="1">Positive means amount owed</option></select></label> : null}{account.role === "credit_card" ? <><label className="account-checkbox"><input type="checkbox" checked={account.payInFull} onChange={(event) => save({ ...account, payInFull: event.target.checked })} /> Paid in full monthly</label><label>Due date<input type="date" value={account.creditCardDueDate ?? ""} onChange={(event) => save({ ...account, creditCardDueDate: event.target.value || null })} /></label></> : null}
          </div>
        </article>;
      })}
    </section>
    {!accounts.length ? <div className="empty-state card"><h2>No accounts yet</h2><p>Connect SimpleFIN first, then verify how each account affects your plan.</p></div> : null}
    <p className="form-message" role="status">{message}</p>
  </>;
}
