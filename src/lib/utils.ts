import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number, options?: { signed?: boolean; compact?: boolean }) {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options?.compact ? 0 : 2,
    minimumFractionDigits: options?.compact ? 0 : 2,
  }).format(Math.abs(value));

  if (!options?.signed || cents === 0) return formatted;
  return `${cents > 0 ? "+" : "−"}${formatted}`;
}

export function normalizeMerchant(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b0+(\d+)/g, "$1")
    .replace(/\b(payment|purchase|debit|credit|pos|ach|inc|llc|com)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
