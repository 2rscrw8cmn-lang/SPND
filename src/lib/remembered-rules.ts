export type AllocationSource = "manual" | "merchant_rule" | "merchant_history" | "provider" | "default" | "unsorted";

export type RuleCandidate = {
  reviewStatus: "needs_review" | "reviewed";
  excluded: boolean;
  isTransfer: boolean;
  superseded: boolean;
  allocations: Array<{ categoryId: string; amountCents: number; source: AllocationSource }>;
};

const REPLACEABLE_SOURCES = new Set<AllocationSource>([
  "merchant_rule",
  "merchant_history",
  "provider",
  "default",
  "unsorted",
]);

export function canApplyRememberedRule(candidate: RuleCandidate) {
  if (candidate.reviewStatus !== "needs_review" || candidate.excluded || candidate.isTransfer || candidate.superseded) return false;
  if (candidate.allocations.length > 1) return false;
  return candidate.allocations.length === 0 || REPLACEABLE_SOURCES.has(candidate.allocations[0]!.source);
}

export function rememberedAllocation(candidate: RuleCandidate, categoryId: string, amountCents: number) {
  if (!canApplyRememberedRule(candidate)) return candidate;
  return { ...candidate, allocations: [{ categoryId, amountCents, source: "merchant_rule" as const }] };
}

export function belongsInReview(candidate: Pick<RuleCandidate, "reviewStatus" | "excluded" | "isTransfer" | "superseded"> & { duplicate?: boolean }) {
  return candidate.reviewStatus === "needs_review" && !candidate.excluded && !candidate.isTransfer && !candidate.superseded && !candidate.duplicate;
}

export function allocationAggregateDeltas(
  before: Array<{ categoryId: string; amountCents: number }>,
  after: Array<{ categoryId: string; amountCents: number }>,
) {
  const totals = new Map<string, number>();
  for (const allocation of before) totals.set(allocation.categoryId, (totals.get(allocation.categoryId) ?? 0) - allocation.amountCents);
  for (const allocation of after) totals.set(allocation.categoryId, (totals.get(allocation.categoryId) ?? 0) + allocation.amountCents);
  return [...totals].filter(([, amountCents]) => amountCents !== 0).map(([categoryId, amountCents]) => ({ categoryId, amountCents }));
}

export function shouldReopenAfterPendingChange(input: { reviewed: boolean; pendingAmountCents: number; postedAmountCents: number; split: boolean }) {
  if (!input.reviewed || input.pendingAmountCents === input.postedAmountCents) return false;
  return input.split || Math.abs(input.postedAmountCents - input.pendingAmountCents) > Math.max(100, Math.round(Math.abs(input.pendingAmountCents) * 0.05));
}

export function isUpdateConflict(expectedUpdatedAt: string | undefined, currentUpdatedAt: string) {
  return expectedUpdatedAt !== undefined && expectedUpdatedAt !== currentUpdatedAt;
}
