"use client";

import { format } from "date-fns";
import { Check, FileSpreadsheet, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import type { ImportInboxItem } from "@/lib/data";

const typeLabels: Record<string, string> = {
  bank_transactions: "Bank transaction CSV",
  credit_card_transactions: "Credit-card transaction CSV",
  budget_template: "Budget template CSV/XLSX",
  income: "Income or paycheck",
  recurring_bills: "Recurring bills",
  planned_expenses: "Planned expenses",
};

const statusLabels: Record<string, string> = {
  parsing: "Parsing",
  review: "Needs review",
  ready: "Ready to apply",
  applied: "Applied",
  rejected: "Rejected",
  error: "Failed",
};

export function ImportInbox({ initialImports, accounts }: { initialImports: ImportInboxItem[]; accounts: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [type, setType] = useState("bank_transactions");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<ImportInboxItem | null>(null);
  const needsAccount = type === "bank_transactions" || type === "credit_card_transactions";

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setLoading(true); setMessage("");
    try {
      const data = new FormData(); data.set("file", file); data.set("importType", type); if (needsAccount) data.set("accountId", accountId);
      const response = await fetch("/api/imports", { method: "POST", body: data });
      const body = await response.json() as { message?: string };
      setMessage(body.message ?? (response.ok ? "Document uploaded for review." : "The document could not be uploaded."));
      if (response.ok) { setFile(null); router.refresh(); }
    } catch {
      setMessage("The document could not be uploaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function action(id: string, actionName: "apply" | "reject") {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/imports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName }) });
      const body = await response.json() as { message?: string };
      setMessage(body.message ?? (response.ok ? "Import updated." : "The import could not be updated."));
      if (response.ok) setConfirming(null);
      router.refresh();
    } catch {
      setMessage("The import could not be updated. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <form className="import-upload card" onSubmit={upload}>
      <div className="import-upload-icon"><Upload /></div>
      <div className="field"><label htmlFor="import-type">Document type</label><select id="import-type" value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {needsAccount ? <div className="field"><label htmlFor="import-account">Account</label><select id="import-account" required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div> : null}
      <div className="field"><label htmlFor="import-file">CSV, XLSX, or PDF · 10 MB maximum</label><input id="import-file" type="file" accept=".csv,.xlsx,.pdf,text/csv,application/pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
      <button className="primary-button" disabled={loading || !file}>{loading ? "Processing…" : "Upload for review"}</button>
      <p className="import-safety">PDF contents are retained for review and never applied automatically.</p>
    </form>
    <p className="form-message" role="status">{message}</p>
    <div className="section-heading"><h2>Import history</h2></div>
    {initialImports.length ? <div className="import-history">{initialImports.map((item) => <details className="import-card card" key={item.id} open={item.status === "review" || item.status === "ready"}>
      <summary><FileSpreadsheet /><span><strong>{item.fileName}</strong><small>{typeLabels[item.importType] ?? item.importType} · {format(new Date(item.createdAt), "MMM d, yyyy")}</small></span><em className={`import-status ${item.status}`}>{statusLabels[item.status] ?? item.status}</em></summary>
      <div className="import-counts"><span><strong>{item.acceptedRows}</strong> accepted</span><span><strong>{item.duplicateRows}</strong> duplicate</span><span><strong>{item.reviewRows}</strong> review</span></div>
      {item.errors.length ? <div className="import-errors" role="alert">{item.errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      {item.rows.length ? <div className="import-preview">{item.rows.slice(0, 100).map((row) => <ImportRow key={row.id} importId={item.id} row={row} />)}</div> : <p className="import-empty">No structured rows are available. Review the error above or upload a CSV/XLSX version.</p>}
      <div className="import-actions">{!["applied", "rejected", "error"].includes(item.status) ? <><button type="button" className="primary-button" disabled={loading || item.status !== "ready"} onClick={() => setConfirming(item)}><Check size={17} /> Review and apply</button><button type="button" className="secondary-button" disabled={loading} onClick={() => action(item.id, "reject")}><X size={17} /> Reject</button></> : null}</div>
    </details>)}</div> : <div className="empty-state card"><FileSpreadsheet /><h2>No imports yet</h2><p>Your uploaded documents and review history will appear here.</p></div>}
    {confirming ? <ApplyConfirmation item={confirming} loading={loading} onCancel={() => setConfirming(null)} onConfirm={() => action(confirming.id, "apply")} /> : null}
  </>;
}

function ApplyConfirmation({ item, loading, onCancel, onConfirm }: { item: ImportInboxItem; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  const acceptedRows = item.rows.filter((row) => row.status === "accepted");
  return <BottomSheet className="import-confirm-sheet" label={`Apply ${item.fileName}`} onClose={onCancel} handleLabel="Drag down to close apply confirmation">
    <div className="sheet-title"><div><p className="eyebrow">Final confirmation</p><h2>Apply {acceptedRows.length} rows?</h2></div><button className="icon-button" onClick={onCancel} aria-label="Close apply confirmation"><X /></button></div>
    <p className="import-confirm-copy">This will change SPND using the reviewed rows below. {item.duplicateRows ? `${item.duplicateRows} duplicate rows will remain unchanged.` : "No duplicate rows will be applied."}</p>
    <div className="import-confirm-preview">{acceptedRows.slice(0, 5).map((row) => <div key={row.id}><strong>Row {row.rowNumber}</strong><span>{Object.values(row.normalized).filter((value) => value !== null && value !== "").slice(0, 3).map(String).join(" · ")}</span></div>)}{acceptedRows.length > 5 ? <p>+ {acceptedRows.length - 5} more reviewed rows</p> : null}</div>
    <div className="import-confirm-actions"><button className="primary-button" disabled={loading} onClick={onConfirm}>{loading ? "Applying…" : "Confirm and apply"}</button><button className="secondary-button" disabled={loading} onClick={onCancel}>Cancel</button></div>
  </BottomSheet>;
}

function ImportRow({ importId, row }: { importId: string; row: ImportInboxItem["rows"][number] }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [values, setValues] = useState(row.normalized); const [message, setMessage] = useState("");
  async function save() { try { const response = await fetch(`/api/imports/${importId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update_row", rowId: row.id, normalized: values }) }); const body = await response.json() as { message?: string }; setMessage(body.message ?? (response.ok ? "Row updated." : "The row could not be updated.")); if (response.ok) { setEditing(false); router.refresh(); } } catch { setMessage("The row could not be updated. Check your connection and try again."); } }
  return <div className={`import-row ${row.status}`}><div className="import-row-heading"><strong>Row {row.rowNumber}</strong><span>{row.status}</span><button type="button" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Correct"}</button></div>{editing ? <div className="import-row-fields">{Object.entries(values).map(([key, value]) => <label key={key}><span>{key}</span><input value={typeof value === "number" ? value : String(value ?? "")} type={key.toLowerCase().includes("cents") ? "number" : "text"} onChange={(event) => setValues({ ...values, [key]: key.toLowerCase().includes("cents") ? Number(event.target.value) : event.target.value })} /></label>)}<button type="button" className="secondary-button" onClick={save}>Validate row</button></div> : <p>{Object.entries(values).map(([key, value]) => `${key}: ${String(value ?? "—")}`).join(" · ")}</p>}{row.errors.map((error) => <small className="row-error" key={error}>{error}</small>)}<small role="status">{message}</small></div>;
}
