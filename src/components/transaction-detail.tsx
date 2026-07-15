"use client";

import { format } from "date-fns";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

type Split = { categoryId: string; dollars: number };

export function TransactionDetail({ transaction, categories, onClose, onUpdated }: { transaction: ActivityTransaction; categories: BudgetCategory[]; onClose: () => void; onUpdated: (transaction: ActivityTransaction) => void }) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [note, setNote] = useState(transaction.note);
  const [excluded, setExcluded] = useState(transaction.excluded);
  const [isTransfer, setIsTransfer] = useState(transaction.isTransfer);
  const [isRecurring, setIsRecurring] = useState(transaction.isRecurring);
  const [always, setAlways] = useState(false);
  const [reviewed, setReviewed] = useState(transaction.reviewStatus === "reviewed");
  const [splitting, setSplitting] = useState(transaction.allocations.length > 1);
  const [splits, setSplits] = useState<Split[]>(transaction.allocations.length > 1 ? transaction.allocations.map((item) => ({ categoryId: item.categoryId, dollars: Math.abs(item.amountCents) / 100 })) : [{ categoryId: transaction.categoryId || categories[0]?.id || "", dollars: Math.abs(transaction.amountCents) / 200 }, { categoryId: categories.find((item) => item.id !== transaction.categoryId)?.id ?? "", dollars: Math.abs(transaction.amountCents) / 200 }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const splitCents = splits.reduce((sum, item) => sum + Math.round(item.dollars * 100), 0);
  const targetCents = Math.abs(transaction.amountCents);

  async function save() {
    if (splitting && (splitCents !== targetCents || splits.some((item) => !item.categoryId))) { setMessage(`Splits must total ${formatCurrency(targetCents)} exactly.`); return; }
    setSaving(true); setMessage("");
    const sign = transaction.amountCents < 0 ? -1 : 1;
    const payload = { categoryId: splitting ? undefined : categoryId || null, allocations: splitting ? splits.map((item) => ({ categoryId: item.categoryId, amountCents: Math.round(item.dollars * 100) * sign })) : undefined, note, excluded, isTransfer, isRecurring, alwaysCategorize: always && !splitting && Boolean(categoryId), reviewed };
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { message?: string };
    setSaving(false); setMessage(body.message ?? "");
    if (!response.ok) return;
    const category = categories.find((item) => item.id === categoryId);
    onUpdated({ ...transaction, categoryId: splitting ? splits[0]!.categoryId : categoryId, category: splitting ? "Split" : category?.name ?? "Unsorted", color: splitting ? "#A6ACB8" : category?.color ?? "#A6ACB8", note, excluded: isTransfer || excluded, isTransfer, isRecurring, reviewStatus: reviewed ? "reviewed" : "needs_review", reviewedAt: reviewed ? new Date().toISOString() : null, allocations: splitting ? splits.map((item) => ({ categoryId: item.categoryId, category: categories.find((category) => category.id === item.categoryId)?.name ?? "Unsorted", amountCents: Math.round(item.dollars * 100) * sign })) : categoryId ? [{ categoryId, category: category?.name ?? "Unsorted", amountCents: transaction.amountCents }] : [] });
  }

  async function undo() {
    setSaving(true); const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ undo: true }) }); const body = await response.json() as { message?: string }; setSaving(false); setMessage(body.message ?? ""); if (response.ok) window.location.reload();
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="transaction-sheet" aria-label={`${transaction.merchant} transaction details`}>
    <div className="sheet-handle" /><div className="transaction-detail-header"><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button><span className={`status-badge ${transaction.status}`}>{transaction.status}</span><button className="undo-button" disabled={saving} onClick={undo}><RotateCcw size={16} /> Undo</button></div>
    <div className="transaction-hero"><h2>{transaction.merchant}</h2><strong className={transaction.amountCents > 0 ? "income" : ""}>{formatCurrency(transaction.amountCents, { signed: true })}</strong><p>{format(new Date(transaction.isoDate), "EEEE, MMMM d, yyyy")}</p></div>
    <dl className="transaction-facts"><div><dt>Account</dt><dd>{transaction.accountName}</dd></div><div><dt>Description</dt><dd>{transaction.rawDescription || "No provider description"}</dd></div><div><dt>Review</dt><dd>{reviewed ? "Reviewed" : "Needs review"}</dd></div></dl>
    <div className="field"><label htmlFor="detail-category">Category</label><select id="detail-category" disabled={splitting} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Unsorted</option>{categories.filter((item) => !item.isExcluded).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
    <button className="split-toggle" onClick={() => setSplitting(!splitting)}>Split transaction <ChevronDown className={splitting ? "rotated" : ""} size={18} /></button>
    {splitting ? <div className="split-editor">{splits.map((split, index) => <div className="split-row" key={index}><select aria-label={`Split ${index + 1} category`} value={split.categoryId} onChange={(event) => setSplits(splits.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: event.target.value } : item))}><option value="">Choose category</option>{categories.filter((item) => !item.isExcluded).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><div><span>$</span><input aria-label={`Split ${index + 1} amount`} type="number" min="0" step="0.01" value={split.dollars} onChange={(event) => setSplits(splits.map((item, itemIndex) => itemIndex === index ? { ...item, dollars: Number(event.target.value) } : item))} /></div>{splits.length > 2 ? <button aria-label={`Remove split ${index + 1}`} onClick={() => setSplits(splits.filter((_, itemIndex) => itemIndex !== index))}>×</button> : null}</div>)}<div className={splitCents === targetCents ? "split-total valid" : "split-total"}><span>Total</span><strong>{formatCurrency(splitCents)} / {formatCurrency(targetCents)}</strong></div><button className="text-button" onClick={() => setSplits([...splits, { categoryId: "", dollars: 0 }])}>+ Add another split</button></div> : null}
    <div className="field"><label htmlFor="detail-note">Household note</label><textarea id="detail-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" /></div>
    <div className="transaction-options"><label><input type="checkbox" checked={always} disabled={!categoryId || splitting} onChange={(event) => setAlways(event.target.checked)} /><span>Always categorize {transaction.merchant} this way</span></label><label><input type="checkbox" checked={isTransfer} onChange={(event) => { setIsTransfer(event.target.checked); if (event.target.checked) setExcluded(true); }} /><span>Mark as transfer</span></label><label><input type="checkbox" checked={isRecurring} onChange={(event) => setIsRecurring(event.target.checked)} /><span>Mark as recurring</span></label><label><input type="checkbox" checked={excluded} onChange={(event) => setExcluded(event.target.checked)} /><span>Exclude from budget</span></label><label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>Mark reviewed</span></label></div>
    <button className="primary-button transaction-save" disabled={saving} onClick={save}>{reviewed ? <Check size={18} /> : null}{saving ? "Saving…" : "Save transaction"}</button><p className="form-message" role="status">{message}</p>
  </section></div>;
}
