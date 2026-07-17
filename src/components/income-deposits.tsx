"use client";

import { format, parseISO } from "date-fns";
import { CircleCheck, CircleHelp, Link2, Unlink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { TransactionGroup } from "@/components/transaction-group";
import { TransactionRow } from "@/components/transaction-row";
import { TransactionDetail } from "@/components/transaction-detail";
import type { ActivityTransaction, BudgetCategory, OpenIncomeExpectation, ReceivedIncomeTransaction } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

export function IncomeDeposits({ categories, children, openExpectations, received, receivedCents, unmatched }: { categories: BudgetCategory[]; children?: ReactNode; openExpectations: OpenIncomeExpectation[]; received: ReceivedIncomeTransaction[]; receivedCents: number; unmatched: ActivityTransaction[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [matching, setMatching] = useState<{ transaction: ActivityTransaction; previousOccurrenceId?: string } | null>(null);
  const [undoAction, setUndoAction] = useState<{ message: string; run: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ActivityTransaction | null>(null);
  const receivedGroups = groupTransactionsByDay(received);
  const unmatchedGroups = groupTransactionsByDay(unmatched);
  const matchedToByTransaction = new Map(received.map((transaction) => [transaction.id, transaction.matchedTo]));

  async function unmatch(plannedItemId: string, transaction: ActivityTransaction, successMessage: string, recordUndo = true) {
    setBusy(true);
    const response = await fetch(`/api/income-matches/${plannedItemId}`, { method: "DELETE" });
    const body = await response.json() as { message?: string };
    setBusy(false);
    setMessage(response.ok ? "" : body.message ?? "The income match could not be saved.");
    if (response.ok) {
      setMatching(null);
      setUndoAction(recordUndo ? { message: successMessage, run: () => { setUndoAction(null); void match(plannedItemId, transaction, undefined, false); } } : null);
      router.refresh();
    }
  }

  async function match(occurrenceId: string, transaction: ActivityTransaction, previousOccurrenceId?: string, recordUndo = true) {
    setBusy(true);
    const response = await fetch("/api/income-matches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occurrenceId, transactionId: transaction.id, previousOccurrenceId }) });
    const body = await response.json() as { message?: string };
    setBusy(false);
    setMessage(response.ok ? "" : body.message ?? "The income match could not be saved.");
    if (response.ok) {
      setMatching(null);
      setUndoAction(recordUndo ? {
        message: body.message ?? "Deposit matched.",
        run: () => {
          setUndoAction(null);
          if (previousOccurrenceId) void match(previousOccurrenceId, transaction, occurrenceId, false);
          else void unmatch(occurrenceId, transaction, "Match removed.", false);
        },
      } : null);
      router.refresh();
    }
  }

  return <>
    <section className="income-section"><div className="section-line"><h2>Received</h2><span>{formatCurrency(receivedCents)}</span></div>
      {receivedGroups.length ? receivedGroups.map((group) => <TransactionGroup headingId={`income-received-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => {
        const matchedTo = matchedToByTransaction.get(transaction.id) ?? null;
        return <div className="income-deposit" key={transaction.id}>
          <TransactionRow hideDate onSelect={() => setSelected(transaction)} transaction={matchedTo ? { ...transaction, category: `Matched to ${matchedTo.name}` } : transaction} />
          {matchedTo ? <div className="income-deposit-actions"><span className="income-matched-label"><CircleCheck size={13} /> Counted once</span>{openExpectations.length ? <button className="text-button" disabled={busy} onClick={() => setMatching({ transaction, previousOccurrenceId: matchedTo.plannedItemId })}><Link2 size={13} /> Change match</button> : null}<button className="text-button" disabled={busy} onClick={() => void unmatch(matchedTo.plannedItemId, transaction, `${transaction.merchant} unmatched from ${matchedTo.name}.`)}><Unlink size={13} /> Unmatch</button></div> : openExpectations.length ? <div className="income-deposit-actions"><span className="income-matched-label">Income category</span><button className="text-button" disabled={busy} onClick={() => setMatching({ transaction })}><Link2 size={13} /> Match to expected income</button></div> : null}
        </div>;
      }}</TransactionGroup>) : <p className="compact-empty card">No matched income received this month.</p>}
    </section>
    {children}
    <section className="income-section"><div className="section-line"><h2>Unmatched deposits</h2><span>{unmatched.length}</span></div>
      {unmatchedGroups.length ? unmatchedGroups.map((group) => <TransactionGroup headingId={`income-unmatched-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => <div className="income-deposit" key={transaction.id}>
        <TransactionRow hideDate onSelect={() => setSelected(transaction)} transaction={transaction} />
        {openExpectations.length ? <div className="income-deposit-actions"><button className="text-button" disabled={busy} onClick={() => setMatching({ transaction })}><Link2 size={13} /> Match to expected income</button></div> : null}
      </div>}</TransactionGroup>) : <p className="compact-empty card"><CircleHelp /> No unmatched deposits.</p>}
    </section>
    {matching ? <div className="income-match-picker card" role="dialog" aria-label={`Match ${matching.transaction.merchant} to expected income`}>
      <div className="section-line"><h3>Match {matching.transaction.merchant} · {formatCurrency(matching.transaction.amountCents, { signed: true })}</h3><button className="icon-button" aria-label="Cancel matching" onClick={() => setMatching(null)}><X size={17} /></button></div>
      {openExpectations.map((expectation) => <button className="income-match-option" disabled={busy} key={expectation.id} onClick={() => void match(expectation.id, matching.transaction, matching.previousOccurrenceId)}><span><strong>{expectation.name}</strong><small>{format(parseISO(expectation.date), "MMM d")}{Math.abs(expectation.amountCents - Math.abs(matching.transaction.amountCents)) > 0 ? ` · expected ${formatCurrency(expectation.amountCents)}` : ""}</small></span><strong>{formatCurrency(expectation.amountCents)}</strong></button>)}
      <p className="income-match-note">Matching counts this deposit once against the expected item. You can unmatch it later.</p>
    </div> : null}
    {undoAction ? <div className="undo-toast" role="status"><span>{undoAction.message}</span><button onClick={undoAction.run}>Undo</button></div> : null}
    <p className="form-message" role="status">{message}</p>
    {selected ? <TransactionDetail transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); router.refresh(); }} /> : null}
  </>;
}
