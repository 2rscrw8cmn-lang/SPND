import { describe, expect, it } from "vitest";
import { parseImportFile, parseMoneyCents } from "@/lib/imports";

describe("document import parsing", () => {
  it("parses currency into signed integer cents", () => {
    expect(parseMoneyCents("$1,234.56")).toBe(123456);
    expect(parseMoneyCents("(42.10)")).toBe(-4210);
    expect(parseMoneyCents("1.234")).toBeNull();
  });

  it("normalizes a transaction CSV and reports row errors", async () => {
    const rows = await parseImportFile(Buffer.from("Date,Description,Amount\n2026-07-10,Publix,-86.42\nbad,,nope"), "activity.csv", "bank_transactions");
    expect(rows[0]?.normalized).toMatchObject({ date: "2026-07-10", merchant: "Publix", amountCents: -8642 });
    expect(rows[0]?.errors).toHaveLength(0);
    expect(rows[1]?.errors.map((error) => error.code)).toEqual(["invalid_date", "missing_merchant", "invalid_amount"]);
  });

  it("normalizes monthly budget rows", async () => {
    const [row] = await parseImportFile(Buffer.from("Month,Category,Budget\n2026-08,Groceries,800"), "budget.csv", "budget_template");
    expect(row?.normalized).toEqual({ month: "2026-08-01", category: "Groceries", budgetedCents: 80000 });
  });
});
