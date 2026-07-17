"use client";

import { format, parseISO } from "date-fns";
import { BadgeCheck, CheckCheck, CopyCheck, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CategoryPickerSheet } from "@/components/category-picker";
import { TransactionDetail } from "@/components/transaction-detail";
import { TransactionGroup } from "@/components/transaction-group";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { findPotentialDuplicates, type DuplicateGroup } from "@/lib/transaction-duplicates";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

type Account = { id: string; name: string };
type Filter = "all" | "pending" | "income" | "expenses" | "excluded" | "transfers";
type ActivityMode = "review" | "all";
type Toast = { message: string; undo?: ActivityTransaction; undoFullEdit?: boolean };

type ActivityListProps = {
  initialTransactions: ActivityTransaction[];
  categories: BudgetCategory[];
  accounts: Account[];
  initialCategoryId?: string;
  initialReviewCount?: number;
  selectedMonth?: string;
};

export function ActivityList({ initialTransactions, categories, accounts, initialCategoryId, initialReviewCount, selectedMonth }: ActivityListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [mode, setMode] = useState<ActivityMode>(initialCategoryId ? "all" : initialTransactions.some((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded && !transaction.isTransfer) ? "review" : "all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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
    const matchesMode = mode === "all" || (transaction.reviewStatus === "needs_review" && !transaction.excluded && !transaction.isTransfer);
    const matchesQuery = `${transaction.merchant} ${transaction.category} ${transaction.rawDescription}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "pending" && transaction.status === "pending")
      || (filter === "income" && transaction.amountCents > 0)
      || (filter === "expenses" && transaction.amountCents < 0)
      || (filter === "excluded" && transaction.excluded)
      || (filter === "transfers" && transaction.isTransfer);
    const matchesCategory = !categoryFilter || (categoryFilter === "unsorted" ? !transaction.categoryId : transaction.categoryId === categoryFilter);
    const matchesAccount = !accountFilter || transaction.accountId === accountFilter;
    const matchesDate = !dateFilter || transaction.isoDate.slice(0, 10) === dateFilter;
    return matchesMode && matchesQuery && matchesFilter && matchesCategory && matchesAccount && matchesDate;
  }, [accountFilter, categoryFilter, dateFilter, filter, mode, query]);

  const filtered = useMemo(() => transactions.filter(matches), [matches, transactions]);
  const recentCategoryIds = useMemo(() => [...new Set(transactions.filter((transaction) => transaction.categoryId && transaction.reviewStatus === "reviewed").map((transaction) => transaction.categoryId))].slice(0, 4), [transactions]);
  const groups = useMemo(() => groupTransactionsByDay(filtered), [filtered]);
  const duplicateGroups = useMemo(() => findPotentialDuplicates(transactions), [transactions]);
  const [reviewTotal, setReviewTotal] = useState(() => Math.max(initialReviewCount ?? 0, initialTransactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded && !transaction.isTransfer).length));
  const adjustReviewTotal = useCallback((delta: number) => setReviewTotal((total) => Math.max(0, total + delta)), []);

  const fetchPage = useCallback(async (append: boolean) => {
    setLoadingPage(true); const params = new URLSearchParams();
    if (query.trim() && mode === "all") params.set("q", query.trim()); if (mode === "review") params.set("filter", "needs_review"); else if (filter !== "all") params.set("filter", filter); if (categoryFilter && categoryFilter !== "unsorted") params.set("category", categoryFilter); if (accountFilter) params.set("account", accountFilter); if (dateFilter) params.set("date", dateFilter); if (selectedMonth) params.set("month", selectedMonth); if (append && nextCursor) params.set("before", nextCursor);
    const response = await fetch(`/api/activity?${params}`); const body = await response.json() as { transactions?: ActivityTransaction[]; nextCursor?: string | null };
    if (response.ok && body.transactions) { setTransactions((items) => append ? [...items, ...body.transactions!.filter((item) => !items.some((existing) => existing.id === item.id))] : body.transactions!); setNextCursor(body.nextCursor ?? null); }
    setLoadingPage(false);
  }, [accountFilter, categoryFilter, dateFilter, filter, mode, nextCursor, query, selectedMonth]);

  useEffect(() => {
    if (firstQuery.current) { firstQuery.current = false; return; }
    const timer = window.setTimeout(() => { void fetchPage(false); }, 300); return () => window.clearTimeout(timer);
  }, [accountFilter, categoryFilter, dateFilter, filter, mode, query, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistReview(transaction: ActivityTransaction, reviewed: boolean) {
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed, expectedUpdatedAt: transaction.updatedAt }) });
    const body = await response.json() as { transaction?: { updated_at?: string } };
    if (!response.ok) {
      setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item));
      setToast({ message: "Review could not be saved. The transaction was restored." });
      return false;
    }
    if (body.transaction?.updated_at) setTransactions((items) => items.map((item) => item.id === transaction.id ? { ...item, updatedAt: body.transaction!.updated_at! } : item));
    adjustReviewTotal(reviewed ? -1 : 1);
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
    const candidates = dayTransactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded);
    const toReview = candidates.filter((transaction) => transaction.categoryId && transaction.allocations.length <= 1 && !transaction.isTransfer);
    const skipped = candidates.length - toReview.length;
    if (!toReview.length) return;
    setBusyDay(key);
    const now = new Date().toISOString();
    setTransactions((items) => items.map((item) => toReview.some((candidate) => candidate.id === item.id) ? { ...item, reviewStatus: "reviewed", reviewedAt: now } : item));
    const results = await Promise.all(toReview.map((transaction) => persistReview(transaction, true)));
    setBusyDay(null);
    if (results.every(Boolean)) setToast({ message: `${toReview.length} transaction${toReview.length === 1 ? "" : "s"} reviewed for the day.${skipped ? ` ${skipped} unresolved item${skipped === 1 ? " was" : "s were"} skipped.` : ""}` });
  }

  async function undoReview(transaction: ActivityTransaction) {
    setTransactions((items) => items.map((item) => item.id === transaction.id ? transaction : item));
    setToast({ message: `${transaction.merchant} returned to Needs review.` });
    const ok = await persistReview({ ...transaction, reviewStatus: "reviewed", reviewedAt: new Date().toISOString() }, false);
    if (!ok) setToast({ message: "Undo could not be saved." });
  }

  async function undoDetailEdit(transaction: ActivityTransaction) {
    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ undo: true }),
    });
    const body = await response.json() as {
      message?: string;
      updatedAt?: string;
      restored?: {
        displayName: string | null;
        note: string | null;
        excluded: boolean;
        isTransfer: boolean;
        isRecurring: boolean;
        reviewStatus: "reviewed" | "needs_review";
        reviewedAt: string | null;
        allocations: Array<{ categoryId: string; amountCents: number }>;
      };
    };
    if (!response.ok || !body.restored) {
      setToast({ message: body.message ?? "Undo could not be saved." });
      return;
    }
    const restored = body.restored;
    const firstCategory = categories.find((item) => item.id === restored.allocations[0]?.categoryId);
    const updated: ActivityTransaction = {
      ...transaction,
      updatedAt: body.updatedAt ?? transaction.updatedAt,
      merchant: restored.displayName || transaction.importedMerchant,
      note: restored.note ?? "",
      excluded: restored.excluded,
      isTransfer: restored.isTransfer,
      isRecurring: restored.isRecurring,
      reviewStatus: restored.reviewStatus,
      reviewedAt: restored.reviewedAt,
      categoryId: restored.allocations.length === 1 ? restored.allocations[0]!.categoryId : (restored.allocations[0]?.categoryId ?? ""),
      category: restored.allocations.length > 1 ? "Split" : (firstCategory?.name ?? "Unsorted"),
      color: restored.allocations.length > 1 ? "#A6ACB8" : (firstCategory?.color ?? "#A6ACB8"),
      allocations: restored.allocations.map((item) => ({
        ...item,
        category: categories.find((category) => category.id === item.categoryId)?.name ?? "Unsorted",
      })),
    };
    setTransactions((items) => items.map((item) => item.id === updated.id ? updated : item));
    if (transaction.reviewStatus !== updated.reviewStatus) adjustReviewTotal(updated.reviewStatus === "reviewed" ? -1 : 1);
    setToast({ message: body.message ?? `${transaction.merchant} restored.` });
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
    const updated = { ...transaction, categoryId: category?.id ?? "", category: category?.name ?? "Unsorted", color: category?.color ?? "#A6ACB8", reviewStatus: "reviewed" as const, reviewedAt: new Date().toISOString(), allocationSource: "manual" as const, allocations: category ? [{ categoryId: category.id, category: category.name, amountCents: transaction.amountCents }] : [] };
    setTransactions((items) => items.map((item) => item.id === transaction.id ? updated : item));
    setQuickCategory(null);
    setToast({ message: `${transaction.merchant} moved to ${updated.category}.` });
    const categorizeAndReview = transaction.reviewStatus === "needs_review";
    const response = await fetch(`/api/transactions/${transaction.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: category?.id ?? null, reviewed: categorizeAndReview, expectedUpdatedAt: transaction.updatedAt }) });
    const body = await response.json() as { transaction?: { updated_at?: string } };
    if (!response.ok) {
      setTransactions((items) => items.map((item) => item.id === transaction.id ? original : item));
      setToast({ message: "Category could not be saved. The previous category was restored." });
    } else {
      if (categorizeAndReview) adjustReviewTotal(-1);
      if (body.transaction?.updated_at) setTransactions((items) => items.map((item) => item.id === transaction.id ? { ...item, updatedAt: body.transaction!.updated_at! } : item));
    }
  }

  function detailUpdated(updated: ActivityTransaction) {
    const normalized = updated.excluded ? { ...updated, reviewStatus: "reviewed" as const, reviewedAt: updated.reviewedAt ?? new Date().toISOString() } : updated;
    const previous = transactions.find((item) => item.id === updated.id);
    if (previous && previous.reviewStatus !== normalized.reviewStatus) adjustReviewTotal(normalized.reviewStatus === "reviewed" ? -1 : 1);
    const currentIndex = filtered.findIndex((item) => item.id === updated.id);
    const shouldAdvance = mode === "review" && normalized.reviewStatus === "reviewed";
    setTransactions((items) => items.map((item) => item.id === normalized.id ? normalized : item));
    if (previous && previous.reviewStatus === "needs_review" && normalized.reviewStatus === "reviewed") {
      setToast({ message: `${normalized.merchant} reviewed.`, undo: normalized, undoFullEdit: true });
    }
    if (shouldAdvance) {
      const remaining = filtered.filter((item) => item.id !== normalized.id);
      setSelected(remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null);
    } else setSelected(normalized);
  }

  return <>
    {selectedMonth ? <div className="activity-month-context"><span>Showing {format(parseISO(`${selectedMonth.slice(0, 7)}-01`), "MMMM yyyy")}</span><Link href="/activity">All activity</Link></div> : null}
    <div className="mode-switcher activity-mode-switcher" role="group" aria-label="Activity mode"><button aria-pressed={mode === "review"} onClick={() => setMode("review")}>Review {reviewTotal > 99 ? "99+" : reviewTotal}</button><button aria-pressed={mode === "all"} onClick={() => setMode("all")}>All activity</button></div>
    {mode === "review" ? <p className="review-mode-help">Confirm categories and transaction details.</p> : <><div className="activity-search field"><label htmlFor="activity-search" className="sr-only">Search activity</label><Search size={19} /><input id="activity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchants or descriptions" /></div>
    <div className="chip-row" aria-label="Activity filters">{(["all", "pending", "expenses", "income", "excluded", "transfers"] as const).map((item) => <button key={item} className={`chip ${filter === item ? "chip-active" : ""}`} onClick={() => setFilter(item)}>{item.slice(0, 1).toUpperCase() + item.slice(1)}</button>)}</div></>}
    {mode === "all" ?
    <details className="filter-panel"><summary><SlidersHorizontal size={15} /> More filters{advancedFilterCount ? <span className="filter-count">{advancedFilterCount}</span> : null}</summary><div className="filter-grid"><div className="field"><label htmlFor="filter-category">Category</label><select id="filter-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option><option value="unsorted">Unsorted</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.categoryGroup === "Income" ? `Income · ${category.name}` : category.name}</option>)}</select></div><div className="field"><label htmlFor="filter-account">Account</label><select id="filter-account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="filter-date">Date</label><input id="filter-date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>{advancedFilterCount ? <button className="filter-reset" type="button" onClick={() => { setCategoryFilter(""); setAccountFilter(""); setDateFilter(""); }}><RotateCcw size={14} /> Clear filters</button> : null}</div></details>
    : null}<div className="activity-summary" aria-live="polite"><strong>{filtered.length}</strong> transaction{filtered.length === 1 ? "" : "s"}{mode === "review" ? " to review" : " shown"}</div>

    {duplicateGroups.length ? <details className="duplicate-review card"><summary><span><CopyCheck size={18} /><span><strong>{duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? "" : " groups"}</strong><small>Same merchant, amount, and account within three days</small></span></span><span>Review</span></summary><div className="duplicate-review-list">{duplicateGroups.map((group) => <article key={group.key}><div><strong>{group.canonical.merchant}</strong><span>{formatCurrency(group.canonical.amountCents, { signed: true })} · {group.duplicates.length + 1} matching transactions</span></div><button className="secondary-button" disabled={busyDuplicate === group.key} onClick={() => void mergeDuplicates(group)}><CopyCheck size={16} /> {busyDuplicate === group.key ? "Merging…" : `Keep one, merge ${group.duplicates.length}`}</button></article>)}</div></details> : null}

    {groups.length ? <><div className="activity-groups">{groups.map((group) => {
      const needsReview = group.transactions.filter((transaction) => transaction.reviewStatus === "needs_review" && !transaction.excluded).length;
      return <TransactionGroup action={needsReview ? <button disabled={busyDay === group.key} onClick={() => void reviewDay(group.key, group.transactions)}><CheckCheck size={15} /> {busyDay === group.key ? "Reviewing…" : `Review ${needsReview}`}</button> : <span className="day-reviewed"><BadgeCheck size={15} /> Reviewed</span>} headingId={`day-${group.key}`} key={group.key} label={group.label} transactions={group.transactions}>{(transaction) => <TransactionRow transaction={transaction} key={transaction.id} hideDate onSelect={() => setSelected(transaction)} onReview={() => review(transaction)} onChooseCategory={() => setQuickCategory(transaction)} />}</TransactionGroup>;
    })}</div>{nextCursor ? <button className="secondary-button activity-load-more" disabled={loadingPage} onClick={() => void fetchPage(true)}>{loadingPage ? "Loading…" : "Load more"}</button> : <p className="activity-end">End of activity</p>}</> : mode === "review" ? <div className="empty-state card review-caught-up"><BadgeCheck /><h2>All caught up</h2><p>Every reviewable transaction is complete.</p><button className="secondary-button" onClick={() => setMode("all")}>View all activity</button></div> : <div className="empty-state card"><h2>No activity found</h2><p>{selectedMonth ? "There are no transactions in this month." : "Try a different merchant, category, account, date, or filter."}</p></div>}
    {selected ? <TransactionDetail key={selected.id} transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={detailUpdated} /> : null}
    {quickCategory ? <CategoryPickerSheet categories={categories.filter((category) => quickCategory.amountCents > 0 ? category.behaviorType === "income" : category.behaviorType !== "income")} eyebrow={quickCategory.reviewStatus === "needs_review" ? "Categorize and review" : quickCategory.amountCents > 0 ? "Income category" : "Quick category"} label={`Choose category for ${quickCategory.merchant}`} onClose={() => setQuickCategory(null)} onSelect={(category) => void chooseCategory(quickCategory, category)} recentIds={quickCategory.amountCents > 0 ? [] : recentCategoryIds} selectedId={quickCategory.categoryId} title={quickCategory.merchant} /> : null}
    {toast ? <div className="undo-toast" role="status"><span>{toast.message}</span>{toast.undo ? <button onClick={() => { const item = toast.undo; const undoFullEdit = toast.undoFullEdit; setToast(null); if (item) void (undoFullEdit ? undoDetailEdit(item) : undoReview(item)); }}>Undo</button> : <button aria-label="Dismiss message" onClick={() => setToast(null)}><X /></button>}</div> : null}
  </>;
}
