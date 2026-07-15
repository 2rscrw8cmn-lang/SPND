import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMerchant } from "@/lib/utils";
import { rowFingerprint, validateEditedRow, type ImportType, type NormalizedImportRow } from "@/lib/imports";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reject") }), z.object({ action: z.literal("apply") }),
  z.object({ action: z.literal("update_row"), rowId: z.string().uuid(), normalized: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedHousehold(); if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const { id } = await params; const parsed = bodySchema.safeParse(await request.json());
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ message: "Invalid import action." }, { status: 400 });
  const admin = createAdminClient(); const { data: item } = await admin.from("imports").select("id,import_type,status,account_id").eq("id", id).eq("household_id", auth.householdId).maybeSingle();
  if (!item) return NextResponse.json({ message: "Import not found." }, { status: 404 });
  if (parsed.data.action === "reject") { if (item.status === "applied") return NextResponse.json({ message: "Applied imports remain in history and cannot be rejected." }, { status: 409 }); await admin.from("imports").update({ status: "rejected", rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id); await admin.from("import_rows").update({ status: "rejected" }).eq("import_id", id).neq("status", "applied"); return NextResponse.json({ message: "Import rejected. No financial data was changed." }); }
  if (parsed.data.action === "update_row") {
    if (["applied", "rejected"].includes(item.status as string)) return NextResponse.json({ message: "Completed imports cannot be edited." }, { status: 409 });
    const errors = validateEditedRow(item.import_type as ImportType, parsed.data.normalized); const fingerprint = rowFingerprint(item.import_type as ImportType, parsed.data.normalized);
    const { data: duplicate } = errors.length ? { data: null } : await admin.from("import_rows").select("id").eq("household_id", auth.householdId).eq("fingerprint", fingerprint).neq("id", parsed.data.rowId).limit(1).maybeSingle();
    const { data: row } = await admin.from("import_rows").update({ normalized_data: parsed.data.normalized, fingerprint, status: errors.length ? "review" : duplicate ? "duplicate" : "accepted", updated_at: new Date().toISOString() }).eq("id", parsed.data.rowId).eq("import_id", id).eq("household_id", auth.householdId).select("id,row_number").maybeSingle();
    if (!row) return NextResponse.json({ message: "Import row not found." }, { status: 404 });
    await admin.from("import_errors").delete().eq("import_row_id", row.id);
    if (errors.length) await admin.from("import_errors").insert(errors.map((error) => ({ household_id: auth.householdId, import_id: id, import_row_id: row.id, row_number: row.row_number, field: error.field ?? null, code: error.code, message: error.message })));
    await refreshCounts(admin, id); return NextResponse.json({ message: errors.length ? "Row still needs review." : duplicate ? "Row matches an existing import and was marked duplicate." : "Row corrected and ready." });
  }
  if (item.status === "applied") return NextResponse.json({ message: "This import was already applied." }, { status: 409 });
  if (item.status !== "ready") return NextResponse.json({ message: "Resolve every row needing review before applying." }, { status: 409 });
  const { data: rows } = await admin.from("import_rows").select("id,status,fingerprint,raw_data,normalized_data").eq("import_id", id).eq("household_id", auth.householdId).eq("status", "accepted").order("row_number");
  const { data: categories } = await admin.from("categories").select("id,name").eq("household_id", auth.householdId); const categoryMap = new Map((categories ?? []).map((category) => [String(category.name).toLowerCase(), category.id as string])); const unsortedId = categoryMap.get("unsorted");
  if (item.import_type === "budget_template") {
    const missing = (rows ?? []).filter((row) => !categoryMap.has(String((row.normalized_data as NormalizedImportRow).category ?? "").toLowerCase()));
    if (missing.length) { for (const row of missing) { await admin.from("import_rows").update({ status: "review" }).eq("id", row.id); await admin.from("import_errors").insert({ household_id: auth.householdId, import_id: id, import_row_id: row.id, code: "unknown_category", message: "Create this category or correct its name before applying." }); } await refreshCounts(admin, id); return NextResponse.json({ message: `${missing.length} budget rows reference categories that do not exist.` }, { status: 409 }); }
  }
  let applied = 0; let failed = 0;
  for (const row of rows ?? []) { const normalized = row.normalized_data as NormalizedImportRow; const result = await applyRow(admin, auth.householdId, item.import_type as ImportType, item.account_id as string | null, row.id as string, row.fingerprint as string, row.raw_data as Record<string, unknown>, normalized, categoryMap, unsortedId); if (result === "applied") applied += 1; else if (result === "failed") failed += 1; }
  if (failed) { await refreshCounts(admin, id); return NextResponse.json({ message: `${applied} rows applied, but ${failed} could not be applied. The import remains open for a safe retry.` }, { status: 500 }); }
  const now = new Date().toISOString(); await admin.from("imports").update({ status: "applied", applied_at: now, updated_at: now }).eq("id", id); await admin.from("audit_events").insert({ household_id: auth.householdId, actor_user_id: auth.userId, entity_type: "import", entity_id: id, action: "applied", metadata: { importType: item.import_type, appliedRows: applied } });
  return NextResponse.json({ message: `Import applied. ${applied} rows changed SPND.` });
}

async function applyRow(admin: ReturnType<typeof createAdminClient>, householdId: string, type: ImportType, accountId: string | null, rowId: string, fingerprint: string, raw: Record<string, unknown>, value: NormalizedImportRow, categories: Map<string, string>, unsortedId?: string) {
  let entityType = ""; let entityId: string | null = null;
  if (type === "bank_transactions" || type === "credit_card_transactions") {
    if (!accountId) return "failed"; const source = `document:${fingerprint}`; const { data: existing } = await admin.from("transactions").select("id").eq("account_id", accountId).eq("source_fingerprint", source).maybeSingle();
    if (existing) { await admin.from("import_rows").update({ status: "duplicate", applied_entity_type: "transaction", applied_entity_id: existing.id }).eq("id", rowId); return "duplicate"; }
    const merchant = String(value.merchant); const { data: transaction } = await admin.from("transactions").insert({ household_id: householdId, account_id: accountId, source_fingerprint: source, transacted_at: `${value.date}T12:00:00.000Z`, posted_at: `${value.date}T12:00:00.000Z`, amount_cents: Number(value.amountCents), merchant, normalized_merchant: normalizeMerchant(merchant), raw_description: String(value.description ?? merchant), status: "posted", raw_payload: { source: "document_import", row: raw } }).select("id").single();
    if (!transaction) return "failed"; entityType = "transaction"; entityId = transaction.id as string; if (Number(value.amountCents) < 0) { const categoryId = categories.get(String(value.category ?? "").toLowerCase()) ?? unsortedId; if (categoryId) await admin.from("transaction_allocations").insert({ household_id: householdId, transaction_id: entityId, category_id: categoryId, amount_cents: Number(value.amountCents), source: categoryId === unsortedId ? "unsorted" : "manual" }); }
  } else if (type === "budget_template") {
    const categoryId = categories.get(String(value.category).toLowerCase()); if (!categoryId) return "failed"; const { data } = await admin.from("monthly_budgets").upsert({ household_id: householdId, month: value.month, category_id: categoryId, budgeted_cents: Number(value.budgetedCents), updated_at: new Date().toISOString() }, { onConflict: "household_id,month,category_id" }).select("id").single(); entityType = "monthly_budget"; entityId = data?.id as string | null;
  } else if (type === "recurring_bills") {
    const name = String(value.name); const { data } = await admin.from("recurring_items").upsert({ household_id: householdId, type: "expense", name, merchant_pattern: normalizeMerchant(name), amount_cents: Number(value.amountCents), cadence: String(value.cadence ?? "monthly"), next_due_date: value.date, category_id: categories.get(String(value.category ?? "").toLowerCase()) ?? null, is_confirmed: true, active: true, updated_at: new Date().toISOString() }, { onConflict: "household_id,type,merchant_pattern" }).select("id").single(); entityType = "recurring_item"; entityId = data?.id as string | null;
  } else {
    const { data } = await admin.from("planned_items").insert({ household_id: householdId, name: value.name, date: value.date, amount_cents: Number(value.amountCents), type: type === "income" ? "income" : "expense", category_id: categories.get(String(value.category ?? "").toLowerCase()) ?? null }).select("id").single(); entityType = "planned_item"; entityId = data?.id as string | null;
  }
  if (!entityId) return "failed"; await admin.from("import_rows").update({ status: "applied", applied_entity_type: entityType, applied_entity_id: entityId, updated_at: new Date().toISOString() }).eq("id", rowId); return "applied";
}

async function refreshCounts(admin: ReturnType<typeof createAdminClient>, importId: string) { const { data } = await admin.from("import_rows").select("status").eq("import_id", importId); const accepted = (data ?? []).filter((row) => row.status === "accepted").length; const duplicates = (data ?? []).filter((row) => row.status === "duplicate").length; const review = (data ?? []).filter((row) => row.status === "review").length; await admin.from("imports").update({ accepted_rows: accepted, duplicate_rows: duplicates, review_rows: review, status: review ? "review" : "ready", updated_at: new Date().toISOString() }).eq("id", importId); }
