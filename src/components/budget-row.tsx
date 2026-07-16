import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { categoryVisualStyle } from "@/lib/category-style";
import { formatCurrency } from "@/lib/utils";

type BudgetRowProps = {
  category: {
    name: string;
    color: string;
    icon: string;
    paletteKey?: string;
    behaviorType?: "spending" | "obligation" | "goal" | "income" | "excluded";
    budgetedCents: number;
    spentCents: number;
    pendingCents?: number;
    recentTransactions?: unknown[];
  };
  compact?: boolean;
  onSelect?: () => void;
};

export function BudgetRow({
  category,
  compact = false,
  onSelect,
}: BudgetRowProps) {
  const used = category.spentCents + (category.pendingCents ?? 0);
  const remaining = category.budgetedCents - used;
  const percent = Math.min(
    100,
    Math.round((used / Math.max(1, category.budgetedCents)) * 100),
  );
  const isUnbudgetedSpend = category.budgetedCents === 0 && used > 0;
  const state =
    isUnbudgetedSpend || remaining < 0
      ? "over"
      : category.budgetedCents === 0
        ? "empty"
        : percent >= 80
          ? "approaching"
          : "active";
  const transactionCount = category.recentTransactions?.length ?? 0;
  const transactionLabel = transactionCount
    ? `${transactionCount} transaction${transactionCount === 1 ? "" : "s"}`
    : "No transactions";
  const labels =
    category.behaviorType === "obligation"
      ? { used: "paid", total: "due", remaining: "remaining" }
      : category.behaviorType === "goal"
        ? { used: "contributed", total: "target", remaining: "remaining" }
        : { used: "spent", total: "budget", remaining: "left" };
  return (
    <article
      className={`budget-row ${state}${isUnbudgetedSpend ? "unbudgeted" : ""}`}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") onSelect();
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div
        className="category-disc"
        style={categoryVisualStyle(category) as React.CSSProperties}
      >
        <CategoryIcon name={category.icon} />
      </div>
      <div className="budget-row-main">
        <div className="budget-row-top">
          <div className="budget-row-identity">
            <h3>{category.name}</h3>
            <p>
              {compact
                ? transactionLabel
                : category.pendingCents
                  ? `${transactionLabel} · pending included`
                  : transactionLabel}
            </p>
          </div>
          <div className="budget-amount">
            <strong>
              {category.budgetedCents === 0
                ? `${formatCurrency(used, { compact: true })} ${labels.used}`
                : `${formatCurrency(used, { compact: true })} of ${formatCurrency(category.budgetedCents, { compact: true })}`}
            </strong>
            <span className={state === "over" ? "negative" : ""}>
              {isUnbudgetedSpend
                ? "unbudgeted"
                : category.budgetedCents === 0
                  ? `add ${labels.total}`
                  : `${formatCurrency(Math.abs(remaining), { compact: true })} ${remaining < 0 ? "over" : labels.remaining}`}
            </span>
          </div>
        </div>
        <div
          className="progress-track"
          aria-label={`${percent}% of ${category.name} budget used`}
        >
          <span
            style={{ width: `${percent}%`, backgroundColor: category.color }}
          />
        </div>
      </div>
      <ChevronRight className="row-chevron" size={22} />
    </article>
  );
}
