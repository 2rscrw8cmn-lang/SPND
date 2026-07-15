import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";

export type DatedTransaction = { id: string; isoDate: string };

export function transactionDayLabel(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  if (isTodayRelative(date, now)) return "Today";
  if (isYesterdayRelative(date, now)) return "Yesterday";
  const age = differenceInCalendarDays(startLocalDay(now), startLocalDay(date));
  if (age >= 0 && age <= 6) return format(date, "EEEE, MMM d");
  return format(date, date.getFullYear() === now.getFullYear() ? "MMMM d" : "MMMM d, yyyy");
}

export function groupTransactionsByDay<T extends DatedTransaction>(transactions: T[], now = new Date()) {
  const groups: Array<{ key: string; label: string; transactions: T[] }> = [];
  for (const transaction of transactions) {
    const date = new Date(transaction.isoDate);
    const key = format(date, "yyyy-MM-dd");
    const current = groups.at(-1);
    if (current?.key === key) current.transactions.push(transaction);
    else groups.push({ key, label: transactionDayLabel(transaction.isoDate, now), transactions: [transaction] });
  }
  return groups;
}

function startLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isTodayRelative(date: Date, now: Date) {
  if (Math.abs(Date.now() - now.getTime()) < 1_000) return isToday(date);
  return differenceInCalendarDays(startLocalDay(now), startLocalDay(date)) === 0;
}

function isYesterdayRelative(date: Date, now: Date) {
  if (Math.abs(Date.now() - now.getTime()) < 1_000) return isYesterday(date);
  return differenceInCalendarDays(startLocalDay(now), startLocalDay(date)) === 1;
}
