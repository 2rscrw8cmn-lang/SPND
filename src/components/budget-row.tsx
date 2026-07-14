import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/utils";

type BudgetRowProps = {
  category: { name: string; color: string; icon: string; budgetedCents: number; spentCents: number };
  compact?: boolean;
};

export function BudgetRow({ category, compact = false }: BudgetRowProps) {
  const remaining = category.budgetedCents - category.spentCents;
  const percent = Math.min(100, Math.round((category.spentCents / Math.max(1, category.budgetedCents)) * 100));
  return (
    <article className="budget-row">
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
        {!compact ? <p>{formatCurrency(category.spentCents)} of {formatCurrency(category.budgetedCents)} spent</p> : null}
      </div>
      <ChevronRight className="row-chevron" size={22} />
    </article>
  );
}

