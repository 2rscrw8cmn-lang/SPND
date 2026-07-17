import { differenceInCalendarDays, parseISO } from "date-fns";

export type MatchableIncomeTransaction = {
  id: string;
  normalizedMerchant: string;
  amountCents: number;
  date: string;
  status: "pending" | "posted";
  excluded: boolean;
  isTransfer: boolean;
};

export type MatchableIncomeOccurrence = {
  id: string;
  sourceId: string;
  normalizedMerchant: string | null;
  autoMatchEnabled: boolean;
  amountCents: number;
  date: string;
  acceptableVarianceCents: number | null;
};

export type IncomeMatchDecision =
  | { kind: "match"; occurrenceId: string; sourceId: string }
  | { kind: "none"; reason: "ineligible" | "identity" | "amount" | "date" | "ambiguous" };

export function chooseAutomaticIncomeMatch(
  transaction: MatchableIncomeTransaction,
  occurrences: MatchableIncomeOccurrence[],
): IncomeMatchDecision {
  if (
    transaction.status !== "posted" ||
    transaction.amountCents <= 0 ||
    transaction.excluded ||
    transaction.isTransfer
  ) return { kind: "none", reason: "ineligible" };

  const identityMatches = occurrences.filter((occurrence) =>
    occurrence.autoMatchEnabled &&
    Boolean(occurrence.normalizedMerchant) &&
    occurrence.normalizedMerchant === transaction.normalizedMerchant,
  );
  if (!identityMatches.length) return { kind: "none", reason: "identity" };

  const amountMatches = identityMatches.filter((occurrence) =>
    Math.abs(occurrence.amountCents - transaction.amountCents) <=
    (occurrence.acceptableVarianceCents ?? 0),
  );
  if (!amountMatches.length) return { kind: "none", reason: "amount" };

  const dateMatches = amountMatches.filter((occurrence) =>
    Math.abs(differenceInCalendarDays(parseISO(transaction.date), parseISO(occurrence.date))) <= 5,
  );
  if (!dateMatches.length) return { kind: "none", reason: "date" };
  if (dateMatches.length !== 1) return { kind: "none", reason: "ambiguous" };
  return {
    kind: "match",
    occurrenceId: dateMatches[0]!.id,
    sourceId: dateMatches[0]!.sourceId,
  };
}
