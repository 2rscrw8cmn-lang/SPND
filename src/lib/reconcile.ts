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

  return pending.find((candidate) => {
    const ageInDays = Math.abs(postedDate - new Date(candidate.date).getTime()) / 86_400_000;
    return candidate.status === "pending" && pendingMatchKey(candidate) === key && ageInDays <= 7;
  });
}

