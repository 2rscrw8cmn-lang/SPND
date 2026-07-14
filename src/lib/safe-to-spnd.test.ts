import { describe, expect, it } from "vitest";
import { calculateSafeToSpnd } from "@/lib/safe-to-spnd";

describe("calculateSafeToSpnd", () => {
  it("reserves prorated expected category spending only until next income", () => {
    const result = calculateSafeToSpnd({
      availableCashCents: 500_000,
      billsDueCents: 100_000,
      pendingExpenseCents: 10_000,
      minimumBufferCents: 75_000,
      daysUntilIncome: 10,
      daysInMonth: 30,
      categories: [{ id: "food", name: "Food", monthlyBudgetCents: 90_000, postedSpentCents: 20_000 }],
      inputsComplete: true,
    });
    expect(result.categoryReserveCents).toBe(30_000);
    expect(result.safeCents).toBe(285_000);
    expect(result.needsReview).toBe(false);
  });

  it("never presents a negative amount as spendable", () => {
    const result = calculateSafeToSpnd({
      availableCashCents: 5_000,
      billsDueCents: 10_000,
      pendingExpenseCents: 0,
      minimumBufferCents: 0,
      daysUntilIncome: 0,
      daysInMonth: 31,
      categories: [],
      inputsComplete: false,
    });
    expect(result.safeCents).toBe(0);
    expect(result.rawSafeCents).toBe(-5_000);
    expect(result.needsReview).toBe(true);
  });
});

