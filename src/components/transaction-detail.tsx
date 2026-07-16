"use client";

import { format } from "date-fns";
import { ArrowLeft, ArrowLeftRight, BadgeCheck, Check, ChevronDown, ChevronRight, CircleCheck, CreditCard, EyeOff, FileText, MessageSquareText, Pencil, Plus, Repeat2, RotateCcw, Scissors, Sparkles, Store, Tag, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryPickerSheet } from "@/components/category-picker";
import { CategoryIcon } from "@/components/icons";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

type Split = { categoryId: string; dollars: number };
type PickerTarget = { type: "main" } | { type: "split"; index: number };

export function TransactionDetail({ transaction, categories, onClose, onUpdated }: { transaction: ActivityTransaction; categories: BudgetCategory[]; onClose: () => void; onUpdated: (transaction: ActivityTransaction) => void }) {
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [displayName, setDisplayName] = useState(transaction.merchant);
  const [editingName, setEditingName] = useState(false);
  const [note, setNote] = useState(transaction.note);
  const [excluded, setExcluded] = useState(transaction.excluded);
  const [isTransfer, setIsTransfer] = useState(transaction.isTransfer);
  const [isRecurring, setIsRecurring] = useState(transaction.isRecurring);
  const [always, setAlways] = useState(false);
  const [reviewed, setReviewed] = useState(transaction.reviewStatus === "reviewed");
  const [splitting, setSplitting] = useState(transaction.allocations.length > 1);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const absoluteCents = Math.abs(transaction.amountCents);
  const firstSplitCents = Math.floor(absoluteCents / 2);
  const [splits, setSplits] = useState<Split[]>(transaction.allocations.length > 1 ? transaction.allocations.map((item) => ({ categoryId: item.categoryId, dollars: Math.abs(item.amountCents) / 100 })) : [{ categoryId: transaction.categoryId || categories[0]?.id || "", dollars: firstSplitCents / 100 }, { categoryId: categories.find((item) => item.id !== transaction.categoryId)?.id ?? "", dollars: (absoluteCents - firstSplitCents) / 100 }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const splitCents = splits.reduce((sum, item) => sum + Math.round(item.dollars * 100), 0);
  const targetCents = absoluteCents;
  const remainingSplitCents = targetCents - splitCents;
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;
  const dirty = categoryId !== transaction.categoryId || displayName !== transaction.merchant || note !== transaction.note || excluded !== transaction.excluded || isTransfer !== transaction.isTransfer || isRecurring !== transaction.isRecurring || reviewed !== (transaction.reviewStatus === "reviewed") || splitting !== (transaction.allocations.length > 1) || always;
  const dirtyRef = useRef(dirty);
  const onCloseRef = useRef(onClose);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const marker = { spndTransaction: transaction.id };
    const url = new URL(window.location.href);
    url.searchParams.set("transaction", transaction.id);
    if (window.history.state?.spndTransaction !== transaction.id) window.history.pushState(marker, "", url);
    const onPopState = () => {
      if (dirtyRef.current && !window.confirm("Discard unsaved transaction changes?")) {
        window.history.pushState(marker, "", url);
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [transaction.id]);
  function close() {
    if (dirty && !window.confirm("Discard unsaved transaction changes?")) return;
    if (window.history.state?.spndTransaction === transaction.id) window.history.back();
    else onClose();
  }

  function splitEvenly() {
    const base = Math.floor(targetCents / splits.length);
    const remainder = targetCents - base * splits.length;
    setSplits(splits.map((split, index) => ({ ...split, dollars: (base + (index < remainder ? 1 : 0)) / 100 })));
  }

  function selectCategory(category: BudgetCategory | null) {
    if (!pickerTarget) return;
    if (pickerTarget.type === "main") setCategoryId(category?.id ?? "");
    else setSplits(splits.map((split, index) => index === pickerTarget.index ? { ...split, categoryId: category?.id ?? "" } : split));
  }

  async function save() {
    if (splitting && (splitCents !== targetCents || splits.some((item) => !item.categoryId || Math.round(item.dollars * 100) <= 0))) {
      setMessage(`Each split needs a category and positive amount, totaling ${formatCurrency(targetCents)} exactly.`);
      return;
    }
    setSaving(true);
    setMessage("");
    const sign = transaction.amountCents < 0 ? -1 : 1;
    const effectivelyReviewed = reviewed || excluded || isTransfer;
    const payload = { displayName: displayName === transaction.importedMerchant ? null : displayName, categoryId: splitting ? undefined : categoryId || null, allocations: splitting ? splits.map((item) => ({ categoryId: item.categoryId, amountCents: Math.round(item.dollars * 100) * sign })) : undefined, note, excluded, isTransfer, isRecurring, alwaysCategorize: always && !splitting && Boolean(categoryId), reviewed: effectivelyReviewed, expectedUpdatedAt: transaction.updatedAt };
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { message?: string; transaction?: { updated_at?: string } };
    setSaving(false);
    setMessage(body.message ?? "");
    if (!response.ok) return;
    const category = categories.find((item) => item.id === categoryId);
    onUpdated({ ...transaction, updatedAt: body.transaction?.updated_at ?? transaction.updatedAt, merchant: displayName, categoryId: splitting ? splits[0]!.categoryId : categoryId, category: splitting ? "Split" : category?.name ?? "Unsorted", color: splitting ? "#A6ACB8" : category?.color ?? "#A6ACB8", allocationSource: always ? "merchant_rule" : splitting || categoryId !== transaction.categoryId ? "manual" : transaction.allocationSource, note, excluded: isTransfer || excluded, isTransfer, isRecurring, reviewStatus: effectivelyReviewed ? "reviewed" : "needs_review", reviewedAt: effectivelyReviewed ? new Date().toISOString() : null, allocations: splitting ? splits.map((item) => ({ categoryId: item.categoryId, category: categories.find((candidate) => candidate.id === item.categoryId)?.name ?? "Unsorted", amountCents: Math.round(item.dollars * 100) * sign })) : categoryId ? [{ categoryId, category: category?.name ?? "Unsorted", amountCents: transaction.amountCents }] : [] });
  }

  async function undo() {
    setSaving(true);
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ undo: true }) });
    const body = await response.json() as { message?: string; restored?: { displayName: string | null; note: string | null; excluded: boolean; isTransfer: boolean; isRecurring: boolean; reviewStatus: string; allocations: Array<{ categoryId: string; amountCents: number }> } };
    setSaving(false);
    setMessage(body.message ?? "");
    if (response.ok && body.restored) { const category = categories.find((item) => item.id === body.restored!.allocations[0]?.categoryId); onUpdated({ ...transaction, merchant: body.restored.displayName || transaction.importedMerchant, note: body.restored.note ?? "", excluded: body.restored.excluded, isTransfer: body.restored.isTransfer, isRecurring: body.restored.isRecurring, reviewStatus: body.restored.reviewStatus as "reviewed" | "needs_review", categoryId: body.restored.allocations.length === 1 ? body.restored.allocations[0]!.categoryId : body.restored.allocations[0]?.categoryId ?? "", category: body.restored.allocations.length > 1 ? "Split" : category?.name ?? "Unsorted", color: body.restored.allocations.length > 1 ? "#A6ACB8" : category?.color ?? "#A6ACB8", allocations: body.restored.allocations.map((item) => ({ ...item, category: categories.find((candidate) => candidate.id === item.categoryId)?.name ?? "Unsorted" })) }); }
  }

  const pickerCategoryId = pickerTarget?.type === "split" ? splits[pickerTarget.index]?.categoryId ?? "" : categoryId;
  const pickerTitle = pickerTarget?.type === "split" ? `Split ${pickerTarget.index + 1}` : displayName;

  return <>
    <BottomSheet className="transaction-sheet" label={`${transaction.merchant} transaction details`} onClose={close} handleLabel="Drag down to close transaction details">
      <div className="transaction-detail-header"><button className="icon-button" onClick={close} aria-label="Back to transactions"><ArrowLeft /></button><span className={`status-badge ${transaction.status}`}>{transaction.status}</span>{transaction.auditHistory.some((event) => event.undoable) ? <button className="undo-button" disabled={saving} onClick={undo}><RotateCcw size={16} /> Undo</button> : <span />}</div>

      <div className="transaction-hero"><span className={`transaction-merchant-icon ${reviewed ? "reviewed" : "needs-review"}`} aria-hidden="true"><Store size={23} /></span><h2>{displayName}</h2><strong className={transaction.amountCents > 0 ? "income" : ""}>{formatCurrency(transaction.amountCents, { signed: true })}</strong><p>{format(new Date(transaction.isoDate), "EEEE, MMMM d, yyyy")}</p><button className="edit-merchant-button" onClick={() => setEditingName(!editingName)}><Pencil size={13} /> Edit merchant name</button></div>
      {editingName ? <div className="field merchant-name-editor"><label htmlFor="detail-display-name">Merchant display name</label><input id="detail-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div> : null}

      <dl className="transaction-facts"><div><dt><CreditCard size={15} /> Account</dt><dd>{transaction.accountName}</dd></div><div><dt><FileText size={15} /> Description</dt><dd>{transaction.rawDescription || "No provider description"}</dd></div><div><dt><CircleCheck size={15} /> Review</dt><dd className={reviewed ? "reviewed-text" : "needs-review-text"}>{reviewed ? "Reviewed" : "Needs review"}</dd></div></dl>

      <section className="transaction-section"><div className="transaction-section-heading"><span><Tag size={16} /> {transaction.amountCents > 0 ? "Income category" : "Category"}</span>{splitting ? <small>Managed by split</small> : null}</div><button className="category-select-trigger" disabled={splitting} onClick={() => setPickerTarget({ type: "main" })}>{selectedCategory ? <span className="category-select-icon" style={{ "--category": selectedCategory.color } as React.CSSProperties}><CategoryIcon name={selectedCategory.icon} size={19} /></span> : <span className="category-select-icon unsorted"><Tag size={18} /></span>}<span><strong>{splitting ? `${splits.length} split categories` : selectedCategory?.name ?? "Unsorted"}</strong><small>{splitting ? "Turn off split to choose one category" : transaction.allocationSource === "merchant_rule" && categoryId === transaction.categoryId ? <span className="remembered-hint"><Sparkles size={11} /> Remembered rule applied this category</span> : transaction.allocationSource === "merchant_history" && categoryId === transaction.categoryId ? "Suggested from merchant history" : transaction.amountCents > 0 ? "Track where this income came from" : "Tap to change category"}</small></span><ChevronRight size={19} /></button></section>

      <section className="transaction-section split-section"><button className={`split-control ${splitting ? "active" : ""}`} aria-pressed={splitting} onClick={() => setSplitting(!splitting)}><span className="split-control-icon"><Scissors size={19} /></span><span><strong>Split transaction</strong><small>{splitting ? `${splits.length} allocations · ${formatCurrency(splitCents)} assigned` : "Divide this charge across categories"}</small></span><span className="option-switch" aria-hidden="true"><span /></span></button>
        {splitting ? <div className="split-editor"><div className="split-editor-heading"><span>Allocations</span><button onClick={splitEvenly}>Split evenly</button></div>{splits.map((split, index) => { const category = categories.find((candidate) => candidate.id === split.categoryId); return <div className="split-row split-allocation" key={index}><div className="split-allocation-heading"><strong>Split {index + 1}</strong>{splits.length > 2 ? <button aria-label={`Remove split ${index + 1}`} onClick={() => setSplits(splits.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button> : null}</div><button className="split-category-trigger" onClick={() => setPickerTarget({ type: "split", index })}>{category ? <span className="category-select-icon" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} size={17} /></span> : <span className="category-select-icon unsorted"><Tag size={16} /></span>}<span>{category?.name ?? "Choose category"}</span><ChevronRight size={17} /></button><label><span>Amount</span><span className="split-money-input"><span>$</span><input aria-label={`Split ${index + 1} amount`} type="number" min="0" step="0.01" value={split.dollars} onChange={(event) => setSplits(splits.map((item, itemIndex) => itemIndex === index ? { ...item, dollars: Number(event.target.value) } : item))} /></span></label></div>; })}<div className={splitCents === targetCents ? "split-total valid" : "split-total"}><span>{splitCents === targetCents ? "Fully allocated" : remainingSplitCents > 0 ? "Left to allocate" : "Over allocated"}</span><strong>{formatCurrency(Math.abs(remainingSplitCents))}</strong></div><button className="add-split-button" onClick={() => setSplits([...splits, { categoryId: "", dollars: 0 }])}><Plus size={16} /> Add another split</button></div> : null}
      </section>

      <section className="transaction-section note-section"><div className="transaction-section-heading"><span><MessageSquareText size={16} /> Household note</span></div><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context for your household…" /></section>

      <section className="transaction-section review-section"><div className="transaction-section-heading"><span>Review status</span></div><OptionToggle checked={reviewed} description={reviewed ? "This transaction is complete." : "Mark reviewed when the details look right."} icon={BadgeCheck} inputLabel="Mark reviewed" onChange={setReviewed} title={reviewed ? "Reviewed" : "Needs review"} tone="review" /></section>

      <details className="transaction-audit"><summary>Advanced controls <ChevronDown size={16} /></summary><section className="transaction-section"><div className="transaction-section-heading"><span>Automation</span></div><div className="transaction-option-group"><OptionToggle checked={always} description={splitting ? "Rules are unavailable for split transactions." : `Use this category next time ${transaction.merchant} appears.`} disabled={!categoryId || splitting} icon={Sparkles} inputLabel={`Always categorize ${transaction.merchant} this way`} onChange={setAlways} title="Remember this category" /><OptionToggle checked={isRecurring} description="Include this merchant in recurring activity." icon={Repeat2} inputLabel="Mark as recurring" onChange={setIsRecurring} title="Recurring payment" /></div></section><section className="transaction-section"><div className="transaction-section-heading"><span>Budget treatment</span></div><div className="transaction-option-group"><OptionToggle checked={isTransfer} description="Transfers move money between your own accounts." icon={ArrowLeftRight} inputLabel="Mark as transfer" onChange={(checked) => { setIsTransfer(checked); if (checked) { setExcluded(true); setReviewed(true); } }} title="Account transfer" /><OptionToggle checked={excluded || isTransfer} description={isTransfer ? "Transfers are always excluded and reviewed." : "Keep this out of totals and mark it reviewed."} disabled={isTransfer} icon={EyeOff} inputLabel="Exclude from budget" onChange={(checked) => { setExcluded(checked); if (checked) setReviewed(true); }} title="Exclude from budget" /></div></section></details>

      <details className="transaction-audit"><summary>Change history <ChevronDown size={16} /></summary>{transaction.auditHistory.length ? <ol>{transaction.auditHistory.map((event) => <li key={event.id}><span>{event.action}</span><time>{format(new Date(event.createdAt), "MMM d, h:mm a")}</time></li>)}</ol> : <p>No household edits yet.</p>}</details>
      {dirty ? <div className="transaction-save-bar"><button className="primary-button transaction-save" disabled={saving} onClick={save}>{reviewed ? <Check size={18} /> : null}{saving ? "Saving…" : "Save transaction"}</button><p className="form-message" role="status">{message}</p></div> : message ? <p className="form-message" role="status">{message}</p> : null}
    </BottomSheet>
    {pickerTarget ? <CategoryPickerSheet categories={categories.filter((category) => transaction.amountCents > 0 ? category.behaviorType === "income" : category.behaviorType !== "income")} eyebrow={pickerTarget.type === "split" ? "Split category" : "Transaction category"} label={`Choose category for ${pickerTitle}`} onClose={() => setPickerTarget(null)} onSelect={selectCategory} selectedId={pickerCategoryId} title={pickerTitle} /> : null}
  </>;
}

function OptionToggle({ checked, description, disabled = false, icon: Icon, inputLabel, onChange, title, tone = "default" }: { checked: boolean; description: string; disabled?: boolean; icon: LucideIcon; inputLabel: string; onChange: (checked: boolean) => void; title: string; tone?: "default" | "review" }) {
  return <label className={`transaction-option ${checked ? "checked" : ""} ${tone === "review" ? "review-option" : ""} ${disabled ? "disabled" : ""}`}><span className="transaction-option-icon"><Icon size={18} /></span><span className="transaction-option-copy"><strong>{title}</strong><small>{description}</small></span><input className="transaction-option-input" type="checkbox" aria-label={inputLabel} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="option-switch" aria-hidden="true"><span /></span></label>;
}
