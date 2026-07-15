import { describe, expect, it } from "vitest";
import { findPendingMatch, reconcileAllocationAmounts, sourceFingerprint, type ImportedTransaction } from "@/lib/reconcile";

const pending: ImportedTransaction = {
  accountId: "checking",
  providerId: "pending-1",
  date: "2026-07-10T12:00:00Z",
  amountCents: -7421,
  merchant: "TARGET 000123",
  status: "pending",
};

describe("transaction reconciliation", () => {
  it("matches a posted transaction to a recent pending transaction", () => {
    const posted = { ...pending, providerId: "posted-1", date: "2026-07-12T12:00:00Z", merchant: "Target #123", status: "posted" as const };
    expect(findPendingMatch(posted, [pending])).toEqual(pending);
  });

  it("does not match a stale pending transaction", () => {
    const posted = { ...pending, date: "2026-07-20T12:00:00Z", status: "posted" as const };
    expect(findPendingMatch(posted, [pending])).toBeUndefined();
  });

  it("matches a small posted amount adjustment without matching unrelated amounts", () => {
    const adjusted = { ...pending, providerId: "posted-2", amountCents: -7521, date: "2026-07-12T12:00:00Z", status: "posted" as const };
    expect(findPendingMatch(adjusted, [pending])).toEqual(pending);
    expect(findPendingMatch({ ...adjusted, amountCents: -9000 }, [pending])).toBeUndefined();
    expect(findPendingMatch({ ...adjusted, amountCents: 7521 }, [pending])).toBeUndefined();
  });

  it("chooses the closest pending amount deterministically", () => {
    const adjusted = { ...pending, providerId: "posted-3", amountCents: -7500, date: "2026-07-12T12:00:00Z", status: "posted" as const };
    const farther = { ...pending, providerId: "pending-2", amountCents: -7600 };
    const closer = { ...pending, providerId: "pending-3", amountCents: -7510 };
    expect(findPendingMatch(adjusted, [farther, closer])).toEqual(closer);
  });

  it("reconciles copied split allocations to the final posted cents", () => {
    const reconciled = reconcileAllocationAmounts([{ categoryId: "food", amountCents: -5000 }, { categoryId: "home", amountCents: -2421 }], -7521);
    expect(reconciled).toEqual([{ categoryId: "food", amountCents: -5100 }, { categoryId: "home", amountCents: -2421 }]);
    expect(reconciled.reduce((sum, item) => sum + item.amountCents, 0)).toBe(-7521);
  });

  it("uses provider IDs for stable deduplication", () => {
    expect(sourceFingerprint(pending)).toBe("provider:pending-1");
  });
});
