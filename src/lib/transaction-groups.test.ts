import { describe, expect, it } from "vitest";
import { groupTransactionsByDay, transactionDayLabel } from "@/lib/transaction-groups";

const now = new Date("2026-07-14T12:00:00");

describe("transaction day grouping", () => {
  it("uses relative labels followed by weekday and older-date labels", () => {
    expect(transactionDayLabel("2026-07-14T08:00:00", now)).toBe("Today");
    expect(transactionDayLabel("2026-07-13T08:00:00", now)).toBe("Yesterday");
    expect(transactionDayLabel("2026-07-10T08:00:00", now)).toBe("Friday, Jul 10");
    expect(transactionDayLabel("2026-05-02T08:00:00", now)).toBe("May 2");
    expect(transactionDayLabel("2025-12-30T08:00:00", now)).toBe("December 30, 2025");
  });

  it("keeps feed order and emits one heading per local day", () => {
    const groups = groupTransactionsByDay([
      { id: "1", isoDate: "2026-07-14T18:00:00" },
      { id: "2", isoDate: "2026-07-14T09:00:00" },
      { id: "3", isoDate: "2026-07-13T09:00:00" },
    ], now);
    expect(groups.map((group) => [group.label, group.transactions.map((item) => item.id)])).toEqual([
      ["Today", ["1", "2"]],
      ["Yesterday", ["3"]],
    ]);
  });
});
