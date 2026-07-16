import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils";

export type TransactionGroupItem = { id: string; amountCents: number; reviewStatus: "needs_review" | "reviewed"; excluded?: boolean };

export function TransactionGroup<T extends TransactionGroupItem>({ headingId, label, transactions, action, children }: { headingId: string; label: string; transactions: T[]; action?: ReactNode; children: (transaction: T) => ReactNode }) {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  return <section className="activity-day-group transaction-group" aria-labelledby={headingId}>
    <header className="activity-day-heading transaction-group-heading"><div><h2 id={headingId}>{label}</h2><span>{transactions.length} transaction{transactions.length === 1 ? "" : "s"} · {formatCurrency(total, { signed: true })}</span></div>{action}</header>
    <div className="activity-day-card transaction-group-list">{transactions.map(children)}</div>
  </section>;
}
