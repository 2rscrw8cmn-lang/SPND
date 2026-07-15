import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { format, isValid, parseISO, startOfMonth } from "date-fns";
import readXlsxFile from "read-excel-file/node";

export const importTypes = ["bank_transactions", "credit_card_transactions", "budget_template", "income", "recurring_bills", "planned_expenses"] as const;
export type ImportType = typeof importTypes[number];
export type NormalizedImportRow = Record<string, string | number | null>;
export type ParsedImportRow = { rowNumber: number; raw: Record<string, unknown>; normalized: NormalizedImportRow; fingerprint: string; errors: Array<{ field?: string; code: string; message: string }> };

const headerAliases: Record<string, string> = {
  transactiondate: "date", posteddate: "date", postingdate: "date", transactedat: "date",
  description: "merchant", payee: "merchant", memo: "description", rawdescription: "description",
  value: "amount", debitamount: "debit", creditamount: "credit", categoryname: "category",
  budget: "budgeted", budgetamount: "budgeted", monthlyamount: "budgeted",
  nextduedate: "date", duedate: "date", paycheckdate: "date",
};

function normalizedHeader(value: unknown) {
  const compact = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return headerAliases[compact] ?? compact;
}

export function parseMoneyCents(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  const source = String(value ?? "").trim();
  if (!source) return null;
  const negative = /^\(.*\)$/.test(source) || source.startsWith("-");
  const cleaned = source.replace(/[()$,+\s]/g, "").replace(/^-/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return negative ? -cents : cents;
}

function parseDate(value: unknown, monthOnly = false) {
  if (value instanceof Date && isValid(value)) return format(monthOnly ? startOfMonth(value) : value, "yyyy-MM-dd");
  const source = String(value ?? "").trim();
  if (!source) return null;
  const iso = /^\d{4}-\d{2}$/.test(source) ? `${source}-01` : source;
  const parsed = parseISO(iso);
  if (isValid(parsed)) return format(monthOnly ? startOfMonth(parsed) : parsed, "yyyy-MM-dd");
  const fallback = new Date(source);
  return isValid(fallback) ? format(monthOnly ? startOfMonth(fallback) : fallback, "yyyy-MM-dd") : null;
}

export function rowFingerprint(type: ImportType, normalized: NormalizedImportRow) {
  return createHash("sha256").update(`${type}|${JSON.stringify(normalized)}`).digest("hex");
}

export function validateEditedRow(type: ImportType, normalized: NormalizedImportRow) {
  const errors: ParsedImportRow["errors"] = [];
  const text = (key: string) => String(normalized[key] ?? "").trim();
  const cents = (key: string) => Number(normalized[key]);
  if (type === "budget_template") {
    if (!/^\d{4}-\d{2}-01$/.test(text("month"))) errors.push({ field: "month", code: "invalid_month", message: "Use the first day of a month (YYYY-MM-01)." });
    if (!text("category")) errors.push({ field: "category", code: "missing_category", message: "Enter a category name." });
    if (!Number.isInteger(cents("budgetedCents")) || cents("budgetedCents") < 0) errors.push({ field: "budgetedCents", code: "invalid_amount", message: "Enter a non-negative integer-cent amount." });
  } else if (type === "bank_transactions" || type === "credit_card_transactions") {
    if (!parseDate(text("date"))) errors.push({ field: "date", code: "invalid_date", message: "Enter a valid date." });
    if (!text("merchant")) errors.push({ field: "merchant", code: "missing_merchant", message: "Enter a merchant." });
    if (!Number.isInteger(cents("amountCents")) || cents("amountCents") === 0) errors.push({ field: "amountCents", code: "invalid_amount", message: "Enter a non-zero integer-cent amount." });
  } else {
    if (!text("name")) errors.push({ field: "name", code: "missing_name", message: "Enter a name." });
    if (!parseDate(text("date"))) errors.push({ field: "date", code: "invalid_date", message: "Enter a valid date." });
    if (!Number.isInteger(cents("amountCents")) || cents("amountCents") <= 0) errors.push({ field: "amountCents", code: "invalid_amount", message: "Enter a positive integer-cent amount." });
  }
  return errors;
}

function normalizeRow(type: ImportType, raw: Record<string, unknown>, rowNumber: number): ParsedImportRow {
  const errors: ParsedImportRow["errors"] = [];
  const value = (name: string) => raw[name];
  let normalized: NormalizedImportRow;
  if (type === "bank_transactions" || type === "credit_card_transactions") {
    const date = parseDate(value("date"));
    const merchant = String(value("merchant") ?? "").trim();
    let amountCents = parseMoneyCents(value("amount"));
    if (amountCents === null) {
      const debit = parseMoneyCents(value("debit")); const credit = parseMoneyCents(value("credit"));
      amountCents = debit !== null ? -Math.abs(debit) : credit !== null ? Math.abs(credit) : null;
    }
    if (!date) errors.push({ field: "date", code: "invalid_date", message: "Enter a valid transaction date." });
    if (!merchant) errors.push({ field: "merchant", code: "missing_merchant", message: "Enter a merchant or description." });
    if (amountCents === null || amountCents === 0) errors.push({ field: "amount", code: "invalid_amount", message: "Enter a non-zero amount with no more than two decimals." });
    normalized = { date, merchant, description: String(value("description") ?? merchant).trim(), amountCents, category: String(value("category") ?? "").trim() || null };
  } else if (type === "budget_template") {
    const month = parseDate(value("month"), true); const category = String(value("category") ?? "").trim(); const budgetedCents = parseMoneyCents(value("budgeted") ?? value("amount"));
    if (!month) errors.push({ field: "month", code: "invalid_month", message: "Enter a month as YYYY-MM." });
    if (!category) errors.push({ field: "category", code: "missing_category", message: "Enter a category name." });
    if (budgetedCents === null || budgetedCents < 0) errors.push({ field: "budgeted", code: "invalid_amount", message: "Enter a non-negative monthly amount." });
    normalized = { month, category, budgetedCents };
  } else if (type === "recurring_bills") {
    const name = String(value("name") ?? value("merchant") ?? "").trim(); const date = parseDate(value("date")); const amount = parseMoneyCents(value("amount"));
    if (!name) errors.push({ field: "name", code: "missing_name", message: "Enter a bill name." });
    if (!date) errors.push({ field: "date", code: "invalid_date", message: "Enter the next due date." });
    if (amount === null || amount === 0) errors.push({ field: "amount", code: "invalid_amount", message: "Enter a non-zero bill amount." });
    normalized = { name, date, amountCents: amount === null ? null : Math.abs(amount), cadence: String(value("cadence") ?? "monthly").trim().toLowerCase(), category: String(value("category") ?? "").trim() || null };
  } else {
    const name = String(value("name") ?? value("merchant") ?? "").trim(); const date = parseDate(value("date")); const amount = parseMoneyCents(value("amount"));
    if (!name) errors.push({ field: "name", code: "missing_name", message: `Enter a ${type === "income" ? "paycheck" : "planned expense"} name.` });
    if (!date) errors.push({ field: "date", code: "invalid_date", message: "Enter a valid date." });
    if (amount === null || amount === 0) errors.push({ field: "amount", code: "invalid_amount", message: "Enter a non-zero amount." });
    normalized = { name, date, amountCents: amount === null ? null : Math.abs(amount), category: String(value("category") ?? "").trim() || null };
  }
  return { rowNumber, raw, normalized, fingerprint: rowFingerprint(type, normalized), errors };
}

function recordsFromMatrix(matrix: unknown[][]) {
  if (matrix.length < 2) return [];
  const headers = matrix[0]!.map(normalizedHeader);
  return matrix.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

export async function parseImportFile(buffer: Buffer, fileName: string, type: ImportType) {
  let records: Array<Record<string, unknown>>;
  if (fileName.toLowerCase().endsWith(".xlsx")) {
    const rows = await readXlsxFile(buffer);
    records = recordsFromMatrix(rows as unknown as unknown[][]);
  } else {
    records = parse(buffer, { columns: (headers: string[]) => headers.map(normalizedHeader), skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Array<Record<string, unknown>>;
  }
  return records.slice(0, 5000).map((row, index) => normalizeRow(type, row, index + 2));
}

export function fileChecksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
