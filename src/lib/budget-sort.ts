export type BudgetSortItem = { name: string; budgetedCents: number; spentCents: number; pendingCents: number };

export function budgetUrgency(item: BudgetSortItem) {
  if (item.budgetedCents <= 0) return 3;
  const used = (item.spentCents + item.pendingCents) / item.budgetedCents;
  if (used > 1) return 0;
  if (used >= 0.8) return 1;
  return 2;
}

export function sortBudgetCategories<T extends BudgetSortItem>(items: T[]) {
  return [...items].sort((a, b) => budgetUrgency(a) - budgetUrgency(b)
    || ((b.spentCents + b.pendingCents) / Math.max(1, b.budgetedCents)) - ((a.spentCents + a.pendingCents) / Math.max(1, a.budgetedCents))
    || a.name.localeCompare(b.name));
}
