import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/utils";

type BudgetRowProps = {
  category: { name: string; color: string; icon: string; budgetedCents: number; spentCents: number; pendingCents?: number; recentTransactions?: unknown[] };
  compact?: boolean;
  onSelect?: () => void;
};

export function BudgetRow({ category, compact = false, onSelect }: BudgetRowProps) {
  const used = category.spentCents + (category.pendingCents ?? 0);
  const remaining = category.budgetedCents - used;
  const percent = Math.min(100, Math.round((used / Math.max(1, category.budgetedCents)) * 100));
  const isUnbudgetedSpend = category.budgetedCents === 0 && used > 0;
  const state = isUnbudgetedSpend || remaining < 0 ? "over" : category.budgetedCents === 0 ? "empty" : percent >= 80 ? "approaching" : "active";
  return (
    <article className={`budget-row ${state}`} onClick={onSelect} onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") onSelect(); } : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}>
      <div className="category-disc" style={{ "--category": category.color } as React.CSSProperties}>
        <CategoryIcon name={category.icon} />
      </div>
      <div className="budget-row-main">
        <div className="budget-row-top">
          <h3>{category.name}</h3>
          <div className="budget-amount">
            <strong className={state === "over" ? "negative" : ""}>{isUnbudgetedSpend ? formatCurrency(used, { compact: true }) : category.budgetedCents === 0 ? "—" : formatCurrency(Math.abs(remaining), { compact: true })}</strong>
            <span>{isUnbudgetedSpend ? "unbudgeted" : category.budgetedCents === 0 ? "add budget" : remaining < 0 ? "over" : "left"}</span>
          </div>
        </div>
        <div className="progress-track" aria-label={`${percent}% of ${category.name} budget used`}>
          <span style={{ width: `${percent}%`, backgroundColor: category.color }} />
        </div>
        <p>{compact ? `${category.recentTransactions?.length || "No"} transaction${category.recentTransactions?.length === 1 ? "" : "s"}` : `${formatCurrency(category.spentCents)} spent${category.pendingCents ? ` · ${formatCurrency(category.pendingCents)} pending` : ""} · ${formatCurrency(category.budgetedCents)} budget`}</p>
      </div>
      <ChevronRight className="row-chevron" size={22} />
    </article>
  );
}
