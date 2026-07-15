"use client";

import { addMonths, format, parseISO } from "date-fns";
import { Archive, ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Goal, Layers3, Plus, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryActivity } from "@/components/category-activity";
import { TransactionDetail } from "@/components/transaction-detail";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon, categoryIcons } from "@/components/icons";
import { sortBudgetCategories } from "@/lib/budget-sort";
import type { ActivityTransaction, BudgetCategory, BudgetWorkspace as Workspace } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const colors = ["#9B6CFF", "#FFD24A", "#45D9E1", "#FF705B", "#58A6FF", "#FF5D6C", "#F79AD3", "#63D9A2", "#FF9F43", "#7D8CFF", "#B7E36B", "#A6ACB8"];

export function BudgetWorkspace({ initialWorkspace }: { initialWorkspace: Workspace }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialWorkspace.categories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [filter, setFilter] = useState("All");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [movingFromId, setMovingFromId] = useState<string | null>(null);
  const monthDate = parseISO(initialWorkspace.month);
  const selected = categories.find((category) => category.id === selectedId) ?? null;
  const visible = categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const categoryGroups = [...initialWorkspace.categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder).map((group) => group.name);
  const budgetGroups = categoryGroups.filter((group) => group !== "Excluded" && group !== "Income");
  const groups = ["All", ...budgetGroups];
  const totals = useMemo(() => ({ budgeted: visible.reduce((sum, item) => sum + item.budgetedCents, 0), spent: visible.reduce((sum, item) => sum + item.spentCents, 0), pending: visible.reduce((sum, item) => sum + item.pendingCents, 0) }), [visible]);
  const available = initialWorkspace.totals.expectedIncomeCents - totals.budgeted;
  const displayedGroups = (filter === "All" ? budgetGroups : [filter]).map((name) => ({ name, categories: sortBudgetCategories(visible.filter((category) => category.categoryGroup === name)) })).filter((group) => group.categories.length);
  const excluded = categories.filter((category) => !category.isActive || category.isExcluded || (!category.showInBudget && category.categoryGroup !== "Income"));
  const alert = sortBudgetCategories(visible).find((category) => category.spentCents + category.pendingCents > category.budgetedCents);

  async function saveBudget(categoryId: string, budgetedCents: number) {
    const before = categories; setCategories((items) => items.map((item) => item.id === categoryId ? { ...item, budgetedCents } : item)); setMessage("");
    const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId, budgetedCents, month: initialWorkspace.month }) });
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
  async function setupMonth(action: "copy_previous" | "save_template" | "apply_template") {
    const preview = action === "copy_previous" ? initialWorkspace.monthSetup.previousTotalCents : action === "apply_template" ? initialWorkspace.monthSetup.templateTotalCents : totals.budgeted;
    if (!window.confirm(`${action === "save_template" ? "Save" : "Apply"} ${formatCurrency(preview)} across ${action === "copy_previous" ? initialWorkspace.monthSetup.previousCategoryCount : action === "apply_template" ? initialWorkspace.monthSetup.templateCategoryCount : visible.filter((item) => item.budgetedCents > 0).length} categories?`)) return;
    const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, month: initialWorkspace.month }) }); const body = await response.json() as { message?: string }; setMessage(body.message ?? ""); if (response.ok) router.refresh();
  }
  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), categoryGroup: form.get("categoryGroup") }) }); const body = await response.json() as { message?: string; category?: BudgetCategory }; setMessage(body.message ?? ""); if (response.ok && body.category) { setCategories([...categories, body.category]); setAddingCategory(false); }
  }
  async function moveMoney(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromCategoryId: form.get("fromCategoryId"), toCategoryId: form.get("toCategoryId"), amountCents: Math.round(Number(form.get("amount")) * 100), month: initialWorkspace.month }) }); const body = await response.json() as { message?: string }; setMessage(body.message ?? ""); if (response.ok) { setMovingFromId(null); router.refresh(); }
  }

  return <>
    <header className="budget-heading"><div><h1 className="page-title">Budget</h1><p className="page-subtitle">Plan the month together.</p></div><button className="secondary-button compact-button" onClick={() => { setSelectedId(null); setEditingBudget(true); }}><SlidersHorizontal size={16} /> Edit budget</button></header>
    <nav className="month-rail" aria-label="Budget month">{[-2,-1,0,1,2].map((offset) => { const date = addMonths(monthDate, offset); return <Link key={offset} className={offset === 0 ? "selected" : ""} aria-current={offset === 0 ? "date" : undefined} href={`/budget?month=${format(date, "yyyy-MM")}`}>{offset === -2 ? <ChevronLeft size={16} /> : null}{format(date, offset === 0 ? "MMM yyyy" : "MMM")}{offset === 2 ? <ChevronRight size={16} /> : null}</Link>; })}</nav>
    <section className="budget-summary" aria-label="Monthly budget summary"><div className="budget-summary-copy"><span>{format(monthDate, "MMMM")} left to assign</span><strong className={available < 0 ? "negative" : ""}>{formatCurrency(available)}</strong><small>expected income minus assigned</small></div><div className="budget-summary-ring" style={{ "--spent": `${Math.min(100, totals.budgeted ? (totals.spent + totals.pending) / totals.budgeted * 100 : 0)}%` } as React.CSSProperties}><div><strong>{formatCurrency(totals.spent, { compact: true })}</strong><span>of {formatCurrency(totals.budgeted, { compact: true })}</span><small>spent</small></div></div></section>
    <dl className="budget-metric-strip budget-income-strip"><div><dt>Expected income</dt><dd>{formatCurrency(initialWorkspace.totals.expectedIncomeCents, { compact: true })}</dd></div><div><dt>Received</dt><dd>{formatCurrency(initialWorkspace.totals.receivedIncomeCents, { compact: true })}</dd></div><div><dt>Expected remaining</dt><dd>{formatCurrency(initialWorkspace.totals.remainingExpectedIncomeCents, { compact: true })}</dd></div><div><dt>Assigned</dt><dd>{formatCurrency(totals.budgeted, { compact: true })}</dd></div><div><dt>Left to assign</dt><dd className={available < 0 ? "negative" : ""}>{formatCurrency(available, { compact: true })}</dd></div><div><dt>Spent · Pending</dt><dd>{formatCurrency(totals.spent, { compact: true })} · {formatCurrency(totals.pending, { compact: true })}</dd></div></dl>
    {available < 0 ? <div className="budget-zero-warning"><TriangleAlert size={17} /> Assigned exceeds expected income by {formatCurrency(Math.abs(available))}.</div> : null}
    <div className="budget-workflow-actions"><button className="secondary-button" onClick={() => setupMonth("copy_previous")} disabled={!initialWorkspace.monthSetup.previousCategoryCount}><Copy size={16} /> Copy previous</button><button className="secondary-button" onClick={() => setupMonth("apply_template")} disabled={!initialWorkspace.monthSetup.templateCategoryCount}><Copy size={16} /> Apply template</button><button className="secondary-button" onClick={() => setupMonth("save_template")} disabled={!totals.budgeted}><Save size={16} /> Save template</button><button className="secondary-button" onClick={() => setAddingCategory(true)}><Plus size={16} /> Add category</button><button className="secondary-button" onClick={() => setMovingFromId(visible[0]?.id ?? null)}><ArrowLeftRight size={16} /> Move money</button></div>
    {alert ? <button className="budget-alert" onClick={() => setMovingFromId(alert.id)}><span><TriangleAlert size={17} /><span>{alert.name} is {formatCurrency(alert.spentCents + alert.pendingCents - alert.budgetedCents)} over budget</span></span><strong>Move money <ChevronRight size={16} /></strong></button> : null}
    {initialWorkspace.unsortedCount ? <Link className="budget-review-inline" href={`/activity?category=unsorted&month=${format(monthDate, "yyyy-MM")}`}>{initialWorkspace.unsortedCount} transactions need a category · {formatCurrency(initialWorkspace.unsortedCents)} <ChevronRight size={16} /></Link> : null}
    <div className="budget-filter" role="group" aria-label="Filter budget categories">{groups.map((group) => <button key={group} aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}</div>
    <section className="budget-group"><div className="section-line"><h2>{filter === "All" ? "Category groups" : filter}</h2><span>{displayedGroups.reduce((count, group) => count + group.categories.length, 0)}</span></div><div className="budget-group-stack">{displayedGroups.length ? displayedGroups.map((group) => <BudgetCategoryGroup categories={group.categories} collapsed={collapsedGroups.includes(group.name)} key={group.name} name={group.name} onSelect={(categoryId) => { setSelectedId(categoryId); setMessage(""); }} onToggle={() => setCollapsedGroups((items) => items.includes(group.name) ? items.filter((item) => item !== group.name) : [...items, group.name])} />) : <p className="compact-empty card">No categories in this group.</p>}</div></section>
    {excluded.length ? <details className="archived-categories"><summary>Excluded & archived <span>{excluded.length}</span></summary>{excluded.map((category) => <button key={category.id} onClick={() => setSelectedId(category.id)}><span>{category.name}</span>{!category.isActive ? <RotateCcw size={17} /> : <ChevronRight size={17} />}</button>)}</details> : null}
    {editingBudget ? <BudgetEditor categories={visible} incomeCents={initialWorkspace.totals.expectedIncomeCents} month={initialWorkspace.month} onClose={() => setEditingBudget(false)} onSave={saveMonthlyBudgets} /> : null}
    {addingCategory ? <BottomSheet className="budget-edit-sheet" label="Add category" onClose={() => setAddingCategory(false)}><div className="sheet-title"><h2>Add category</h2><button className="icon-button" onClick={() => setAddingCategory(false)}><X /></button></div><form className="inline-editor" onSubmit={addCategory}><div className="field"><label>Name</label><input name="name" required /></div><div className="field"><label>Group</label><select name="categoryGroup">{budgetGroups.map((group) => <option key={group}>{group}</option>)}</select></div><button className="primary-button">Add category</button></form></BottomSheet> : null}
    {movingFromId ? <BottomSheet className="budget-edit-sheet" label="Move budget money" onClose={() => setMovingFromId(null)}><div className="sheet-title"><h2>Move money</h2><button className="icon-button" onClick={() => setMovingFromId(null)}><X /></button></div><form className="inline-editor" onSubmit={moveMoney}><div className="field"><label>From</label><select name="fromCategoryId" defaultValue={movingFromId}>{visible.map((category) => <option value={category.id} key={category.id}>{category.name} · {formatCurrency(category.budgetedCents)}</option>)}</select></div><div className="field"><label>To</label><select name="toCategoryId" defaultValue={visible.find((item) => item.id !== movingFromId)?.id}>{visible.filter((item) => item.id !== movingFromId).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div><button className="primary-button">Move money</button></form></BottomSheet> : null}
    {selected ? <CategoryPanel allCategories={categories} category={selected} categoryGroups={categoryGroups} month={initialWorkspace.month} message={message} onClose={() => setSelectedId(null)} onMoveMoney={() => { setSelectedId(null); setMovingFromId(selected.id); }} onSaveCategory={saveCategory} onSaveBudget={saveBudget} /> : null}
  </>;
}

const budgetGroupIcons: Record<string, LucideIcon> = { Essentials: ShieldCheck, Lifestyle: Sparkles, Goals: Goal };

function BudgetCategoryGroup({ categories, collapsed, name, onSelect, onToggle }: { categories: BudgetCategory[]; collapsed: boolean; name: string; onSelect: (categoryId: string) => void; onToggle: () => void }) {
  const budgeted = categories.reduce((sum, category) => sum + category.budgetedCents, 0);
  const used = categories.reduce((sum, category) => sum + category.spentCents + category.pendingCents, 0);
  const remaining = budgeted - used;
  const percent = Math.min(100, Math.round(used / Math.max(1, budgeted) * 100));
  const Icon = budgetGroupIcons[name] ?? Layers3;

  return <section className={`budget-category-group card ${collapsed ? "collapsed" : ""}`}><button className="budget-group-summary" aria-expanded={!collapsed} onClick={onToggle}><span className="budget-group-icon"><Icon size={18} /></span><span className="budget-group-copy"><span className="budget-group-topline"><span className="budget-group-title"><strong>{name}</strong><small>{categories.length} categor{categories.length === 1 ? "y" : "ies"}</small></span><span className="budget-group-amount"><strong>{formatCurrency(used, { compact: true })} / {formatCurrency(budgeted, { compact: true })}</strong><small className={remaining < 0 ? "negative" : ""}>{formatCurrency(Math.abs(remaining), { compact: true })} {remaining < 0 ? "over" : "left"}</small></span></span><span className="budget-group-progress"><i style={{ width: `${percent}%` }} /></span></span><ChevronDown className="budget-group-chevron" size={18} /></button>{collapsed ? null : <div className="budget-list">{categories.map((category) => <BudgetRow category={category} key={category.id} onSelect={() => onSelect(category.id)} />)}</div>}</section>;
}

function BudgetEditor({ categories, incomeCents, month, onClose, onSave }: { categories: BudgetCategory[]; incomeCents: number; month: string; onClose: () => void; onSave: (values: Record<string, number>) => Promise<boolean> }) {
  const [drafts, setDrafts] = useState<Record<string, number>>(() => Object.fromEntries(categories.map((category) => [category.id, category.budgetedCents])));
  const [saving, setSaving] = useState(false);
  const assigned = categories.reduce((sum, category) => sum + (drafts[category.id] ?? 0), 0);
  const available = incomeCents - assigned;

  return <BottomSheet className="budget-edit-sheet" label={`Edit ${format(parseISO(month), "MMMM")} budget`} onClose={onClose} handleLabel="Drag down to close monthly budget editor">
    <div className="sheet-title"><div><p className="eyebrow">Monthly plan</p><h2>Edit {format(parseISO(month), "MMMM")} budget</h2></div><button className="icon-button" onClick={onClose} aria-label="Close monthly budget editor"><X /></button></div>
    <dl className="budget-editor-summary"><div><dt>Income</dt><dd>{formatCurrency(incomeCents)}</dd></div><div><dt>Assigned</dt><dd>{formatCurrency(assigned)}</dd></div><div><dt>Available</dt><dd className={available < 0 ? "negative" : "positive"}>{formatCurrency(available)}</dd></div></dl>
    <div className="budget-editor-list">{sortBudgetCategories(categories).map((category) => <label className="budget-editor-row" key={category.id}><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} size={19} /></span><span className="budget-editor-name"><strong>{category.name}</strong><small>{category.categoryGroup}</small></span><span className="money-input"><span>$</span><input aria-label={`${category.name} monthly budget`} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={drafts[category.id] ? drafts[category.id]! / 100 : ""} onChange={(event) => setDrafts({ ...drafts, [category.id]: Math.max(0, Math.round(Number(event.target.value) * 100)) })} /></span></label>)}</div>
    <div className="budget-editor-actions"><button className="primary-button" disabled={saving} onClick={async () => { setSaving(true); if (await onSave(drafts)) onClose(); else setSaving(false); }}><Check size={18} /> {saving ? "Saving…" : "Save monthly budget"}</button></div>
  </BottomSheet>;
}

function CategoryPanel({ allCategories, category, categoryGroups, month, message, onClose, onMoveMoney, onSaveCategory, onSaveBudget }: { allCategories: BudgetCategory[]; category: BudgetCategory; categoryGroups: string[]; month: string; message: string; onClose: () => void; onMoveMoney: () => void; onSaveCategory: (value: BudgetCategory) => Promise<boolean>; onSaveBudget: (id: string, cents: number) => Promise<boolean> }) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState(category);
  const [savingSettings, setSavingSettings] = useState(false);
  const remaining = category.budgetedCents - category.spentCents - category.pendingCents;
  const [detail, setDetail] = useState<ActivityTransaction | null>(null);
  async function openTransaction(id: string) { const response = await fetch(`/api/activity?transaction=${id}`); const body = await response.json() as { transactions?: ActivityTransaction[] }; if (response.ok && body.transactions?.[0]) setDetail(body.transactions[0]); }
  const status = category.budgetedCents === 0 ? "Not budgeted" : remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`;
  return <><BottomSheet className="category-sheet category-detail-sheet" label={`${category.name} category detail`} onClose={onClose} handleLabel="Drag down to close category detail"><div className="sheet-title"><div className="category-detail-title"><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} /></span><div><p className="eyebrow">{status}</p><h2>{category.name}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="category-detail-progress"><span style={{ width: `${Math.min(100, (category.spentCents + category.pendingCents) / Math.max(1, category.budgetedCents) * 100)}%`, background: remaining < 0 ? "var(--red)" : category.color }} /></div>
    <dl className="category-metrics"><div><dt>Budget</dt><dd>{formatCurrency(category.budgetedCents)}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(category.spentCents)}</dd></div><div><dt>Pending</dt><dd>{formatCurrency(category.pendingCents)}</dd></div><div><dt>Remaining</dt><dd className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining)}</dd></div></dl>
    <CategoryActivity category={category} month={month} onTransaction={(transaction) => void openTransaction(transaction.id)} />
    <div className="category-primary-actions"><button className="primary-button" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>{mode === "edit" ? "Close editor" : "Edit monthly amount"}</button><button className="secondary-button" onClick={onMoveMoney}><ArrowLeftRight size={16} /> Move money</button></div>
    {mode === "edit" ? <div className="inline-editor"><h3>Edit monthly budget</h3><div className="field"><label htmlFor="category-budget">Monthly amount</label><input id="category-budget" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={draft.budgetedCents ? draft.budgetedCents / 100 : ""} onChange={(event) => setDraft({ ...draft, budgetedCents: Math.max(0, Math.round(Number(event.target.value) * 100)) })} /></div><button className="primary-button" onClick={async () => { if (await onSaveBudget(category.id, draft.budgetedCents)) setMode("view"); }}>Save monthly budget</button></div> : null}
    <details className="category-settings"><summary><span><CategoryIcon name={draft.icon} size={18} /> Category settings</span><ChevronDown size={17} /></summary><div className="category-settings-body"><div className="field"><label htmlFor="category-name">Name</label><input id="category-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div><div className="field"><label htmlFor="category-group">Group</label><select id="category-group" value={draft.categoryGroup} onChange={(event) => { const categoryGroup = event.target.value; setDraft({ ...draft, categoryGroup, isExcluded: categoryGroup === "Excluded", showInBudget: categoryGroup !== "Excluded" && categoryGroup !== "Income" }); }}>{categoryGroups.map((group) => <option key={group}>{group}</option>)}</select></div><div className="field"><label htmlFor="category-behavior">Accounting behavior</label><select id="category-behavior" value={draft.behaviorType} onChange={(event) => { const behaviorType = event.target.value as BudgetCategory["behaviorType"]; setDraft({ ...draft, behaviorType, isExcluded: behaviorType === "excluded", showInBudget: behaviorType !== "excluded" && behaviorType !== "income" }); }}><option value="spending">Spending</option><option value="obligation">Obligation</option><option value="goal">Goal</option><option value="income">Income</option><option value="excluded">Excluded</option></select></div><details className="category-icon-chooser"><summary><span className="category-disc" style={{ "--category": draft.color } as React.CSSProperties}><CategoryIcon name={draft.icon} size={18} /></span><span><strong>Icon</strong><small>{draft.icon} · Tap to change</small></span><ChevronDown size={16} /></summary><fieldset className="icon-picker"><legend className="sr-only">Choose category icon</legend>{Object.keys(categoryIcons).map((icon) => <button type="button" aria-label={icon} aria-pressed={draft.icon === icon} className={draft.icon === icon ? "selected" : ""} key={icon} onClick={() => setDraft({ ...draft, icon })}><CategoryIcon name={icon} /></button>)}</fieldset></details><fieldset className="category-color-field"><legend>Color</legend><div className="color-picker">{colors.map((color) => <button type="button" aria-label={color} aria-pressed={draft.color === color} className={draft.color === color ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setDraft({ ...draft, color })} />)}</div></fieldset><button className="primary-button" disabled={savingSettings} onClick={async () => { setSavingSettings(true); await onSaveCategory(draft); setSavingSettings(false); }}>{savingSettings ? "Saving…" : "Save category settings"}</button><button className="text-button danger-text" onClick={() => void onSaveCategory({ ...draft, isActive: !draft.isActive })}>{draft.isActive ? <><Archive size={17} /> Hide category</> : <><RotateCcw size={17} /> Restore category</>}</button></div></details><p className="form-message" role="status">{message}</p>
  </BottomSheet>{detail ? <TransactionDetail transaction={detail} categories={allCategories} onClose={() => setDetail(null)} onUpdated={setDetail} /> : null}</>;
}
