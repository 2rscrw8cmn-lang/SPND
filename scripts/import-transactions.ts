import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { normalizeMerchant } from "../src/lib/utils";

type SourceRow = {
  date: string;
  name: string;
  amount: string;
  status: string;
  category: string;
  excluded: string;
  type: string;
  account: string;
  note: string;
};

const householdId = "7a427b15-a397-4a83-a54d-f199efe77a32";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local first.");
const supabaseUrl = url;
const supabaseServiceKey = serviceKey;

const chunk = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function main() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const rows = parse(await readFile("transactions.csv", "utf8"), { columns: true, skip_empty_lines: true, trim: true }) as SourceRow[];
  const colors = ["#45D9E1", "#FF705B", "#9B6CFF", "#FFD24A", "#C9FF4A", "#58A6FF", "#F79AD3"];

  const accountNames = [...new Set(rows.map((row) => row.account || "Legacy import"))];
  const accountPayload = accountNames.map((name) => ({
    household_id: householdId,
    connection_id: null,
    provider_account_id: `csv:${createHash("sha256").update(name).digest("hex").slice(0, 24)}`,
    name,
    type: "imported",
    cash_flow_mode: "excluded",
  }));
  const { data: accountRows, error: accountError } = await supabase.from("accounts").upsert(accountPayload, { onConflict: "household_id,provider_account_id" }).select("id,name");
  if (accountError || !accountRows) throw accountError ?? new Error("Could not create imported accounts.");
  const accountIds = new Map(accountRows.map((account) => [account.name as string, account.id as string]));

  const sourceCategories = [...new Set(rows.map((row) => row.category.trim()).filter(Boolean))];
  const categoryPayload = sourceCategories.map((name, index) => ({ household_id: householdId, name, color: colors[index % colors.length], icon: "CircleDollarSign", sort_order: 200 + index, is_system: false }));
  const { error: categoryUpsertError } = await supabase.from("categories").upsert(categoryPayload, { onConflict: "household_id,name", ignoreDuplicates: true });
  if (categoryUpsertError) throw categoryUpsertError;
  const { data: categoryRows, error: categoryError } = await supabase.from("categories").select("id,name").eq("household_id", householdId);
  if (categoryError) throw categoryError;
  const categoryIds = new Map((categoryRows ?? []).map((category) => [category.name as string, category.id as string]));
  const unsortedId = categoryIds.get("Unsorted");

  const allTransactionPayload = rows.map((row) => {
    const accountId = accountIds.get(row.account || "Legacy import")!;
    const amountCents = Math.round(Number(row.amount) * -100);
    const timestamp = new Date(`${row.date}T12:00:00-04:00`).toISOString();
    const fingerprint = createHash("sha256").update([accountId, row.date, row.name, amountCents, row.status].join("|")).digest("hex");
    return {
      household_id: householdId,
      account_id: accountId,
      source_fingerprint: `csv:${fingerprint}`,
      transacted_at: timestamp,
      posted_at: row.status.toLowerCase() === "posted" ? timestamp : null,
      amount_cents: amountCents,
      merchant: row.name || "Unknown merchant",
      normalized_merchant: normalizeMerchant(row.name || "Unknown merchant"),
      raw_description: row.name,
      status: row.status.toLowerCase() === "pending" ? "pending" : "posted",
      provider_category: row.category || null,
      raw_payload: {},
      note: row.note || null,
      excluded: row.excluded.toLowerCase() === "true" || row.type === "internal transfer",
    };
  });
  const transactionPayload = [...new Map(allTransactionPayload.map((row) => [row.source_fingerprint, row])).values()];

  const savedTransactions: Array<{ id: string; source_fingerprint: string }> = [];
  for (const batch of chunk(transactionPayload, 500)) {
    const { data, error } = await supabase.from("transactions").upsert(batch, { onConflict: "account_id,source_fingerprint" }).select("id,source_fingerprint");
    if (error || !data) throw error ?? new Error("Could not import a transaction batch.");
    savedTransactions.push(...data as Array<{ id: string; source_fingerprint: string }>);
  }

  const transactionByFingerprint = new Map(savedTransactions.map((transaction) => [transaction.source_fingerprint, transaction.id]));
  const allocationPayload = transactionPayload.flatMap((row) => {
    if (row.excluded || row.amount_cents >= 0) return [];
    const categoryId = categoryIds.get(row.provider_category?.trim() ?? "") ?? unsortedId;
    const transactionId = transactionByFingerprint.get(row.source_fingerprint);
    return categoryId && transactionId ? [{ household_id: householdId, transaction_id: transactionId, category_id: categoryId, amount_cents: row.amount_cents, source: "manual" }] : [];
  });
  const importedTransactionIds = savedTransactions.map((transaction) => transaction.id);
  for (const ids of chunk(importedTransactionIds, 100)) {
    const { error } = await supabase.from("transaction_allocations").delete().in("transaction_id", ids);
    if (error) throw error;
  }
  for (const batch of chunk(allocationPayload, 500)) {
    const { error } = await supabase.from("transaction_allocations").insert(batch);
    if (error) throw error;
  }

  process.stdout.write(`Imported or updated ${savedTransactions.length} transactions and ${allocationPayload.length} allocations. Re-running is safe.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : JSON.stringify(error)}\n`);
  process.exitCode = 1;
});
