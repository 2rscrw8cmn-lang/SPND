"use client";

import { format, parseISO } from "date-fns";
import { CircleCheck, CircleHelp, Link2, Unlink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { TransactionGroup } from "@/components/transaction-group";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, OpenIncomeExpectation, ReceivedIncomeTransaction } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

export function IncomeDeposits({ children, openExpectations, received, receivedCents, unmatched }: { children?: ReactNode; openExpectations: OpenIncomeExpectation[]; received: ReceivedIncomeTransaction[]; receivedCents: number; unmatched: ActivityTransaction[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [matching, setMatching] = useState<ActivityTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const receivedGroups = groupTransactionsByDay(received);
  const unmatchedGroups = groupTransactionsByDay(unmatched);
  const matchedToByTransaction = new Map(received.map((transaction) => [transaction.id, transaction.matchedTo]));

  async function patchPlanItem(plannedItemId: string, updates: { state: "matched" | "confirmed"; matchedTransactionId: string | null }, successMessage: string) {
    setBusy(true);
    const response = await fetch(`/api/plan/${plannedItemId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "planned", ...updates }) });
    const body = await response.json() as { message?: string };
    setBusy(false);
    setMessage(response.ok ? successMessage : body.message ?? "The income match could not be saved.");
    if (response.ok) { setMatching(null); router.refresh(); }
  }

  return <>
    <section className="income-section"><div className="section-line"><h2>Received</h2><span>{formatCurrency(receivedCents)}</span></div>
      {receivedGroups.length ? receivedGroups.map((group) => <TransactionGroup headingId={`income-received-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => {
        const matchedTo = matchedToByTransaction.get(transaction.id) ?? null;
        return <div className="income-deposit" key={transaction.id}>
          <TransactionRow hideDate transaction={matchedTo ? { ...transaction, category: `Matched to ${matchedTo.name}` } : transaction} />
          {matchedTo ? <div className="income-deposit-actions"><span className="income-matched-label"><CircleCheck size={13} /> Counted once</span><button className="text-button" disabled={busy} onClick={() => void patchPlanItem(matchedTo.plannedItemId, { state: "confirmed", matchedTransactionId: null }, `${transaction.merchant} unmatched from ${matchedTo.name}.`)}><Unlink size={13} /> Unmatch</button></div> : null}
        </div>;
      }}</TransactionGroup>) : <p className="compact-empty card">No matched income received this month.</p>}
    </section>
    {children}
    <section className="income-section"><div className="section-line"><h2>Unmatched deposits</h2><span>{unmatched.length}</span></div>
      {unmatchedGroups.length ? unmatchedGroups.map((group) => <TransactionGroup headingId={`income-unmatched-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => <div className="income-deposit" key={transaction.id}>
        <TransactionRow hideDate transaction={transaction} />
        {openExpectations.length ? <div className="income-deposit-actions"><button className="text-button" disabled={busy} onClick={() => setMatching(transaction)}><Link2 size={13} /> Match to expected income</button></div> : null}
      </div>}</TransactionGroup>) : <p className="compact-empty card"><CircleHelp /> No unmatched deposits.</p>}
    </section>
    {matching ? <div className="income-match-picker card" role="dialog" aria-label={`Match ${matching.merchant} to expected income`}>
      <div className="section-line"><h3>Match {matching.merchant} · {formatCurrency(matching.amountCents, { signed: true })}</h3><button className="icon-button" aria-label="Cancel matching" onClick={() => setMatching(null)}><X size={17} /></button></div>
      {openExpectations.map((expectation) => <button className="income-match-option" disabled={busy} key={expectation.id} onClick={() => void patchPlanItem(expectation.id, { state: "matched", matchedTransactionId: matching.id }, `${matching.merchant} matched to ${expectation.name}.`)}><span><strong>{expectation.name}</strong><small>{format(parseISO(expectation.date), "MMM d")}{Math.abs(expectation.amountCents - Math.abs(matching.amountCents)) > 0 ? ` · expected ${formatCurrency(expectation.amountCents)}` : ""}</small></span><strong>{formatCurrency(expectation.amountCents)}</strong></button>)}
      <p className="income-match-note">Matching counts this deposit once against the expected item. You can unmatch it later.</p>
    </div> : null}
    <p className="form-message" role="status">{message}</p>
  </>;
}
