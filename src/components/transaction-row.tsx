import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function TransactionRow({ transaction, onSelect }: { transaction: { merchant: string; category: string; amountCents: number; date: string; status: "pending" | "posted"; color: string }; onSelect?: () => void }) {
  return (
    <article className="transaction-row" onClick={onSelect} onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") onSelect(); } : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}>
      <div className="merchant-mark" style={{ "--merchant": transaction.color } as React.CSSProperties} aria-hidden="true">
        {transaction.merchant.slice(0, 1)}
      </div>
      <div className="transaction-main">
        <strong>{transaction.merchant}</strong>
        <span>{transaction.category}</span>
      </div>
      <div className="transaction-amount">
        <strong className={transaction.amountCents > 0 ? "income" : ""}>{formatCurrency(transaction.amountCents, { signed: true })}</strong>
        <span>{transaction.status === "pending" ? <em>Pending</em> : transaction.date}</span>
      </div>
      <ChevronRight className="row-chevron" size={20} />
    </article>
  );
}
