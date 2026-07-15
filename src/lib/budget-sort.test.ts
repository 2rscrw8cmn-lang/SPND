import { describe, expect, it } from "vitest";
import { sortBudgetCategories } from "@/lib/budget-sort";

describe("sortBudgetCategories", () => {
  it("orders over, approaching, active, then empty", () => {
    const items = [
      { name: "Empty", budgetedCents: 0, spentCents: 0, pendingCents: 0 },
      { name: "Active", budgetedCents: 10000, spentCents: 3000, pendingCents: 0 },
      { name: "Over", budgetedCents: 10000, spentCents: 11000, pendingCents: 0 },
      { name: "Approaching", budgetedCents: 10000, spentCents: 7500, pendingCents: 1000 },
      { name: "Spent without budget", budgetedCents: 0, spentCents: 1200, pendingCents: 0 },
    ];
    expect(sortBudgetCategories(items).map((item) => item.name)).toEqual(["Spent without budget", "Over", "Approaching", "Active", "Empty"]);
  });
});
