import { describe, expect, it } from "vitest";
import { buildSyncWindows, connectionNames, sanitizeProviderIssues, transactionDate } from "@/lib/simplefin-core";

describe("SimpleFIN Version 2 protocol handling", () => {
  it("requests four contiguous, end-exclusive 90-day history windows", () => {
    const windows = buildSyncWindows(new Date("2026-07-15T12:34:56.789Z"), true);
    expect(windows).toHaveLength(4);
    for (const [index, window] of windows.entries()) {
      expect((window.endExclusive.getTime() - window.start.getTime()) / 86_400_000).toBe(90);
      if (index) expect(window.start).toEqual(windows[index - 1]!.endExclusive);
    }
    expect(windows.at(-1)!.endExclusive).toEqual(new Date("2026-07-15T12:34:57.000Z"));
  });

  it("uses transacted_at for pending transactions and never creates a 1970 date", () => {
    expect(transactionDate({ posted: 0, transacted_at: 1_752_580_800, amount: "-2.00", description: "Coffee", pending: true }))
      .toBe("2025-07-15T12:00:00.000Z");
    expect(transactionDate({ posted: 0, amount: "-2.00", description: "Coffee", pending: true })).toBeNull();
  });

  it("maps account institutions through conn_id", () => {
    const names = connectionNames({ connections: [{ conn_id: "conn-1", name: "Household Bank" }] });
    expect(names.get("conn-1")).toBe("Household Bank");
  });

  it("sanitizes structured partial errors", () => {
    expect(sanitizeProviderIssues({ errlist: [{ code: "con.auth", conn_id: "conn-1", msg: "See https://secret.test" }] }))
      .toEqual(["An institution connection needs reauthentication in SimpleFIN."]);
  });
});
