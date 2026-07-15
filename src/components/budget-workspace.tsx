"use client";

import { addMonths, format, parseISO } from "date-fns";
import { Archive, Check, ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon, categoryIcons } from "@/components/icons";
import { sortBudgetCategories } from "@/lib/budget-sort";
import type { BudgetCategory, BudgetWorkspace as Workspace } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

const groups = ["All", "Essentials", "Lifestyle", "Goals"];
const categoryGroups = ["Essentials", "Lifestyle", "Goals", "Excluded"];
const colors = ["#9B6CFF", "#FFD24A", "#45D9E1", "#FF705B", "#58A6FF", "#FF5D6C", "#C9FF4A", "#A6ACB8"];

export function BudgetWorkspace({ initialWorkspace }: { initialWorkspace: Workspace }) {
  const [categories, setCategories] = useState(initialWorkspace.categories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [filter, setFilter] = useState("All");
  const [message, setMessage] = useState("");
  const monthDate = parseISO(initialWorkspace.month);
  const selected = categories.find((category) => category.id === selectedId) ?? null;
  const visible = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const totals = useMemo(() => ({ budgeted: visible.reduce((sum, item) => sum + item.budgetedCents, 0), spent: visible.reduce((sum, item) => sum + item.spentCents, 0), pending: visible.reduce((sum, item) => sum + item.pendingCents, 0) }), [visible]);
  const available = initialWorkspace.totals.incomeCents - totals.budgeted;
  const sorted = sortBudgetCategories(visible.filter((category) => filter === "All" || category.categoryGroup === filter));
  const excluded = categories.filter((category) => !category.isActive || category.isExcluded || !category.showInBudget);
  const alert = sortBudgetCategories(visible).find((category) => category.spentCents + category.pendingCents > category.budgetedCents);

  async function saveBudget(categoryId: string, budgetedCents: number) {
    const before = categories; setCategories((items) => items.map((item) => item.id === categoryId ? { ...item, budgetedCents } : item)); setMessage("");
    const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId, budgetedCents, month: initialWorkspace.month }) });
    const body = await response.json() as { message?: string }; setMessage(body.message ?? ""); if (!response.ok) setCategories(before); return response.ok;
  }
  async function moveMoney(fromCategoryId: string, toCategoryId: string, amountCents: number) {
    const before = categories; setCategories((items) => items.map((item) => item.id === fromCategoryId ? { ...item, budgetedCents: item.budgetedCents - amountCents } : item.id === toCategoryId ? { ...item, budgetedCents: item.budgetedCents + amountCents } : item)); setMessage("");
    const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromCategoryId, toCategoryId, amountCents, month: initialWorkspace.month }) });
    const body = await response.json() as { message?: string }; setMessage(body.message ?? ""); if (!response.ok) setCategories(before); return response.ok;
  }
  async function saveCategory(category: BudgetCategory) {
    const before = categories; setCategories((items) => items.map((item) => item.id === category.id ? category : item));
    const response = await fetch(`/api/categories/${category.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(category) });
    const body = await response.json() as { message?: string }; setMessage(body.message ?? ""); if (!response.ok) setCategories(before); return response.ok;
  }
  async function saveMonthlyBudgets(values: Record<string, number>) {
    const changed = categories.filter((category) => values[category.id] !== undefined && values[category.id] !== category.budgetedCents);
    if (!changed.length) return true;
    const before = categories;
    setMessage("");
    setCategories((items) => items.map((item) => values[item.id] === undefined ? item : { ...item, budgetedCents: values[item.id]! }));
    const response = await fetch("/api/budgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ budgets: changed.map((category) => ({ categoryId: category.id, budgetedCents: values[category.id] })), month: initialWorkspace.month }),
    });
    if (!response.ok) {
      setCategories(before);
      setMessage("The monthly budget could not be saved. Your previous amounts were restored.");
      return false;
    }
    setMessage("Monthly budget updated.");
    return true;
  }

  return <>
    <header className="budget-heading"><div><h1 className="page-title">Budget</h1><p className="page-subtitle">Plan the month together.</p></div><button className="secondary-button compact-button" onClick={() => { setSelectedId(null); setEditingBudget(true); }}><SlidersHorizontal size={16} /> Edit budget</button></header>
    <nav className="month-rail" aria-label="Budget month">{[-2,-1,0,1,2].map((offset) => { const date = addMonths(monthDate, offset); return <Link key={offset} className={offset === 0 ? "selected" : ""} aria-current={offset === 0 ? "date" : undefined} href={`/budget?month=${format(date, "yyyy-MM")}`}>{offset === -2 ? <ChevronLeft size={16} /> : null}{format(date, offset === 0 ? "MMM yyyy" : "MMM")}{offset === 2 ? <ChevronRight size={16} /> : null}</Link>; })}</nav>
    <section className="budget-summary" aria-label="Monthly budget summary"><div className="budget-summary-copy"><span>{format(monthDate, "MMMM")} budget</span><strong className={totals.budgeted - totals.spent - totals.pending < 0 ? "negative" : ""}>{formatCurrency(totals.budgeted - totals.spent - totals.pending)}</strong><small>available after pending</small></div><div className="budget-summary-ring" style={{ "--spent": `${Math.min(100, totals.budgeted ? (totals.spent + totals.pending) / totals.budgeted * 100 : 0)}%` } as React.CSSProperties}><div><strong>{formatCurrency(totals.spent, { compact: true })}</strong><span>of {formatCurrency(totals.budgeted, { compact: true })}</span><small>spent</small></div></div></section>
    <dl className="budget-metric-strip"><div><dt>Income</dt><dd>{formatCurrency(initialWorkspace.totals.incomeCents, { compact: true })}</dd></div><div><dt>Assigned</dt><dd>{formatCurrency(totals.budgeted, { compact: true })}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(totals.spent, { compact: true })}</dd></div><div><dt>Available</dt><dd className={available < 0 ? "negative" : ""}>{formatCurrency(available, { compact: true })}</dd></div></dl>
    {alert ? <button className="budget-alert" onClick={() => setSelectedId(alert.id)}><span><TriangleAlert size={17} /><span>{alert.name} is {formatCurrency(alert.spentCents + alert.pendingCents - alert.budgetedCents)} over budget</span></span><strong>Move money <ChevronRight size={16} /></strong></button> : null}
    {initialWorkspace.unsortedCount ? <Link className="budget-review-inline" href="/activity?category=unsorted">{initialWorkspace.unsortedCount} transactions need a category · {formatCurrency(initialWorkspace.unsortedCents)} <ChevronRight size={16} /></Link> : null}
    <div className="budget-filter" role="group" aria-label="Filter budget categories">{groups.map((group) => <button key={group} aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}</div>
    <section className="budget-group"><div className="section-line"><h2>{filter === "All" ? "Categories" : filter}</h2><span>{sorted.length}</span></div><div className="card budget-list">{sorted.length ? sorted.map((category) => <BudgetRow category={category} key={category.id} onSelect={() => { setSelectedId(category.id); setMessage(""); }} />) : <p className="compact-empty">No categories in this group.</p>}</div></section>
    {excluded.length ? <details className="archived-categories"><summary>Excluded & archived <span>{excluded.length}</span></summary>{excluded.map((category) => <button key={category.id} onClick={() => setSelectedId(category.id)}><span>{category.name}</span>{!category.isActive ? <RotateCcw size={17} /> : <ChevronRight size={17} />}</button>)}</details> : null}
    {editingBudget ? <BudgetEditor categories={visible} incomeCents={initialWorkspace.totals.incomeCents} month={initialWorkspace.month} onClose={() => setEditingBudget(false)} onSave={saveMonthlyBudgets} /> : null}
    {selected ? <CategoryPanel category={selected} categories={visible} month={initialWorkspace.month} message={message} onClose={() => setSelectedId(null)} onSaveCategory={saveCategory} onSaveBudget={saveBudget} onMoveMoney={moveMoney} /> : null}
  </>;
}

function BudgetEditor({ categories, incomeCents, month, onClose, onSave }: { categories: BudgetCategory[]; incomeCents: number; month: string; onClose: () => void; onSave: (values: Record<string, number>) => Promise<boolean> }) {
  const [drafts, setDrafts] = useState<Record<string, number>>(() => Object.fromEntries(categories.map((category) => [category.id, category.budgetedCents])));
  const [saving, setSaving] = useState(false);
  const assigned = categories.reduce((sum, category) => sum + (drafts[category.id] ?? 0), 0);
  const available = incomeCents - assigned;

  return <BottomSheet className="budget-edit-sheet" label={`Edit ${format(parseISO(month), "MMMM")} budget`} onClose={onClose} handleLabel="Drag down to close monthly budget editor">
    <div className="sheet-title"><div><p className="eyebrow">Monthly plan</p><h2>Edit {format(parseISO(month), "MMMM")} budget</h2></div><button className="icon-button" onClick={onClose} aria-label="Close monthly budget editor"><X /></button></div>
    <dl className="budget-editor-summary"><div><dt>Income</dt><dd>{formatCurrency(incomeCents)}</dd></div><div><dt>Assigned</dt><dd>{formatCurrency(assigned)}</dd></div><div><dt>Available</dt><dd className={available < 0 ? "negative" : "positive"}>{formatCurrency(available)}</dd></div></dl>
    <div className="budget-editor-list">{sortBudgetCategories(categories).map((category) => <label className="budget-editor-row" key={category.id}><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} size={19} /></span><span className="budget-editor-name"><strong>{category.name}</strong><small>{category.categoryGroup}</small></span><span className="money-input"><span>$</span><input aria-label={`${category.name} monthly budget`} inputMode="decimal" type="number" min="0" step="0.01" value={(drafts[category.id] ?? 0) / 100} onChange={(event) => setDrafts({ ...drafts, [category.id]: Math.max(0, Math.round(Number(event.target.value) * 100)) })} /></span></label>)}</div>
    <div className="budget-editor-actions"><button className="primary-button" disabled={saving} onClick={async () => { setSaving(true); if (await onSave(drafts)) onClose(); else setSaving(false); }}><Check size={18} /> {saving ? "Saving…" : "Save monthly budget"}</button></div>
  </BottomSheet>;
}

function CategoryPanel({ category, categories, month, message, onClose, onSaveCategory, onSaveBudget, onMoveMoney }: { category: BudgetCategory; categories: BudgetCategory[]; month: string; message: string; onClose: () => void; onSaveCategory: (value: BudgetCategory) => Promise<boolean>; onSaveBudget: (id: string, cents: number) => Promise<boolean>; onMoveMoney: (from: string, to: string, cents: number) => Promise<boolean> }) {
  const [mode, setMode] = useState<"view"|"edit"|"move">("view"); const [draft, setDraft] = useState(category); const [amount, setAmount] = useState(""); const [target, setTarget] = useState(categories.find((item) => item.id !== category.id)?.id ?? ""); const remaining = category.budgetedCents - category.spentCents - category.pendingCents; const groups = groupTransactionsByDay(category.recentTransactions);
  const status = category.budgetedCents === 0 ? "Not budgeted" : remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`;
  return <BottomSheet className="category-sheet category-detail-sheet" label={`${category.name} category detail`} onClose={onClose} handleLabel="Drag down to close category detail"><div className="sheet-title"><div className="category-detail-title"><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} /></span><div><p className="eyebrow">{status}</p><h2>{category.name}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="category-detail-progress"><span style={{ width: `${Math.min(100, (category.spentCents + category.pendingCents) / Math.max(1, category.budgetedCents) * 100)}%`, background: remaining < 0 ? "var(--red)" : category.color }} /></div>
    <dl className="category-metrics"><div><dt>Budget</dt><dd>{formatCurrency(category.budgetedCents)}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(category.spentCents)}</dd></div><div><dt>Pending</dt><dd>{formatCurrency(category.pendingCents)}</dd></div><div><dt>Remaining</dt><dd className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining)}</dd></div></dl>
    <section className="category-activity"><div className="section-line"><h3>Recent transactions</h3><Link href={`/activity?category=${category.id}&month=${month.slice(0,7)}`}>View all</Link></div>{groups.length ? groups.map((group) => <div className="category-day" key={group.key}><h4>{group.label}</h4>{group.transactions.map((transaction) => <Link key={transaction.id} href={`/activity?category=${category.id}`}><span><strong>{transaction.merchant}</strong><small>{transaction.status}{transaction.reviewStatus === "needs_review" ? " · needs review" : ""}</small></span><strong>{formatCurrency(transaction.amountCents, { signed: true })}</strong></Link>)}</div>) : <p className="compact-empty">No transactions in this month.</p>}</section>
    <div className="category-primary-actions"><button className="primary-button" onClick={() => setMode("move")}>Move money</button><button className="secondary-button" onClick={() => setMode("edit")}>Edit budget</button></div>
    {mode === "move" ? <div className="inline-editor"><h3>Move from {category.name}</h3><div className="field"><label htmlFor="move-target">To category</label><select id="move-target" value={target} onChange={(event) => setTarget(event.target.value)}>{categories.filter((item) => item.id !== category.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><div className="field"><label htmlFor="move-amount">Amount</label><input id="move-amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><button className="primary-button" disabled={!target || Math.round(Number(amount) * 100) <= 0 || Math.round(Number(amount) * 100) > category.budgetedCents} onClick={async () => { if (await onMoveMoney(category.id, target, Math.round(Number(amount) * 100))) setMode("view"); }}>Confirm move</button></div> : null}
    {mode === "edit" ? <div className="inline-editor"><h3>Edit monthly budget</h3><div className="field"><label htmlFor="category-budget">Monthly amount</label><input id="category-budget" type="number" min="0" step="0.01" inputMode="decimal" value={draft.budgetedCents / 100} onChange={(event) => setDraft({ ...draft, budgetedCents: Math.round(Number(event.target.value) * 100) })} /></div><button className="primary-button" onClick={async () => { if (await onSaveBudget(category.id, draft.budgetedCents)) setMode("view"); }}>Save budget</button></div> : null}
    <details className="category-settings"><summary>Category settings</summary><div className="field"><label htmlFor="category-name">Name</label><input id="category-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div><div className="field"><label htmlFor="category-group">Group</label><select id="category-group" value={draft.categoryGroup} onChange={(event) => setDraft({ ...draft, categoryGroup: event.target.value, isExcluded: event.target.value === "Excluded", showInBudget: event.target.value !== "Excluded" })}>{categoryGroups.map((group) => <option key={group}>{group}</option>)}</select></div><fieldset className="icon-picker"><legend>Icon</legend>{Object.keys(categoryIcons).map((icon) => <button type="button" aria-label={icon} aria-pressed={draft.icon === icon} className={draft.icon === icon ? "selected" : ""} key={icon} onClick={() => setDraft({ ...draft, icon })}><CategoryIcon name={icon} /></button>)}</fieldset><div className="color-picker" aria-label="Category color">{colors.map((color) => <button type="button" aria-label={color} className={draft.color === color ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setDraft({ ...draft, color })} />)}</div><button className="secondary-button" onClick={() => onSaveCategory(draft)}>Save settings</button><button className="text-button danger-text" onClick={() => onSaveCategory({ ...draft, isActive: !draft.isActive })}>{draft.isActive ? <><Archive size={17} /> Hide category</> : <><RotateCcw size={17} /> Restore category</>}</button></details><p className="form-message" role="status">{message}</p>
  </BottomSheet>;
}
