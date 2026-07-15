import { createHash } from "node:crypto";
import { normalizeMerchant } from "@/lib/utils";

export type ImportedTransaction = {
  accountId: string;
  providerId?: string;
  date: string;
  amountCents: number;
  merchant: string;
  status: "pending" | "posted";
};

export function sourceFingerprint(transaction: ImportedTransaction) {
  if (transaction.providerId) return `provider:${transaction.providerId}`;
  return createHash("sha256")
    .update(
      [
        transaction.accountId,
        transaction.date.slice(0, 10),
        transaction.amountCents,
        normalizeMerchant(transaction.merchant),
      ].join("|"),
    )
    .digest("hex");
}

export function pendingMatchKey(transaction: ImportedTransaction) {
  return [transaction.accountId, Math.abs(transaction.amountCents), normalizeMerchant(transaction.merchant)].join(
    "|",
  );
}

export function findPendingMatch(posted: ImportedTransaction, pending: ImportedTransaction[]) {
  if (posted.status !== "posted") return undefined;
  const postedDate = new Date(posted.date).getTime();
  const key = pendingMatchKey(posted);
  const eligible = pending.filter((candidate) => {
    const ageInDays = Math.abs(postedDate - new Date(candidate.date).getTime()) / 86_400_000;
    return candidate.status === "pending" && candidate.accountId === posted.accountId && Math.sign(candidate.amountCents) === Math.sign(posted.amountCents) && normalizeMerchant(candidate.merchant) === normalizeMerchant(posted.merchant) && ageInDays <= 7;
  });
  const closest = eligible.sort((a, b) => {
    const amountDifference = Math.abs(a.amountCents - posted.amountCents) - Math.abs(b.amountCents - posted.amountCents);
    return amountDifference || Math.abs(new Date(a.date).getTime() - postedDate) - Math.abs(new Date(b.date).getTime() - postedDate);
  });
  return closest.find((candidate) => pendingMatchKey(candidate) === key)
    ?? closest.find((candidate) => Math.abs(candidate.amountCents - posted.amountCents) <= Math.max(100, Math.round(Math.abs(candidate.amountCents) * 0.05)));
}

export function reconcileAllocationAmounts<T extends { amountCents: number }>(allocations: T[], targetAmountCents: number): T[] {
  if (!allocations.length) return [];
  const currentTotal = allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  if (currentTotal === targetAmountCents) return allocations.map((allocation) => ({ ...allocation }));
  const result = allocations.map((allocation) => ({ ...allocation }));
  const largestIndex = result.reduce((best, allocation, index) => Math.abs(allocation.amountCents) > Math.abs(result[best]!.amountCents) ? index : best, 0);
  result[largestIndex]!.amountCents += targetAmountCents - currentTotal;
  return result;
}
