import { normalizeMerchant } from "@/lib/utils";

export type DuplicateCandidate = {
  id: string;
  merchant: string;
  amountCents: number;
  accountId: string;
  isoDate: string;
  status: "pending" | "posted";
  excluded: boolean;
};

export type DuplicateGroup<T extends DuplicateCandidate = DuplicateCandidate> = {
  key: string;
  canonical: T;
  duplicates: T[];
};

const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function findPotentialDuplicates<T extends DuplicateCandidate>(transactions: T[]): DuplicateGroup<T>[] {
  const candidates = transactions.filter((transaction) => !transaction.excluded);
  const buckets = new Map<string, T[]>();
  for (const transaction of candidates) {
    const key = `${transaction.accountId}:${transaction.amountCents}:${normalizeMerchant(transaction.merchant)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(transaction);
    buckets.set(key, bucket);
  }

  const groups: DuplicateGroup<T>[] = [];
  for (const [bucketKey, bucket] of buckets) {
    const remaining = [...bucket].sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    while (remaining.length > 1) {
      const anchor = remaining.shift()!;
      const matches = remaining.filter((candidate) => Math.abs(new Date(anchor.isoDate).getTime() - new Date(candidate.isoDate).getTime()) <= DUPLICATE_WINDOW_MS);
      if (!matches.length) continue;
      const cluster = [anchor, ...matches];
      for (const match of matches) remaining.splice(remaining.indexOf(match), 1);
      cluster.sort((a, b) => Number(b.status === "posted") - Number(a.status === "posted") || new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
      groups.push({ key: `${bucketKey}:${cluster[0]!.id}`, canonical: cluster[0]!, duplicates: cluster.slice(1) });
    }
  }
  return groups.sort((a, b) => new Date(b.canonical.isoDate).getTime() - new Date(a.canonical.isoDate).getTime());
}
