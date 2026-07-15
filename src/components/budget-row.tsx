import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/utils";

type BudgetRowProps = {
  category: { name: string; color: string; icon: string; budgetedCents: number; spentCents: number; pendingCents?: number };
  compact?: boolean;
  onSelect?: () => void;
};

export function BudgetRow({ category, compact = false, onSelect }: BudgetRowProps) {
  const remaining = category.budgetedCents - category.spentCents;
  const percent = Math.min(100, Math.round((category.spentCents / Math.max(1, category.budgetedCents)) * 100));
  return (
    <article className="budget-row" onClick={onSelect} onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") onSelect(); } : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}>
      <div className="category-disc" style={{ "--category": category.color } as React.CSSProperties}>
        <CategoryIcon name={category.icon} />
      </div>
      <div className="budget-row-main">
        <div className="budget-row-top">
          <h3>{category.name}</h3>
          <div className="budget-amount">
            <strong className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining, { compact: true })}</strong>
            <span>{remaining < 0 ? "over" : "left"}</span>
          </div>
        </div>
        <div className="progress-track" aria-label={`${percent}% of ${category.name} budget used`}>
          <span style={{ width: `${percent}%`, backgroundColor: category.color }} />
        </div>
        {!compact ? <p>{formatCurrency(category.spentCents)} spent{category.pendingCents ? ` · ${formatCurrency(category.pendingCents)} pending` : ""} · {formatCurrency(category.budgetedCents)} budget</p> : null}
      </div>
      <ChevronRight className="row-chevron" size={22} />
    </article>
  );
}
