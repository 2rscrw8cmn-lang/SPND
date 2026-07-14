import { describe, expect, it } from "vitest";
import { findPendingMatch, sourceFingerprint, type ImportedTransaction } from "@/lib/reconcile";

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

  it("uses provider IDs for stable deduplication", () => {
    expect(sourceFingerprint(pending)).toBe("provider:pending-1");
  });
});

