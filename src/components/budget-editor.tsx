"use client";

import { useState } from "react";
import { BudgetRow } from "@/components/budget-row";
import { formatCurrency } from "@/lib/utils";

type Category = { id: string; name: string; color: string; icon: string; budgetedCents: number; spentCents: number };

export function BudgetEditor({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedId, setSelectedId] = useState(initialCategories[0]?.id ?? "");
  const [amount, setAmount] = useState((initialCategories[0]?.budgetedCents ?? 0) / 100);
  const [message, setMessage] = useState("");
  const budgeted = categories.reduce((sum, item) => sum + item.budgetedCents, 0);
  const spent = categories.reduce((sum, item) => sum + item.spentCents, 0);

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card card"><span>Budgeted</span><strong>{formatCurrency(budgeted, { compact: true })}</strong></div>
        <div className="summary-card card"><span>Posted spend</span><strong>{formatCurrency(spent, { compact: true })}</strong></div>
        <div className="summary-card card"><span>Remaining</span><strong>{formatCurrency(budgeted - spent, { compact: true })}</strong></div>
        <div className="summary-card card"><span>Pending</span><strong>{formatCurrency(7421)}</strong></div>
      </div>
      <div className="card budget-stack">
        {categories.map((category) => <BudgetRow category={category} key={category.id} />)}
      </div>
      <section className="form-card card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Adjust a monthly amount</h2>
        <p className="page-subtitle">Budgets reset cleanly on the first day of every month.</p>
        <div className="field">
          <label htmlFor="budget-category">Category</label>
          <select id="budget-category" value={selectedId} onChange={(event) => {
            setSelectedId(event.target.value);
            setAmount((categories.find((category) => category.id === event.target.value)?.budgetedCents ?? 0) / 100);
          }}>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="budget-amount">Monthly amount</label>
          <input id="budget-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        </div>
        <button className="primary-button" onClick={async () => {
          const budgetedCents = Math.round(amount * 100);
          setCategories(categories.map((category) => category.id === selectedId ? { ...category, budgetedCents } : category));
          const response = await fetch("/api/budgets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: selectedId, budgetedCents }) });
          const body = (await response.json()) as { message?: string };
          setMessage(response.status === 401 ? "Preview updated. Sign in with production mode to save." : body.message ?? "Saved.");
        }}>Save monthly budget</button>
        <p className="form-message" role="status">{message}</p>
      </section>
    </>
  );
}
