import { describe, expect, it } from "vitest";
import { incomeOccurrencesForMonth, receivedIncomeTotal, type IncomeSchedule } from "@/lib/expected-income";

const source = (overrides: Partial<IncomeSchedule> = {}): IncomeSchedule => ({ id: "pay", name: "Paycheck", expectedAmountCents: 200_000, cadence: "biweekly", nextExpectedDate: "2026-07-03", explicitDates: [], sourceType: "recurring", active: true, ...overrides });

describe("expected monthly income", () => {
  it("expands recurring schedules only inside the selected month", () => {
    expect(incomeOccurrencesForMonth([source()], "2026-07").map((item) => item.date)).toEqual(["2026-07-03", "2026-07-17", "2026-07-31"]);
  });
  it("supports one-time and explicit dates without counting inactive sources", () => {
    const result = incomeOccurrencesForMonth([source({ id: "bonus", sourceType: "one_time", nextExpectedDate: "2026-07-20", cadence: null }), source({ id: "off", active: false })], "2026-07");
    expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ sourceId: "bonus", amountCents: 200_000 });
  });
});

describe("received income classification", () => {
  it("counts only posted positive transactions classified as income", () => {
    const total = receivedIncomeTotal(
      [{ id: "pay", amountCents: 200_000, status: "posted" }, { id: "refund", amountCents: 5_000, status: "posted" }, { id: "transfer", amountCents: 50_000, status: "posted" }, { id: "pending-pay", amountCents: 200_000, status: "pending" }],
      [{ transactionId: "pay", categoryId: "income" }, { transactionId: "refund", categoryId: "spending" }],
      new Map([["income", "income"], ["spending", "spending"]]),
    );
    expect(total).toBe(200_000);
  });
});
