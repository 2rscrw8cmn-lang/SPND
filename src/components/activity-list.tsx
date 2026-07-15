"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionDetail } from "@/components/transaction-detail";
import { TransactionRow } from "@/components/transaction-row";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";

type Account = { id: string; name: string };
type Filter = "all" | "needs_review" | "pending" | "income" | "expenses" | "excluded" | "transfers";

export function ActivityList({ initialTransactions, categories, accounts, initialCategoryId }: { initialTransactions: ActivityTransaction[]; categories: BudgetCategory[]; accounts: Account[]; initialCategoryId?: string }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialCategoryId === "unsorted" ? "needs_review" : "all");
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId ?? "");
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<ActivityTransaction | null>(null);
  const filtered = useMemo(() => transactions.filter((transaction) => {
    const matchesQuery = `${transaction.merchant} ${transaction.category} ${transaction.rawDescription}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "needs_review" && transaction.reviewStatus === "needs_review") || (filter === "pending" && transaction.status === "pending") || (filter === "income" && transaction.amountCents > 0) || (filter === "expenses" && transaction.amountCents < 0) || (filter === "excluded" && transaction.excluded) || (filter === "transfers" && transaction.isTransfer);
    const matchesCategory = !categoryFilter || (categoryFilter === "unsorted" ? !transaction.categoryId : transaction.categoryId === categoryFilter);
    const matchesAccount = !accountFilter || transaction.accountId === accountFilter;
    const matchesDate = !dateFilter || transaction.isoDate.slice(0, 10) === dateFilter;
    return matchesQuery && matchesFilter && matchesCategory && matchesAccount && matchesDate;
  }), [accountFilter, categoryFilter, dateFilter, filter, query, transactions]);

  return <>
    <div className="activity-search field"><label htmlFor="activity-search" className="sr-only">Search activity</label><Search size={19} /><input id="activity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchants or descriptions" /></div>
    <div className="chip-row" aria-label="Activity filters">{(["all", "needs_review", "pending", "expenses", "income", "excluded", "transfers"] as const).map((item) => <button key={item} className={`chip ${filter === item ? "chip-active" : ""}`} onClick={() => setFilter(item)}>{item === "needs_review" ? "Needs review" : item.slice(0, 1).toUpperCase() + item.slice(1)}</button>)}</div>
    <details className="filter-panel"><summary>More filters</summary><div className="filter-grid"><div className="field"><label htmlFor="filter-category">Category</label><select id="filter-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option><option value="unsorted">Unsorted</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="field"><label htmlFor="filter-account">Account</label><select id="filter-account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="filter-date">Date</label><input id="filter-date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></div></details>
    <div className="activity-summary"><strong>{filtered.length}</strong> transactions{filter === "needs_review" ? " need review" : ""}</div>
    <div className="card activity-card">{filtered.length ? filtered.map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} onSelect={() => setSelected(transaction)} />) : <div className="empty-state"><h2>No activity found</h2><p>Try a different merchant, category, account, date, or filter.</p></div>}</div>
    {selected ? <TransactionDetail transaction={selected} categories={categories} onClose={() => setSelected(null)} onUpdated={(updated) => { setTransactions((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelected(updated); }} /> : null}
  </>;
}
