"use client";
import Link from "next/link";
import type { BudgetCategory, BudgetTransaction } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

export function CategoryActivity({ category, month, onTransaction }: { category: BudgetCategory; month?: string; onTransaction: (transaction: BudgetTransaction) => void }) {
  const groups = groupTransactionsByDay(category.recentTransactions);
  return <section className="category-activity"><div className="section-line"><h3>Recent transactions</h3><Link href={`/activity?category=${category.id}${month ? `&month=${month.slice(0,7)}` : ""}`}>View all</Link></div>{groups.length ? groups.map((group) => <div className="category-day" key={group.key}><h4>{group.label}</h4>{group.transactions.map((transaction) => <button type="button" key={transaction.id} onClick={() => onTransaction(transaction)}><span><strong>{transaction.merchant}</strong><small>{transaction.status}{transaction.reviewStatus === "needs_review" ? " · needs review" : ""}</small></span><strong>{formatCurrency(transaction.amountCents, { signed: true })}</strong></button>)}</div>) : <p className="compact-empty">No transactions in this month.</p>}</section>;
}
