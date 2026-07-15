"use client";

import { format, parseISO } from "date-fns";
import { BadgeCheck, CheckCheck, CopyCheck, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryPickerSheet } from "@/components/category-picker";
import { TransactionDetail } from "@/components/transaction-detail";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { findPotentialDuplicates, type DuplicateGroup } from "@/lib/transaction-duplicates";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

type Account = { id: string; name: string };
type Filter = "all" | "needs_review" | "pending" | "income" | "expenses" | "excluded" | "transfers";
type Toast = { message: string; undo?: ActivityTransaction };

type ActivityListProps = {
  initialTransactions: ActivityTransaction[];
  categories: BudgetCategory[];
  accounts: Account[];
  initialCategoryId?: string;
  selectedMonth?: string;
};

export function ActivityList({ initialTransactions, categories, accounts, initialCategoryId, selectedMonth }: ActivityListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialCategoryId === "unsorted" ? "needs_review" : "all");
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId ?? "");
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<ActivityTransaction | null>(null);
  const [quickCategory, setQuickCategory] = useState<ActivityTransaction | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [busyDuplicate, setBusyDuplicate] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState(initialTransactions.length === 50 ? initialTransactions.at(-1)?.isoDate ?? null : null);
  const [loadingPage, setLoadingPage] = useState(false);
  const firstQuery = useRef(true);
  const advancedFilterCount = [categoryFilter, accountFilter, dateFilter].filter(Boolean).length;

  const matches = useCallback((transaction: ActivityTransaction) => {
    const matchesQuery = `${transaction.merchant} ${transaction.category} ${transaction.rawDescription}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "needs_review" && transaction.reviewStatus === "needs_review" && !transaction.excluded)
      || (filter === "pending" && transaction.status === "pending")
      || (filter === "income" && transaction.amountCents > 0)
      || (filter === "expenses" && transaction.amountCents < 0)
      || (filter === "excluded" && transaction.excluded)
      || (filter === "transfers" && transaction.isTransfer);
    const matchesCategory = !categoryFilter || (categoryFilter === "unsorted" ? !transaction.categoryId : transaction.categoryId === categoryFilter);
    const matchesAccount = !accountFilter || transaction.accountId === accountFilter;
    const matchesDate = !dateFilter || transaction.isoDate.slice(0, 10) === dateFilter;
    return matchesQuery && matchesFilter && matchesCategory && matchesAccount && matchesDate;
  }, [accountFilter, categoryFilter, dateFilter, filter, query]);

  const filtered = useMemo(() => transactions.filter(matches), [matches, transactions]);
  const groups = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  const duplicateGroups = useMemo(() => findPotentialDuplicates(transactions), [transactions]);

  const fetchPage = useCallback(async (append: boolean) => {
    setLoadingPage(true); const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim()); if (filter !== "all") params.set("filter", filter); if (categoryFilter && categoryFilter !== "unsorted") params.set("category", categoryFilter); if (accountFilter) params.set("account", accountFilter); if (dateFilter) params.set("date", dateFilter); if (selectedMonth) params.set("month", selectedMonth); if (append && nextCursor) params.set("before", nextCursor);
    const response = await fetch(`/api/activity?${params}`); const body = await response.json() as { transactions?: ActivityTransaction[]; nextCursor?: string | null };
    if (response.ok && body.transactions) { setTransactions((items) => append ? [...items, ...body.transactions!.filter((item) => !items.some((existing) => existing.id === item.id))] : body.transactions!); setNextCursor(body.nextCursor ?? null); }
    setLoadingPage(false);
  }, [accountFilter, categoryFilter, dateFilter, filter, nextCursor, query, selectedMonth]);

  useEffect(() => {
    if (firstQuery.current) { firstQuery.current = false; return; }
    const timer = window.setTimeout(() => { void fetchPage(false); }, 300); return () => window.clearTimeout(timer);
  }, [accountFilter, categoryFilter, dateFilter, filter, query, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistReview(transaction: ActivityTransaction, reviewed: boolean) {
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed }) });
    if (!response.ok) {
      setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item));
      setToast({ message: "Review could not be saved. The transaction was restored." });
      return false;
    }
    return true;
  }

  function review(transaction: ActivityTransaction) {
    if (transaction.excluded) return;
    const updated = { ...transaction, reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString() };
    setTransactions((items) => items.map((item) => item.id === transaction.id ? updated : item));
    setToast({ message: `${transaction.merchant} marked reviewed.`, undo: transaction });
    void persistReview(transaction, true);
  }

  async function reviewDay(key: string, dayTransactions: ActivityTransaction[]) {
    const toReview = dayTransactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded);
    if (!toReview.length) return;
    setBusyDay(key);
    const now = new Date().toISOString();
    setTransactions((items) => items.map((item) => toReview.some((candidate) => candidate.id === item.id) ? { ...item, reviewStatus: "reviewed", reviewedAt: now } : item));
    const results = await Promise.all(toReview.map((transaction) => persistReview(transaction, true)));
    setBusyDay(null);
    if (results.every(Boolean)) setToast({ message: `${toReview.length} transaction${toReview.length === 1 ? "" : "s"} reviewed for the day.` });
  }

  async function undoReview(transaction: ActivityTransaction) {
    setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item));
    setToast({ message: `${transaction.merchant} returned to Needs review.` });
    const ok = await persistReview({ ...transaction, reviewStatus: "reviewed", reviewedAt: new Date().toISOString() }, false);
    if (!ok) setToast({ message: "Undo could not be saved." });
  }

  async function mergeDuplicates(group: DuplicateGroup<ActivityTransaction>) {
    setBusyDuplicate(group.key);
    const response = await fetch("/api/transactions/duplicates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ canonicalId: group.canonical.id, duplicateIds: group.duplicates.map((item) => item.id) }) });
    const body = await response.json() as { message?: string; removedIds?: string[] };
    setBusyDuplicate(null);
    if (!response.ok) {
      setToast({ message: body.message ?? "Duplicates could not be merged." });
      return;
    }
    const removed = new Set(body.removedIds ?? group.duplicates.map((item) => item.id));
    setTransactions((items) => items.filter((item) => !removed.has(item.id)));
    setToast({ message: body.message ?? "Duplicates merged." });
  }

  async function chooseCategory(transaction: ActivityTransaction, category: BudgetCategory | null) {
    const original = transaction;
    const updated = { ...transaction, categoryId: category?.id ?? "", category: category?.name ?? "Unsorted", color: category?.color ?? "#A6ACB8", reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString(), allocations: category ? [{ categoryId: category.id, category: category.name, amountCents: transaction.amountCents }] : [] };
    setTransactions((items) => items.map((item) => item.id === transaction.id ? updated : item));
    setQuickCategory(null);
    setToast({ message: `${transaction.merchant} moved to ${updated.category}.` });
    const categorizeAndReview = transaction.reviewStatus === "needs_review";
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: category?.id ?? null, reviewed: categorizeAndReview }) });
    if (!response.ok) {
      setTransactions((items) => items.map((item) => item.id === transaction.id ? original : item));
      setToast({ message: "Category could not be saved. The previous category was restored." });
    }
  }

  function detailUpdated(updated: ActivityTransaction) {
    const normalized = updated.excluded ? { ...updated, reviewStatus: "reviewed" as const, reviewedAt: updated.reviewedAt ?? new Date().toISOString() } : updated;
    const currentIndex = filtered.findIndex((item) => item.id === updated.id);
    const shouldAdvance = filter === "needs_review" && normalized.reviewStatus === "reviewed";
    setTransactions((items) => items.map((item) => item.id === normalized.id ? normalized : item));
    if (shouldAdvance) {
      const remaining = filtered.filter((item) => item.id !== normalized.id);
      setSelected(remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null);
    } else setSelected(normalized);
  }

  return <>
    {selectedMonth ? <div className="activity-month-context"><span>Showing {format(parseISO(`${selectedMonth.slice(0, 7)}-01`), "MMMM yyyy")}</span><Link href="/activity">All activity</Link></div> : null}
    <div className="activity-search field"><label htmlFor="activity-search" className="sr-only">Search activity</label><Search size={19} /><input id="activity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchants or descriptions" /></div>
    <div className="chip-row" aria-label="Activity filters">{(["all", "needs_review", "pending", "expenses", "income", "excluded", "transfers"] as const).map((item) => <button key={item} className={`chip ${filter === item ? "chip-active" : ""}`} onClick={() => setFilter(item)}>{item === "needs_review" ? "Needs review" : item.slice(0, 1).toUpperCase() + item.slice(1)}</button>)}</div>
    <details className="filter-panel"><summary><SlidersHorizontal size={15} /> More filters{advancedFilterCount ? <span className="filter-count">{advancedFilterCount}</span> : null}</summary><div className="filter-grid"><div className="field"><label htmlFor="filter-category">Category</label><select id="filter-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option><option value="unsorted">Unsorted</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.categoryGroup === "Income" ? `Income · ${category.name}` : category.name}</option>)}</select></div><div className="field"><label htmlFor="filter-account">Account</label><select id="filter-account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="filter-date">Date</label><input id="filter-date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>{advancedFilterCount ? <button className="filter-reset" type="button" onClick={() => { setCategoryFilter(""); setAccountFilter(""); setDateFilter(""); }}><RotateCcw size={14} /> Clear filters</button> : null}</div></details>
    <div className="activity-summary" aria-live="polite"><strong>{filtered.length}</strong> transactions{filter === "needs_review" ? " need review" : " shown"}</div>

    {duplicateGroups.length ? <details className="duplicate-review card"><summary><span><CopyCheck size={18} /><span><strong>{duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? "" : " groups"}</strong><small>Same merchant, amount, and account within three days</small></span></span><span>Review</span></summary><div className="duplicate-review-list">{duplicateGroups.map((group) => <article key={group.key}><div><strong>{group.canonical.merchant}</strong><span>{formatCurrency(group.canonical.amountCents, { signed: true })} · {group.duplicates.length + 1} matching transactions</span></div><button className="secondary-button" disabled={busyDuplicate === group.key} onClick={() => void mergeDuplicates(group)}><CopyCheck size={16} /> {busyDuplicate === group.key ? "Merging…" : `Keep one, merge ${group.duplicates.length}`}</button></article>)}</div></details> : null}

    {groups.length ? <><div className="activity-groups">{groups.map((group) => {
      const needsReview = group.transactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded).length;
      const dayTotal = group.transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
      return <section className="activity-day-group" key={group.key} aria-labelledby={`day-${group.key}`}><header className="activity-day-heading"><div><h2 id={`day-${group.key}`}>{group.label}</h2><span>{group.transactions.length} transaction{group.transactions.length === 1 ? "" : "s"} · {formatCurrency(dayTotal, { signed: true })}</span></div>{needsReview ? <button disabled={busyDay === group.key} onClick={() => void reviewDay(group.key, group.transactions)}><CheckCheck size={15} /> {busyDay === group.key ? "Reviewing…" : `Review ${needsReview}`}</button> : <span className="day-reviewed"><BadgeCheck size={15} /> Reviewed</span>}</header><div className="card activity-day-card">{group.transactions.map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} hideDate onSelect={() => setSelected(transaction)} onReview={() => review(transaction)} onChooseCategory={() => setQuickCategory(transaction)} />)}</div></section>;
    })}</div>{nextCursor ? <button className="secondary-button activity-load-more" disabled={loadingPage} onClick={() => void fetchPage(true)}>{loadingPage ? "Loading…" : "Load more"}</button> : <p className="activity-end">End of activity</p>}</> : <div className="empty-state card"><h2>No activity found</h2><p>{selectedMonth ? "There are no transactions in this month." : "Try a different merchant, category, account, date, or filter."}</p></div>}
    {selected ? <TransactionDetail key={selected.id} transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={detailUpdated} /> : null}
    {quickCategory ? <CategoryPickerSheet categories={categories.filter((category) => quickCategory.amountCents > 0 ? category.behaviorType === "income" : category.behaviorType !== "income")} eyebrow={quickCategory.reviewStatus === "needs_review" ? "Categorize and review" : quickCategory.amountCents > 0 ? "Income category" : "Quick category"} label={`Choose category for ${quickCategory.merchant}`} onClose={() => setQuickCategory(null)} onSelect={(category) => void chooseCategory(quickCategory, category)} selectedId={quickCategory.categoryId} title={quickCategory.merchant} /> : null}
    {toast ? <div className="undo-toast" role="status"><span>{toast.message}</span>{toast.undo ? <button onClick={() => { const item = toast.undo; setToast(null); if (item) void undoReview(item); }}>Undo</button> : <button aria-label="Dismiss message" onClick={() => setToast(null)}><X /></button>}</div> : null}
  </>;
}
