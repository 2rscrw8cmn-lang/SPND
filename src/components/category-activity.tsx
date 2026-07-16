"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryPickerSheet } from "@/components/category-picker";
import { TransactionGroup } from "@/components/transaction-group";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory, BudgetTransaction } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";

type MoveState = { summary: BudgetTransaction; detail: ActivityTransaction; index: number };
type UndoState = MoveState & { updatedAt: string };

export function CategoryActivity({ allCategories, category, month, onAggregateDelta, onTransaction }: { allCategories: BudgetCategory[]; category: BudgetCategory; month?: string; onAggregateDelta?: (status: "pending" | "posted", deltaCents: number) => void; onTransaction: (transaction: BudgetTransaction) => void }) {
  const [transactions, setTransactions] = useState(category.recentTransactions);
  const [message, setMessage] = useState("");
  const [moving, setMoving] = useState<MoveState | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const groups = groupTransactionsByDay(transactions);

  async function fetchDetail(transaction: BudgetTransaction) {
    const response = await fetch(`/api/activity?transaction=${transaction.id}`);
    const body = await response.json() as { transactions?: ActivityTransaction[] };
    return response.ok ? body.transactions?.[0] ?? null : null;
  }

  async function review(transaction: BudgetTransaction) {
    const original = transaction;
    setTransactions((items) => items.map((item) => item.id === transaction.id ? { ...item, reviewStatus: "reviewed" } : item));
    setMessage(`${transaction.merchant} marked reviewed.`);
    const detail = await fetchDetail(transaction);
    const response = detail ? await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed: true, expectedUpdatedAt: detail.updatedAt }) }) : null;
    if (!response?.ok) {
      setTransactions((items) => items.map((item) => item.id === original.id ? original : item));
      setMessage("Review could not be saved. The transaction was restored.");
    }
  }

  async function beginMove(transaction: BudgetTransaction) {
    const detail = await fetchDetail(transaction);
    if (!detail) { setMessage("Transaction details could not be loaded."); return; }
    if (detail.allocations.length > 1) { onTransaction(transaction); return; }
    setMoving({ summary: transaction, detail, index: transactions.findIndex((item) => item.id === transaction.id) });
  }

  async function moveTo(destination: BudgetCategory | null) {
    const current = moving;
    if (!current || !destination || destination.id === category.id) { setMoving(null); return; }
    setMoving(null);
    setTransactions((items) => items.filter((item) => item.id !== current.summary.id));
    onAggregateDelta?.(current.summary.status, -Math.abs(current.summary.amountCents));
    setMessage(`Moved to ${destination.name}.`);
    const response = await fetch(`/api/transactions/${current.summary.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: destination.id, expectedUpdatedAt: current.detail.updatedAt }) });
    const body = await response.json() as { transaction?: { updated_at?: string }; message?: string };
    if (!response.ok || !body.transaction?.updated_at) {
      setTransactions((items) => insertAt(items, current.summary, current.index));
      onAggregateDelta?.(current.summary.status, Math.abs(current.summary.amountCents));
      setMessage(body.message ?? "Move could not be saved. The transaction was restored.");
      return;
    }
    setUndo({ ...current, updatedAt: body.transaction.updated_at });
  }

  async function undoMove() {
    const current = undo;
    if (!current) return;
    setUndo(null);
    setTransactions((items) => insertAt(items, current.summary, current.index));
    onAggregateDelta?.(current.summary.status, Math.abs(current.summary.amountCents));
    setMessage(`Restored to ${category.name}.`);
    const response = await fetch(`/api/transactions/${current.summary.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: category.id, expectedUpdatedAt: current.updatedAt }) });
    if (!response.ok) {
      setTransactions((items) => items.filter((item) => item.id !== current.summary.id));
      onAggregateDelta?.(current.summary.status, -Math.abs(current.summary.amountCents));
      setMessage("Undo could not be saved; the move remains in place.");
    }
  }

  return <section className="category-activity"><div className="section-line"><h3>Recent transactions</h3><Link href={`/activity?category=${category.id}${month ? `&month=${month.slice(0,7)}` : ""}`}>View all</Link></div>{groups.length ? <div className="activity-groups category-transaction-groups">{groups.map((group) => <TransactionGroup headingId={`category-day-${category.id}-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => <TransactionRow hideDate key={transaction.id} onChooseCategory={() => void beginMove(transaction)} onReview={transaction.reviewStatus === "needs_review" ? () => void review(transaction) : undefined} onSelect={() => onTransaction(transaction)} transaction={{ ...transaction, category: category.name, color: category.color, allocationCount: 1 }} />}</TransactionGroup>)}</div> : <p className="compact-empty">No transactions in this month.</p>}<p className="sr-only" role="status">{message}</p>
    {moving ? <CategoryPickerSheet categories={allCategories.filter((item) => item.behaviorType !== "income" && item.behaviorType !== "excluded")} eyebrow="Move transaction" label={`Choose category for ${moving.summary.merchant}`} onClose={() => setMoving(null)} onSelect={(destination) => void moveTo(destination)} selectedId={category.id} title={moving.summary.merchant} /> : null}
    {undo ? <div className="undo-toast" role="status"><span>{message}</span><button onClick={() => void undoMove()}>Undo</button></div> : null}
  </section>;
}

function insertAt(items: BudgetTransaction[], transaction: BudgetTransaction, index: number) {
  const next = items.filter((item) => item.id !== transaction.id);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, transaction);
  return next;
}
