import { describe, expect, it } from "vitest";
import { findPotentialDuplicates } from "@/lib/transaction-duplicates";

const base = { accountId: "checking", status: "posted" as const, excluded: false };

describe("potential duplicate detection", () => {
  it("groups matching merchant and amount within three days and prefers the posted transaction", () => {
    const groups = findPotentialDuplicates([
      { ...base, id: "pending", merchant: "PUBLIX #123", amountCents: -4242, isoDate: "2026-07-14T12:00:00Z", status: "pending" as const },
      { ...base, id: "posted", merchant: "Publix 123", amountCents: -4242, isoDate: "2026-07-15T12:00:00Z" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.canonical.id).toBe("posted");
    expect(groups[0]?.duplicates.map((item) => item.id)).toEqual(["pending"]);
  });

  it("does not flag different accounts, amounts, or recurring charges far apart", () => {
    expect(findPotentialDuplicates([
      { ...base, id: "1", merchant: "Netflix", amountCents: -2299, isoDate: "2026-06-01T12:00:00Z" },
      { ...base, id: "2", merchant: "Netflix", amountCents: -2299, isoDate: "2026-07-01T12:00:00Z" },
      { ...base, id: "3", merchant: "Netflix", amountCents: -2499, isoDate: "2026-07-01T12:00:00Z" },
      { ...base, id: "4", accountId: "card", merchant: "Netflix", amountCents: -2299, isoDate: "2026-07-01T12:00:00Z" },
    ])).toEqual([]);
  });
});
