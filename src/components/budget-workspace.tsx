"use client";

import { addMonths, format, parseISO } from "date-fns";
import { Archive, ChevronLeft, ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon, categoryIcons } from "@/components/icons";
import type { BudgetCategory, BudgetWorkspace as Workspace } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const groups = ["Essentials", "Lifestyle", "Goals", "Excluded"];
const colors = ["#9B6CFF", "#FFD24A", "#45D9E1", "#FF705B", "#58A6FF", "#FF5D6C", "#C9FF4A", "#A6ACB8"];

export function BudgetWorkspace({ initialWorkspace }: { initialWorkspace: Workspace }) {
  const [categories, setCategories] = useState(initialWorkspace.categories);
  const [selected, setSelected] = useState<BudgetCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const monthDate = parseISO(initialWorkspace.month);
  const visible = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const totals = useMemo(() => ({
    budgeted: visible.reduce((sum, item) => sum + item.budgetedCents, 0),
    spent: visible.reduce((sum, item) => sum + item.spentCents, 0),
    pending: visible.reduce((sum, item) => sum + item.pendingCents, 0),
  }), [visible]);
  const remaining = totals.budgeted - totals.spent;
  const health = totals.budgeted === 0 ? "Add monthly amounts to start planning." : remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over plan. Adjust a category to rebalance.` : `${formatCurrency(remaining)} remains across this month’s plan.`;

  async function saveCategory(category: BudgetCategory) {
    const response = await fetch(`/api/categories/${category.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(category) });
    const body = (await response.json()) as { message?: string };
    if (response.ok) setCategories((items) => items.map((item) => item.id === category.id ? category : item));
    setMessage(body.message ?? (response.ok ? "Category saved." : "Category could not be saved."));
  }

  async function saveBudget(category: BudgetCategory) {
    const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: category.id, budgetedCents: category.budgetedCents, month: initialWorkspace.month }) });
    const body = (await response.json()) as { message?: string };
    if (response.ok) setCategories((items) => items.map((item) => item.id === category.id ? category : item));
    setMessage(body.message ?? (response.ok ? "Monthly amount saved." : "Monthly amount could not be saved."));
  }

  return (
    <>
      <div className="budget-heading">
        <div><h1 className="page-title">Budget</h1><p className="page-subtitle">Plan together, one month at a time.</p></div>
        <button className="icon-button" aria-label="Add category" onClick={() => { setAdding(true); setMessage(""); }}><Plus /></button>
      </div>
      <div className="month-picker" aria-label="Budget month">
        <Link href={`/budget?month=${format(addMonths(monthDate, -1), "yyyy-MM")}`} aria-label="Previous month"><ChevronLeft /></Link>
        <strong>{format(monthDate, "MMMM yyyy")}</strong>
        <Link href={`/budget?month=${format(addMonths(monthDate, 1), "yyyy-MM")}`} aria-label="Next month"><ChevronRight /></Link>
      </div>
      <section className="budget-health card"><span>Budget health</span><strong>{remaining < 0 ? "Needs attention" : "On track"}</strong><p>{health}</p></section>
      <div className="budget-totals">
        <div><span>Budgeted</span><strong>{formatCurrency(totals.budgeted, { compact: true })}</strong></div>
        <div><span>Posted</span><strong>{formatCurrency(totals.spent, { compact: true })}</strong></div>
        <div><span>Pending</span><strong>{formatCurrency(totals.pending, { compact: true })}</strong></div>
        <div><span>Remaining</span><strong className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining, { compact: true })}</strong></div>
      </div>
      {initialWorkspace.unsortedCount > 0 ? <Link className="review-queue card" href="/activity?category=unsorted"><span><strong>{initialWorkspace.unsortedCount} need review</strong><small>{formatCurrency(initialWorkspace.unsortedCents)} is Unsorted</small></span><ChevronRight /></Link> : null}
      {groups.slice(0, 3).map((group) => {
        const items = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded && category.categoryGroup === group);
        return items.length ? <section className="budget-group" key={group}><h2>{group}</h2><div className="card budget-list">{items.map((category) => <BudgetRow category={category} key={category.id} onSelect={() => { setSelected(category); setMessage(""); }} />)}</div></section> : null;
      })}
      {categories.some((category) => !category.isActive || category.isExcluded || !category.showInBudget) ? <details className="archived-categories"><summary>Archived & excluded</summary>{categories.filter((category) => !category.isActive || category.isExcluded || !category.showInBudget).map((category) => <button key={category.id} onClick={() => setSelected(category)}><span>{category.name}</span>{!category.isActive ? <RotateCcw size={17} /> : <ChevronRight size={17} />}</button>)}</details> : null}
      {selected ? <CategoryPanel category={selected} month={initialWorkspace.month} message={message} onClose={() => setSelected(null)} onSaveCategory={saveCategory} onSaveBudget={saveBudget} /> : null}
      {adding ? <AddCategoryPanel message={message} onClose={() => setAdding(false)} onAdded={(category) => { setCategories((items) => [...items, category]); setAdding(false); }} setMessage={setMessage} /> : null}
    </>
  );
}

function CategoryPanel({ category, month, message, onClose, onSaveCategory, onSaveBudget }: { category: BudgetCategory; month: string; message: string; onClose: () => void; onSaveCategory: (value: BudgetCategory) => Promise<void>; onSaveBudget: (value: BudgetCategory) => Promise<void> }) {
  const [draft, setDraft] = useState(category);
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="category-sheet" aria-label={`${category.name} settings`}>
    <div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">Category settings</p><h2>{category.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="field"><label htmlFor="category-name">Name</label><input id="category-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
    <div className="field"><label htmlFor="category-budget">Monthly amount</label><input id="category-budget" type="number" min="0" step="0.01" inputMode="decimal" value={draft.budgetedCents / 100} onChange={(event) => setDraft({ ...draft, budgetedCents: Math.round(Number(event.target.value) * 100) })} /></div>
    <div className="field"><label htmlFor="category-group">Group</label><select id="category-group" value={draft.categoryGroup} onChange={(event) => setDraft({ ...draft, categoryGroup: event.target.value, isExcluded: event.target.value === "Excluded", showInBudget: event.target.value !== "Excluded" })}>{groups.map((group) => <option key={group}>{group}</option>)}</select></div>
    <fieldset className="icon-picker"><legend>Icon</legend>{Object.keys(categoryIcons).map((icon) => <button type="button" aria-label={icon} aria-pressed={draft.icon === icon} className={draft.icon === icon ? "selected" : ""} key={icon} onClick={() => setDraft({ ...draft, icon })}><CategoryIcon name={icon} /></button>)}</fieldset>
    <div className="color-picker" aria-label="Category color">{colors.map((color) => <button aria-label={color} className={draft.color === color ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setDraft({ ...draft, color })} />)}</div>
    <Link className="secondary-button category-transactions" href={`/activity?category=${category.id}&month=${month.slice(0, 7)}`}>View category transactions <ChevronRight size={18} /></Link>
    <div className="sheet-actions"><button className="primary-button" onClick={async () => { await onSaveCategory(draft); await onSaveBudget(draft); }}>Save changes</button><button className="secondary-button" onClick={() => onSaveCategory({ ...draft, isActive: !draft.isActive })}>{draft.isActive ? <><Archive size={17} /> Archive</> : <><RotateCcw size={17} /> Restore</>}</button></div>
    <p className="form-message" role="status">{message}</p>
  </section></div>;
}

function AddCategoryPanel({ message, onClose, onAdded, setMessage }: { message: string; onClose: () => void; onAdded: (category: BudgetCategory) => void; setMessage: (message: string) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Lifestyle");
  return <div className="sheet-backdrop"><section className="category-sheet" aria-label="Add category"><div className="sheet-handle" /><div className="sheet-title"><h2>Add category</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div><div className="field"><label htmlFor="new-category-name">Name</label><input id="new-category-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="new-category-group">Group</label><select id="new-category-group" value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map((item) => <option key={item}>{item}</option>)}</select></div><button className="primary-button" onClick={async () => { const response = await fetch("/api/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, categoryGroup: group }) }); const body = await response.json() as { message?: string; category?: BudgetCategory }; setMessage(body.message ?? ""); if (response.ok && body.category) onAdded(body.category); }}>Add category</button><p className="form-message" role="status">{message}</p></section></div>;
}
