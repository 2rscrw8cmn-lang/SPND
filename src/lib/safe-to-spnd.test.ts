import { describe, expect, it } from "vitest";
import { calculateNetWorth, calculateSafeToSpnd, type SafeAccountInput, type SafeToSpndInput } from "@/lib/safe-to-spnd";

const today = "2026-07-15";
const fresh = "2026-07-15T10:00:00.000Z";
const cash = (overrides: Partial<SafeAccountInput> = {}): SafeAccountInput => ({
  id: "checking", name: "Checking", role: "cash", currentBalanceCents: 500_000,
  availableBalanceCents: null, balanceAsOf: fresh, balanceBasis: "current",
  pendingTransactionsInBalance: true, pendingTransactionCents: 0, payInFull: false,
  liabilityBalanceSign: null, ...overrides,
});

describe("net worth invariant", () => {
  it("reconciles cash plus investments minus normalized liabilities", () => {
    const result = calculateNetWorth([
      cash({ currentBalanceCents: 500_000 }),
      cash({ id: "brokerage", name: "Brokerage", role: "investment", currentBalanceCents: 300_000 }),
      card({ currentBalanceCents: -100_000 }),
      card({ id: "loan", name: "Loan", role: "other_liability", currentBalanceCents: 200_000, liabilityBalanceSign: 1 }),
      cash({ id: "excluded", role: "excluded", currentBalanceCents: 999_999 }),
    ]);
    expect(result).toMatchObject({ assetCents: 800_000, liabilityCents: 300_000, netWorthCents: 500_000, needsReview: false });
  });
});
const card = (overrides: Partial<SafeAccountInput> = {}): SafeAccountInput => ({
  id: "card", name: "Card", role: "credit_card", currentBalanceCents: -100_000,
  availableBalanceCents: null, balanceAsOf: fresh, balanceBasis: "current",
  pendingTransactionsInBalance: true, pendingTransactionCents: 0, payInFull: true,
  liabilityBalanceSign: -1, ...overrides,
});
const base = (overrides: Partial<SafeToSpndInput> = {}): SafeToSpndInput => ({
  accounts: [cash()], obligations: [], goals: [], spendingCategories: [], minimumBufferCents: 0,
  today, nextIncomeDate: "2026-07-25", daysInMonth: 31, ...overrides,
});

describe("calculateSafeToSpnd accounting fixtures", () => {
  it.each([
    { name: "checking only", input: base(), component: "effectiveCash", total: 500_000, safe: 500_000 },
    { name: "checking plus pending debit-card purchase", input: base({ accounts: [cash({ pendingTransactionsInBalance: false, pendingTransactionCents: -12_500 })] }), component: "effectiveCash", total: 487_500, safe: 487_500 },
    { name: "checking plus one paid-in-full card", input: base({ accounts: [cash(), card()] }), component: "cardReserve", total: 100_000, safe: 400_000 },
    { name: "card with posted and pending purchases", input: base({ accounts: [cash(), card({ pendingTransactionsInBalance: false, pendingTransactionCents: -15_000 })] }), component: "cardReserve", total: 115_000, safe: 385_000 },
    { name: "card payment transfer excluded from all reserves", input: base({ accounts: [cash({ currentBalanceCents: 400_000 }), card({ currentBalanceCents: 0 })] }), component: "cardReserve", total: 0, safe: 400_000 },
    { name: "refund does not become income or a reserve", input: base(), component: "variableSpending", total: 0, safe: 500_000 },
    { name: "reimbursement does not become income or a reserve", input: base(), component: "variableSpending", total: 0, safe: 500_000 },
    { name: "obligation is not also in variable spending", input: base({ obligations: [{ id: "rent", name: "Rent", amountCents: 100_000, dueDate: "2026-07-20", fulfilled: false }], spendingCategories: [{ id: "food", name: "Food", monthlyBudgetCents: 31_000, postedSpentCents: 0, pendingSpentCents: 0 }] }), component: "obligations", total: 100_000, safe: 390_000 },
    { name: "goal contribution transfer fulfills the goal", input: base({ goals: [{ id: "save", name: "Savings", amountCents: 50_000, dueDate: "2026-07-20", fulfilled: true }] }), component: "goals", total: 0, safe: 500_000 },
  ])("reconciles $name", ({ input, component, total, safe }) => {
    const result = calculateSafeToSpnd(input);
    expect(result[component as keyof typeof result]).toMatchObject({ totalCents: total });
    expect(result.safeCents).toBe(safe);
  });

  it("shows a negative raw result as a separate shortfall", () => {
    const result = calculateSafeToSpnd(base({ accounts: [cash({ currentBalanceCents: 5_000 })], obligations: [{ id: "rent", name: "Rent", amountCents: 10_000, dueDate: "2026-07-20", fulfilled: false }] }));
    expect(result).toMatchObject({ rawSafeCents: -5_000, safeCents: 0, shortfallCents: 5_000 });
  });

  it("requires review when the next income date is missing", () => {
    const result = calculateSafeToSpnd(base({ nextIncomeDate: null }));
    expect(result.needsReview).toBe(true);
    expect(result.reviewReasons).toContain("Add or confirm the next expected income date.");
  });

  it.each([
    ["stale", cash({ balanceAsOf: "2026-07-10T10:00:00.000Z" })],
    ["ambiguous", cash({ balanceBasis: "needs_review" })],
  ])("requires review for a %s account balance", (_name, account) => {
    expect(calculateSafeToSpnd(base({ accounts: [account] })).needsReview).toBe(true);
  });

  it("uses available cash without subtracting pending transactions again", () => {
    const result = calculateSafeToSpnd(base({ accounts: [cash({ balanceBasis: "available", availableBalanceCents: 475_000, pendingTransactionsInBalance: true, pendingTransactionCents: -25_000 })] }));
    expect(result.effectiveCash.totalCents).toBe(475_000);
  });

  it("never includes investment balances in Safe to SPND", () => {
    const result = calculateSafeToSpnd(base({ accounts: [cash(), cash({ id: "brokerage", name: "Brokerage", role: "investment", currentBalanceCents: 2_000_000 })] }));
    expect(result.effectiveCash.totalCents).toBe(500_000);
    expect(result.safeCents).toBe(500_000);
  });
});
