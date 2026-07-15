export type AccountRole = "cash" | "credit_card" | "investment" | "other_liability" | "excluded";
export type BalanceBasisState = "needs_review" | "current" | "available";

export type SafeAccountInput = {
  id: string;
  name: string;
  role: AccountRole;
  currentBalanceCents: number;
  availableBalanceCents: number | null;
  balanceAsOf: string | null;
  balanceBasis: BalanceBasisState;
  pendingTransactionsInBalance: boolean | null;
  pendingTransactionCents: number;
  payInFull: boolean;
  liabilityBalanceSign: -1 | 1 | null;
};

export type ReserveItemInput = { id: string; name: string; amountCents: number; dueDate: string; fulfilled: boolean };
export type SpendingReserveInput = {
  id: string;
  name: string;
  monthlyBudgetCents: number;
  postedSpentCents: number;
  pendingSpentCents: number;
};

export type SafeToSpndInput = {
  accounts: SafeAccountInput[];
  obligations: ReserveItemInput[];
  goals: ReserveItemInput[];
  spendingCategories: SpendingReserveInput[];
  minimumBufferCents: number;
  today: string;
  nextIncomeDate: string | null;
  daysInMonth: number;
  staleAfterHours?: number;
};

export type CalculationRecord = { id: string; name: string; amountCents: number; detail?: string };
export type CalculationComponent = { totalCents: number; records: CalculationRecord[] };

export type SafeToSpndResult = {
  nextIncomeDate: string | null;
  safeCents: number;
  rawSafeCents: number;
  shortfallCents: number;
  needsReview: boolean;
  reviewReasons: string[];
  effectiveCash: CalculationComponent;
  cardReserve: CalculationComponent;
  obligations: CalculationComponent;
  goals: CalculationComponent;
  variableSpending: CalculationComponent;
  minimumBuffer: CalculationComponent;
};

export type NetWorthAccountInput = Pick<SafeAccountInput, "id" | "name" | "role" | "currentBalanceCents" | "liabilityBalanceSign">;

export function calculateNetWorth(accounts: NetWorthAccountInput[]) {
  const assets = accounts.filter((account) => account.role === "cash" || account.role === "investment").map((account) => ({ id: account.id, name: account.name, amountCents: account.currentBalanceCents }));
  const liabilityAccounts = accounts.filter((account) => account.role === "credit_card" || account.role === "other_liability");
  const liabilities = liabilityAccounts.map((account) => ({ id: account.id, name: account.name, amountCents: account.liabilityBalanceSign === null ? 0 : Math.max(0, account.currentBalanceCents * account.liabilityBalanceSign) }));
  const assetCents = assets.reduce((sum, account) => sum + account.amountCents, 0);
  const liabilityCents = liabilities.reduce((sum, account) => sum + account.amountCents, 0);
  return { assetCents, liabilityCents, netWorthCents: assetCents - liabilityCents, assets, liabilities, needsReview: liabilityAccounts.some((account) => account.liabilityBalanceSign === null) };
}

function total(records: CalculationRecord[]): CalculationComponent {
  return { records, totalCents: records.reduce((sum, record) => sum + record.amountCents, 0) };
}

function dateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).getTime();
}

export function calculateSafeToSpnd(input: SafeToSpndInput): SafeToSpndResult {
  const reviewReasons: string[] = [];
  const staleAfter = (input.staleAfterHours ?? 48) * 60 * 60_000;
  const todayTime = dateOnly(input.today);
  const nextIncomeTime = input.nextIncomeDate ? dateOnly(input.nextIncomeDate) : null;
  if (nextIncomeTime === null) reviewReasons.push("Add or confirm the next expected income date.");

  const relevantAccounts = input.accounts.filter((account) => account.role === "cash" || (account.role === "credit_card" && account.payInFull));
  for (const account of relevantAccounts) {
    if (account.balanceBasis === "needs_review") reviewReasons.push(`${account.name} needs a verified balance basis.`);
    if (!account.balanceAsOf || todayTime - new Date(account.balanceAsOf).getTime() > staleAfter) reviewReasons.push(`${account.name} has a stale balance.`);
    if (account.role === "cash" && account.balanceBasis === "current" && account.pendingTransactionsInBalance === null) reviewReasons.push(`${account.name} needs pending-balance verification.`);
    if (account.role === "credit_card" && account.liabilityBalanceSign === null) reviewReasons.push(`${account.name} needs its balance sign verified.`);
    if (account.role === "credit_card" && account.pendingTransactionsInBalance === null) reviewReasons.push(`${account.name} needs pending-balance verification.`);
  }

  const effectiveCashRecords = input.accounts.filter((account) => account.role === "cash").map((account) => {
    let amountCents = account.balanceBasis === "available" && account.availableBalanceCents !== null
      ? account.availableBalanceCents
      : account.currentBalanceCents;
    if (account.balanceBasis === "current" && account.pendingTransactionsInBalance === false) amountCents += account.pendingTransactionCents;
    return { id: account.id, name: account.name, amountCents, detail: account.balanceBasis === "available" ? "Provider available balance" : "Current balance with verified pending treatment" };
  });

  const cardReserveRecords = input.accounts.filter((account) => account.role === "credit_card" && account.payInFull).map((account) => {
    const postedLiability = account.liabilityBalanceSign === null ? 0 : Math.max(0, account.currentBalanceCents * account.liabilityBalanceSign);
    const unmatchedPending = account.pendingTransactionsInBalance === false ? Math.max(0, -account.pendingTransactionCents) : 0;
    return { id: account.id, name: account.name, amountCents: postedLiability + unmatchedPending, detail: unmatchedPending ? `Includes ${unmatchedPending} cents of pending purchases` : "Normalized amount owed" };
  });

  const dueBeforeIncome = (item: ReserveItemInput) => !item.fulfilled && nextIncomeTime !== null && dateOnly(item.dueDate) <= nextIncomeTime;
  const obligationRecords = input.obligations.filter(dueBeforeIncome).map((item) => ({ id: item.id, name: item.name, amountCents: Math.abs(item.amountCents), detail: `Due ${item.dueDate}` }));
  const goalRecords = input.goals.filter(dueBeforeIncome).map((item) => ({ id: item.id, name: item.name, amountCents: Math.abs(item.amountCents), detail: `Planned ${item.dueDate}` }));

  const daysUntilIncome = nextIncomeTime === null ? 0 : Math.max(0, Math.ceil((nextIncomeTime - todayTime) / 86_400_000));
  const fraction = daysUntilIncome / Math.max(1, input.daysInMonth);
  const variableRecords = input.spendingCategories.map((category) => {
    const remaining = Math.max(0, category.monthlyBudgetCents - category.postedSpentCents - category.pendingSpentCents);
    const proratedNeed = Math.round(category.monthlyBudgetCents * fraction);
    return { id: category.id, name: category.name, amountCents: Math.min(remaining, proratedNeed), detail: `${daysUntilIncome} days until income` };
  }).filter((record) => record.amountCents > 0);

  const effectiveCash = total(effectiveCashRecords);
  const cardReserve = total(cardReserveRecords);
  const obligations = total(obligationRecords);
  const goals = total(goalRecords);
  const variableSpending = total(variableRecords);
  const minimumBuffer = total(input.minimumBufferCents > 0 ? [{ id: "minimum-buffer", name: "Household minimum cash buffer", amountCents: input.minimumBufferCents }] : []);
  const rawSafeCents = effectiveCash.totalCents - cardReserve.totalCents - obligations.totalCents - goals.totalCents - variableSpending.totalCents - minimumBuffer.totalCents;

  return {
    nextIncomeDate: input.nextIncomeDate,
    safeCents: Math.max(0, rawSafeCents),
    rawSafeCents,
    shortfallCents: Math.max(0, -rawSafeCents),
    needsReview: reviewReasons.length > 0,
    reviewReasons: [...new Set(reviewReasons)],
    effectiveCash,
    cardReserve,
    obligations,
    goals,
    variableSpending,
    minimumBuffer,
  };
}
