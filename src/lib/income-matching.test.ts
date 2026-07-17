import { describe, expect, it } from "vitest";
import { chooseAutomaticIncomeMatch, type MatchableIncomeOccurrence, type MatchableIncomeTransaction } from "@/lib/income-matching";

const transaction = (overrides: Partial<MatchableIncomeTransaction> = {}): MatchableIncomeTransaction => ({
  id: "transaction",
  normalizedMerchant: "acme payroll",
  amountCents: 200_000,
  date: "2026-07-15",
  status: "posted",
  excluded: false,
  isTransfer: false,
  ...overrides,
});

const occurrence = (overrides: Partial<MatchableIncomeOccurrence> = {}): MatchableIncomeOccurrence => ({
  id: "occurrence",
  sourceId: "source",
  normalizedMerchant: "acme payroll",
  autoMatchEnabled: true,
  amountCents: 200_000,
  date: "2026-07-16",
  acceptableVarianceCents: null,
  ...overrides,
});

describe("automatic income matching", () => {
  it("matches one exact, identified occurrence within five days", () => {
    expect(chooseAutomaticIncomeMatch(transaction(), [occurrence()])).toEqual({ kind: "match", occurrenceId: "occurrence", sourceId: "source" });
  });

  it("treats null variance as exact and honors configured variance", () => {
    expect(chooseAutomaticIncomeMatch(transaction({ amountCents: 200_001 }), [occurrence()])).toEqual({ kind: "none", reason: "amount" });
    expect(chooseAutomaticIncomeMatch(transaction({ amountCents: 200_001 }), [occurrence({ acceptableVarianceCents: 100 })]).kind).toBe("match");
  });

  it("rejects merchant mismatches and dates beyond five days", () => {
    expect(chooseAutomaticIncomeMatch(transaction({ normalizedMerchant: "other" }), [occurrence()])).toEqual({ kind: "none", reason: "identity" });
    expect(chooseAutomaticIncomeMatch(transaction(), [occurrence({ normalizedMerchant: null })])).toEqual({ kind: "none", reason: "identity" });
    expect(chooseAutomaticIncomeMatch(transaction(), [occurrence({ autoMatchEnabled: false })])).toEqual({ kind: "none", reason: "identity" });
    expect(chooseAutomaticIncomeMatch(transaction({ date: "2026-07-21" }), [occurrence()]).kind).toBe("match");
    expect(chooseAutomaticIncomeMatch(transaction({ date: "2026-07-22" }), [occurrence()])).toEqual({ kind: "none", reason: "date" });
  });

  it("does not choose between ambiguous occurrences", () => {
    expect(chooseAutomaticIncomeMatch(transaction(), [occurrence(), occurrence({ id: "second" })])).toEqual({ kind: "none", reason: "ambiguous" });
  });

  it.each([
    { status: "pending" as const },
    { excluded: true },
    { isTransfer: true },
    { amountCents: -200_000 },
  ])("rejects ineligible transactions: %o", (overrides) => {
    expect(chooseAutomaticIncomeMatch(transaction(overrides), [occurrence()])).toEqual({ kind: "none", reason: "ineligible" });
  });
});
