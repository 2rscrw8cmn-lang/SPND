import { describe, expect, it } from "vitest";
import { allocationsBalance } from "@/lib/transaction-updates";

describe("transaction allocation validation", () => {
  it("accepts expense splits that exactly equal the imported amount", () => {
    expect(allocationsBalance(-7421, [{ categoryId: "a", amountCents: -4000 }, { categoryId: "b", amountCents: -3421 }])).toBe(true);
  });

  it("rejects rounding differences and sign mismatches", () => {
    expect(allocationsBalance(-7421, [{ categoryId: "a", amountCents: -4000 }, { categoryId: "b", amountCents: -3420 }])).toBe(false);
    expect(allocationsBalance(-7421, [{ categoryId: "a", amountCents: 4000 }, { categoryId: "b", amountCents: 3421 }])).toBe(false);
  });

  it("rejects zero-value allocation rows", () => {
    expect(allocationsBalance(-7421, [{ categoryId: "a", amountCents: -7421 }, { categoryId: "b", amountCents: 0 }])).toBe(false);
  });
});
