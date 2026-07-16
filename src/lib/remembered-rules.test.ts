import { describe, expect, it } from "vitest";
import { allocationAggregateDeltas, belongsInReview, canApplyRememberedRule, isUpdateConflict, rememberedAllocation, shouldReopenAfterPendingChange, type RuleCandidate } from "@/lib/remembered-rules";

const candidate = (overrides: Partial<RuleCandidate> = {}): RuleCandidate => ({ reviewStatus: "needs_review", excluded: false, isTransfer: false, superseded: false, allocations: [], ...overrides });

describe("remembered transaction rules", () => {
  it.each(["pending", "posted"])("categorizes a new %s import without reviewing it", () => {
    const result = rememberedAllocation(candidate(), "groceries", -1299);
    expect(result.allocations).toEqual([{ categoryId: "groceries", amountCents: -1299, source: "merchant_rule" }]);
    expect(result.reviewStatus).toBe("needs_review");
    expect(belongsInReview(result)).toBe(true);
  });

  it("updates eligible existing unreviewed suggestions", () => {
    expect(canApplyRememberedRule(candidate({ allocations: [{ categoryId: "old", amountCents: -500, source: "provider" }] }))).toBe(true);
  });

  it("preserves reviewed history", () => {
    expect(canApplyRememberedRule(candidate({ reviewStatus: "reviewed" }))).toBe(false);
  });

  it("preserves manual splits and manual categorization", () => {
    expect(canApplyRememberedRule(candidate({ allocations: [{ categoryId: "a", amountCents: -300, source: "manual" }, { categoryId: "b", amountCents: -200, source: "manual" }] }))).toBe(false);
    expect(canApplyRememberedRule(candidate({ allocations: [{ categoryId: "a", amountCents: -500, source: "manual" }] }))).toBe(false);
  });

  it("preserves a remembered allocation and review state across pending-to-posted", () => {
    const pending = rememberedAllocation(candidate(), "dining", -2000);
    const posted = { ...pending, allocations: pending.allocations.map((allocation) => ({ ...allocation, amountCents: -2000 })) };
    expect(posted).toEqual(pending);
  });

  it("reopens review for a material pending amount change", () => {
    expect(shouldReopenAfterPendingChange({ reviewed: true, pendingAmountCents: -1000, postedAmountCents: -1300, split: false })).toBe(true);
    expect(shouldReopenAfterPendingChange({ reviewed: true, pendingAmountCents: -1000, postedAmountCents: -1050, split: false })).toBe(false);
  });

  it("move and undo produce exact inverse aggregate deltas", () => {
    const move = allocationAggregateDeltas([{ categoryId: "old", amountCents: -7421 }], [{ categoryId: "new", amountCents: -7421 }]);
    const undo = allocationAggregateDeltas([{ categoryId: "new", amountCents: -7421 }], [{ categoryId: "old", amountCents: -7421 }]);
    expect(move).toEqual([{ categoryId: "old", amountCents: 7421 }, { categoryId: "new", amountCents: -7421 }]);
    expect(Object.fromEntries(undo.map((delta) => [delta.categoryId, delta.amountCents]))).toEqual(Object.fromEntries(move.map((delta) => [delta.categoryId, -delta.amountCents])));
  });

  it("keeps superseded, excluded, transfer, and duplicate rows out of Review", () => {
    expect(belongsInReview({ ...candidate(), superseded: true })).toBe(false);
    expect(belongsInReview({ ...candidate(), excluded: true })).toBe(false);
    expect(belongsInReview({ ...candidate(), isTransfer: true })).toBe(false);
    expect(belongsInReview({ ...candidate(), duplicate: true })).toBe(false);
  });

  it("surfaces stale two-member edits", () => {
    expect(isUpdateConflict("2026-07-15T10:00:00Z", "2026-07-15T10:01:00Z")).toBe(true);
    expect(isUpdateConflict("2026-07-15T10:01:00Z", "2026-07-15T10:01:00Z")).toBe(false);
  });
});
