import { addDays, addMonths, addWeeks, isBefore, parseISO } from "date-fns";

export type IncomeSchedule = {
  id: string;
  name: string;
  expectedAmountCents: number;
  cadence: string | null;
  nextExpectedDate: string | null;
  explicitDates: string[];
  sourceType: "recurring" | "one_time";
  active: boolean;
};

export type ExpectedIncomeOccurrence = { sourceId: string; name: string; date: string; amountCents: number };

function advance(date: Date, cadence: string | null) {
  if (cadence === "weekly") return addWeeks(date, 1);
  if (cadence === "biweekly") return addWeeks(date, 2);
  if (cadence === "semimonthly") return addDays(date, 15);
  if (cadence === "annual") return addMonths(date, 12);
  return addMonths(date, 1);
}

export function incomeOccurrencesForMonth(sources: IncomeSchedule[], month: string): ExpectedIncomeOccurrence[] {
  const start = parseISO(`${month.slice(0, 7)}-01`);
  const end = addMonths(start, 1);
  const occurrences: ExpectedIncomeOccurrence[] = [];
  for (const source of sources.filter((item) => item.active)) {
    const dates = new Set(source.explicitDates.filter((date) => !isBefore(parseISO(date), start) && isBefore(parseISO(date), end)));
    if (source.sourceType === "recurring" && source.nextExpectedDate) {
      let date = parseISO(source.nextExpectedDate);
      while (isBefore(date, start)) date = advance(date, source.cadence);
      while (isBefore(date, end)) { dates.add(date.toISOString().slice(0, 10)); date = advance(date, source.cadence); }
    } else if (source.nextExpectedDate && !isBefore(parseISO(source.nextExpectedDate), start) && isBefore(parseISO(source.nextExpectedDate), end)) dates.add(source.nextExpectedDate);
    for (const date of dates) occurrences.push({ sourceId: source.id, name: source.name, date, amountCents: source.expectedAmountCents });
  }
  return occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function receivedIncomeTotal(
  transactions: Array<{ id: string; amountCents: number; status: string }>,
  allocations: Array<{ transactionId: string; categoryId: string }>,
  behaviorByCategory: Map<string, string>,
  matchedTransactionIds: Set<string> = new Set(),
) {
  const incomeTransactionIds = new Set(allocations.filter((allocation) => behaviorByCategory.get(allocation.categoryId) === "income").map((allocation) => allocation.transactionId));
  return transactions.filter((transaction) => transaction.status === "posted" && transaction.amountCents > 0 && (incomeTransactionIds.has(transaction.id) || matchedTransactionIds.has(transaction.id))).reduce((sum, transaction) => sum + transaction.amountCents, 0);
}
