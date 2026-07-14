"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionRow } from "@/components/transaction-row";

type Transaction = {
  id: string;
  merchant: string;
  categoryId: string;
  category: string;
  amountCents: number;
  date: string;
  status: "pending" | "posted";
  color: string;
};

export function ActivityList({ initialTransactions, categories }: { initialTransactions: Transaction[]; categories: Array<{ id: string; name: string; color: string }> }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "income">("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [always, setAlways] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(
    () => transactions.filter((transaction) => {
      const matchesQuery = `${transaction.merchant} ${transaction.category}`.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === "all" || (filter === "pending" ? transaction.status === "pending" : transaction.amountCents > 0);
      return matchesQuery && matchesFilter;
    }),
    [filter, query, transactions],
  );

  return (
    <>
      <div className="field" style={{ position: "relative" }}>
        <label htmlFor="activity-search" className="sr-only">Search activity</label>
        <Search size={19} style={{ position: "absolute", left: 16, top: 15, color: "var(--muted)" }} />
        <input id="activity-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchants or categories" style={{ paddingLeft: 46 }} />
      </div>
      <div className="chip-row" aria-label="Activity filters">
        {(["all", "pending", "income"] as const).map((item) => (
          <button key={item} className={`chip ${filter === item ? "chip-active" : ""}`} onClick={() => setFilter(item)}>
            {item.slice(0, 1).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <div className="card activity-card">
        {filtered.length ? filtered.map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} onSelect={() => { setSelected(transaction); setCategoryId(transaction.categoryId); setMessage(""); }} />) : (
          <div className="empty-state"><h2>No activity found</h2><p>Try a different merchant, category, or filter.</p></div>
        )}
      </div>
      {selected ? (
        <section className="form-card card" style={{ marginTop: 18 }} aria-label={`Edit ${selected.merchant}`}>
          <p className="eyebrow">Quick correction</p>
          <h2>{selected.merchant}</h2>
          <div className="field"><label htmlFor="edit-category">Category</label><select id="edit-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Unsorted</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="field"><label htmlFor="edit-note">Note</label><input id="edit-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional household note" /></div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}><input type="checkbox" checked={always} onChange={(event) => setAlways(event.target.checked)} /> Always categorize {selected.merchant} this way</label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}><input type="checkbox" checked={excluded} onChange={(event) => setExcluded(event.target.checked)} /> Exclude from budget</label>
          <div style={{ display: "flex", gap: 10 }}><button className="primary-button" onClick={async () => {
            const category = categories.find((item) => item.id === categoryId);
            if (category) setTransactions(transactions.map((item) => item.id === selected.id ? { ...item, categoryId, category: category.name, color: category.color } : item));
            const response = await fetch(`/api/transactions/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: categoryId || undefined, alwaysCategorize: always, excluded, note }) });
            const body = (await response.json()) as { message?: string };
            setMessage(response.status === 401 || response.status === 400 ? "Preview updated. Production sign-in is required to save." : body.message ?? "Updated.");
          }}>Save correction</button><button className="secondary-button" onClick={() => setSelected(null)}>Cancel</button></div>
          <p className="form-message" role="status">{message}</p>
        </section>
      ) : null}
    </>
  );
}
