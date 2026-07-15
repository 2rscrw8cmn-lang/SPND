import { NextResponse } from "next/server";
import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import { fileChecksum, importTypes, parseImportFile, rowFingerprint, validateEditedRow, type ImportType, type NormalizedImportRow } from "@/lib/imports";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { importsEnabled } from "@/lib/env";

const typeSchema = z.enum(importTypes);
const allowedExtensions = [".csv", ".xlsx", ".pdf"];

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  if (!importsEnabled()) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const form = await request.formData(); const file = form.get("file"); const parsedType = typeSchema.safeParse(form.get("importType")); const accountId = String(form.get("accountId") ?? "");
  if (!(file instanceof File) || !parsedType.success) return NextResponse.json({ message: "Choose a supported file and import type." }, { status: 400 });
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ message: "Files must be between 1 byte and 10 MB." }, { status: 400 });
  const extension = allowedExtensions.find((item) => file.name.toLowerCase().endsWith(item));
  if (!extension) return NextResponse.json({ message: "Upload a CSV, XLSX, or PDF file." }, { status: 400 });
  if ((parsedType.data === "bank_transactions" || parsedType.data === "credit_card_transactions") && !z.string().uuid().safeParse(accountId).success) return NextResponse.json({ message: "Choose the account these transactions belong to." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer()); const checksum = fileChecksum(buffer); const admin = createAdminClient();
  const { data: existing } = await admin.from("imports").select("id,status").eq("household_id", auth.householdId).eq("import_type", parsedType.data).eq("file_checksum", checksum).maybeSingle();
  if (existing) return NextResponse.json({ message: "This exact file is already in import history.", importId: existing.id }, { status: 409 });
  if (accountId) { const { data: account } = await admin.from("accounts").select("id").eq("id", accountId).eq("household_id", auth.householdId).maybeSingle(); if (!account) return NextResponse.json({ message: "That account is unavailable." }, { status: 400 }); }
  const { data: created, error } = await admin.from("imports").insert({ household_id: auth.householdId, created_by: auth.userId, import_type: parsedType.data, status: "parsing", file_name: file.name.slice(0, 240), file_checksum: checksum, account_id: accountId || null }).select("id").single();
  if (error || !created) return NextResponse.json({ message: "The import could not be created." }, { status: 500 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180); const storagePath = `${auth.householdId}/${created.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from("source-documents").upload(storagePath, buffer, { contentType: file.type || mimeFor(extension), upsert: false });
  if (storageError) { await admin.from("imports").update({ status: "error" }).eq("id", created.id); return NextResponse.json({ message: "The source document could not be stored privately." }, { status: 500 }); }
  await admin.from("source_documents").insert({ household_id: auth.householdId, import_id: created.id, storage_path: storagePath, mime_type: file.type || mimeFor(extension), size_bytes: file.size });
  if (extension === ".pdf") {
    let extractedText = "";
    try { const pdf = await getDocumentProxy(new Uint8Array(buffer)); const extracted = await extractText(pdf, { mergePages: true }); extractedText = String(extracted.text).slice(0, 8000); } catch { extractedText = "Text extraction was unavailable for this PDF."; }
    const normalized = pdfReviewRow(parsedType.data, extractedText); const fingerprint = rowFingerprint(parsedType.data, normalized);
    const { data: reviewRow } = await admin.from("import_rows").insert({ household_id: auth.householdId, import_id: created.id, row_number: 1, status: "review", fingerprint, raw_data: { extractedText }, normalized_data: normalized }).select("id").single();
    const validation = validateEditedRow(parsedType.data, normalized);
    await admin.from("import_errors").insert([{ household_id: auth.householdId, import_id: created.id, import_row_id: reviewRow?.id, row_number: 1, code: "pdf_manual_review", message: "Review and correct the extracted fields before applying. PDF values are never approved automatically." }, ...validation.map((item) => ({ household_id: auth.householdId, import_id: created.id, import_row_id: reviewRow?.id, row_number: 1, field: item.field ?? null, code: item.code, message: item.message }))]);
    await admin.from("imports").update({ status: "review", review_rows: 1, updated_at: new Date().toISOString() }).eq("id", created.id);
    return NextResponse.json({ message: "PDF text extracted into a review row. Correct every field before applying.", importId: created.id });
  }
  try {
    const rows = await parseImportFile(buffer, file.name, parsedType.data);
    const fingerprints = rows.map((row) => row.fingerprint); const existingFingerprints = new Set<string>();
    for (let start = 0; start < fingerprints.length; start += 150) { const { data } = await admin.from("import_rows").select("fingerprint").eq("household_id", auth.householdId).in("fingerprint", fingerprints.slice(start, start + 150)); for (const item of data ?? []) existingFingerprints.add(item.fingerprint as string); }
    const seenFingerprints = new Set<string>();
    const records = rows.map((row) => { const duplicate = existingFingerprints.has(row.fingerprint) || seenFingerprints.has(row.fingerprint); seenFingerprints.add(row.fingerprint); return { household_id: auth.householdId, import_id: created.id, row_number: row.rowNumber, status: row.errors.length ? "review" : duplicate ? "duplicate" : "accepted", fingerprint: row.fingerprint, raw_data: row.raw, normalized_data: row.normalized }; });
    if (records.length) await admin.from("import_rows").insert(records);
    const { data: savedRows } = await admin.from("import_rows").select("id,row_number").eq("import_id", created.id); const rowIds = new Map((savedRows ?? []).map((row) => [Number(row.row_number), row.id as string]));
    const errors = rows.flatMap((row) => row.errors.map((item) => ({ household_id: auth.householdId, import_id: created.id, import_row_id: rowIds.get(row.rowNumber), row_number: row.rowNumber, field: item.field ?? null, code: item.code, message: item.message })));
    if (errors.length) await admin.from("import_errors").insert(errors);
    const accepted = records.filter((row) => row.status === "accepted").length; const duplicates = records.filter((row) => row.status === "duplicate").length; const review = records.filter((row) => row.status === "review").length;
    await admin.from("imports").update({ status: review ? "review" : "ready", accepted_rows: accepted, duplicate_rows: duplicates, review_rows: review, updated_at: new Date().toISOString() }).eq("id", created.id);
    return NextResponse.json({ message: `${accepted} rows ready, ${duplicates} duplicates, ${review} need review. Nothing has been applied.`, importId: created.id });
  } catch {
    await admin.from("import_errors").insert({ household_id: auth.householdId, import_id: created.id, code: "parse_failed", message: "The file could not be parsed. Check its headers and file format." });
    await admin.from("imports").update({ status: "error", review_rows: 1, updated_at: new Date().toISOString() }).eq("id", created.id);
    return NextResponse.json({ message: "The document was stored, but its rows could not be parsed." }, { status: 422 });
  }
}

function mimeFor(extension: string) { return extension === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : extension === ".pdf" ? "application/pdf" : "text/csv"; }

function pdfReviewRow(type: ImportType, extractedText: string): NormalizedImportRow {
  if (type === "budget_template") return { month: null, category: null, budgetedCents: null, extractedText };
  if (type === "bank_transactions" || type === "credit_card_transactions") return { date: null, merchant: null, description: extractedText, amountCents: null, category: null, extractedText };
  if (type === "recurring_bills") return { name: null, date: null, amountCents: null, cadence: "monthly", category: null, extractedText };
  return { name: null, date: null, amountCents: null, category: null, extractedText };
}
