export type CategoryReserveInput = {
  id: string;
  name: string;
  monthlyBudgetCents: number;
  postedSpentCents: number;
};

export type SafeToSpndInput = {
  availableCashCents: number;
  billsDueCents: number;
  pendingExpenseCents: number;
  minimumBufferCents: number;
  daysUntilIncome: number;
  daysInMonth: number;
  categories: CategoryReserveInput[];
  inputsComplete: boolean;
};

export type SafeToSpndResult = {
  safeCents: number;
  categoryReserveCents: number;
  rawSafeCents: number;
  needsReview: boolean;
  categoryReserves: Array<{ id: string; name: string; reserveCents: number }>;
};

export function calculateSafeToSpnd(input: SafeToSpndInput): SafeToSpndResult {
  const fraction = Math.max(0, input.daysUntilIncome) / Math.max(1, input.daysInMonth);
  const categoryReserves = input.categories.map((category) => {
    const remaining = Math.max(0, category.monthlyBudgetCents - category.postedSpentCents);
    const prorated = Math.round(category.monthlyBudgetCents * fraction);
    return {
      id: category.id,
      name: category.name,
      reserveCents: Math.min(remaining, prorated),
    };
  });
  const categoryReserveCents = categoryReserves.reduce((total, item) => total + item.reserveCents, 0);
  const rawSafeCents =
    input.availableCashCents -
    input.billsDueCents -
    input.pendingExpenseCents -
    input.minimumBufferCents -
    categoryReserveCents;

  return {
    safeCents: Math.max(0, rawSafeCents),
    categoryReserveCents,
    rawSafeCents,
    needsReview: !input.inputsComplete,
    categoryReserves,
  };
}

