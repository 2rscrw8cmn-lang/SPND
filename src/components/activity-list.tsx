"use client";

import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CategoryPickerSheet } from "@/components/category-picker";
import { TransactionDetail } from "@/components/transaction-detail";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { groupTransactionsByDay } from "@/lib/transaction-groups";

type Account = { id: string; name: string };
type Filter = "all" | "needs_review" | "pending" | "income" | "expenses" | "excluded" | "transfers";
type Toast = { message: string; undo?: ActivityTransaction };

export function ActivityList({ initialTransactions, categories, accounts, initialCategoryId }: { initialTransactions: ActivityTransaction[]; categories: BudgetCategory[]; accounts: Account[]; initialCategoryId?: string }) {
  const [transactions, setTransactions] = useState(initialTransactions); const [query, setQuery] = useState(""); const [filter, setFilter] = useState<Filter>(initialCategoryId === "unsorted" ? "needs_review" : "all"); const [categoryFilter, setCategoryFilter] = useState(initialCategoryId ?? ""); const [accountFilter, setAccountFilter] = useState(""); const [dateFilter, setDateFilter] = useState(""); const [selected, setSelected] = useState<ActivityTransaction | null>(null); const [quickCategory, setQuickCategory] = useState<ActivityTransaction | null>(null); const [toast, setToast] = useState<Toast | null>(null);
  const advancedFilterCount = [categoryFilter, accountFilter, dateFilter].filter(Boolean).length;
  const matches = useCallback((transaction: ActivityTransaction) => {
    const matchesQuery = `${transaction.merchant} ${transaction.category} ${transaction.rawDescription}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "needs_review" && transaction.reviewStatus === "needs_review") || (filter === "pending" && transaction.status === "pending") || (filter === "income" && transaction.amountCents > 0) || (filter === "expenses" && transaction.amountCents < 0) || (filter === "excluded" && transaction.excluded) || (filter === "transfers" && transaction.isTransfer);
    const matchesCategory = !categoryFilter || (categoryFilter === "unsorted" ? !transaction.categoryId : transaction.categoryId === categoryFilter); const matchesAccount = !accountFilter || transaction.accountId === accountFilter; const matchesDate = !dateFilter || transaction.isoDate.slice(0, 10) === dateFilter;
    return matchesQuery && matchesFilter && matchesCategory && matchesAccount && matchesDate;
  }, [accountFilter, categoryFilter, dateFilter, filter, query]);
  const filtered = useMemo(() => transactions.filter(matches), [matches, transactions]);
  const groups = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  async function persistReview(transaction: ActivityTransaction, reviewed: boolean) {
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed }) });
    if (!response.ok) { setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item)); setToast({ message: "Review could not be saved. The transaction was restored." }); return false; }
    return true;
  }
  function review(transaction: ActivityTransaction) {
    const updated = { ...transaction, reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString() };
    setTransactions((items) => items.map((item) => item.id === transaction.id ? updated : item)); setToast({ message: `${transaction.merchant} marked reviewed.`, undo: transaction }); void persistReview(transaction, true);
  }
  async function undoReview(transaction: ActivityTransaction) {
    setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item)); setToast({ message: `${transaction.merchant} returned to Needs review.` });
    const ok = await persistReview({ ...transaction, reviewStatus: "reviewed", reviewedAt: new Date().toISOString() }, false); if (!ok) setToast({ message: "Undo could not be saved." });
  }
  async function chooseCategory(transaction: ActivityTransaction, category: BudgetCategory | null) {
    const original = transaction; const updated = { ...transaction, categoryId: category?.id ?? "", category: category?.name ?? "Unsorted", color: category?.color ?? "#A6ACB8", allocations: category ? [{ categoryId: category.id, category: category.name, amountCents: transaction.amountCents }] : [] };
    setTransactions((items) => items.map((item) => item.id === transaction.id ? updated : item)); setQuickCategory(null); setToast({ message: `${transaction.merchant} moved to ${updated.category}.` });
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: category?.id ?? null }) });
    if (!response.ok) { setTransactions((items) => items.map((item) => item.id === transaction.id ? original : item)); setToast({ message: "Category could not be saved. The previous category was restored." }); }
  }
  function detailUpdated(updated: ActivityTransaction) {
    const currentIndex = filtered.findIndex((item) => item.id === updated.id); const shouldAdvance = filter === "needs_review" && updated.reviewStatus === "reviewed";
    setTransactions((items) => items.map((item) => item.id === updated.id ? updated : item));
    if (shouldAdvance) { const remaining = filtered.filter((item) => item.id !== updated.id); setSelected(remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null); }
    else setSelected(updated);
  }

  return <>
    <div className="activity-search field"><label htmlFor="activity-search" className="sr-only">Search activity</label><Search size={19} /><input id="activity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchants or descriptions" /></div>
    <div className="chip-row" aria-label="Activity filters">{(["all", "needs_review", "pending", "expenses", "income", "excluded", "transfers"] as const).map((item) => <button key={item} className={`chip ${filter === item ? "chip-active" : ""}`} onClick={() => setFilter(item)}>{item === "needs_review" ? "Needs review" : item.slice(0, 1).toUpperCase() + item.slice(1)}</button>)}</div>
    <details className="filter-panel"><summary><SlidersHorizontal size={15} /> More filters{advancedFilterCount ? <span className="filter-count">{advancedFilterCount}</span> : null}</summary><div className="filter-grid"><div className="field"><label htmlFor="filter-category">Category</label><select id="filter-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option><option value="unsorted">Unsorted</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="field"><label htmlFor="filter-account">Account</label><select id="filter-account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="filter-date">Date</label><input id="filter-date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>{advancedFilterCount ? <button className="filter-reset" type="button" onClick={() => { setCategoryFilter(""); setAccountFilter(""); setDateFilter(""); }}><RotateCcw size={14} /> Clear filters</button> : null}</div></details>
    <div className="activity-summary" aria-live="polite"><strong>{filtered.length}</strong> transactions{filter === "needs_review" ? " need review" : ""}</div>
    {groups.length ? <div className="activity-groups">{groups.map((group) => <section className="activity-day-group" key={group.key} aria-labelledby={`day-${group.key}`}><h2 id={`day-${group.key}`}>{group.label}</h2><div className="card activity-day-card">{group.transactions.map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} hideDate onSelect={() => setSelected(transaction)} onReview={() => review(transaction)} onChooseCategory={() => setQuickCategory(transaction)} />)}</div></section>)}</div> : <div className="empty-state card"><h2>No activity found</h2><p>Try a different merchant, category, account, date, or filter.</p></div>}
    {selected ? <TransactionDetail key={selected.id} transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={detailUpdated} /> : null}
    {quickCategory ? <CategoryPickerSheet categories={categories} eyebrow="Quick category" label={`Choose category for ${quickCategory.merchant}`} onClose={() => setQuickCategory(null)} onSelect={(category) => void chooseCategory(quickCategory, category)} selectedId={quickCategory.categoryId} title={quickCategory.merchant} /> : null}
    {toast ? <div className="undo-toast" role="status"><span>{toast.message}</span>{toast.undo ? <button onClick={() => { const item = toast.undo; setToast(null); if (item) void undoReview(item); }}>Undo</button> : <button aria-label="Dismiss message" onClick={() => setToast(null)}><X /></button>}</div> : null}
  </>;
}
