"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { CategoryActivity } from "@/components/category-activity";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon } from "@/components/icons";
import type { ActivityTransaction, BudgetCategory } from "@/lib/data";
import { sortBudgetCategories } from "@/lib/budget-sort";
import { formatCurrency } from "@/lib/utils";
import { TransactionDetail } from "@/components/transaction-detail";

export function HomeBudgetPulse({ categories }: { categories: BudgetCategory[] }) {
  const [selected, setSelected] = useState<BudgetCategory | null>(null);
  return <><div className="budget-stack card">{sortBudgetCategories(categories).slice(0, 5).map((category) => <BudgetRow category={category} compact key={category.id} onSelect={() => setSelected(category)} />)}</div>{selected ? <HomeCategorySheet categories={categories} category={selected} onClose={() => setSelected(null)} /> : null}</>;
}

function HomeCategorySheet({ categories, category, onClose }: { categories: BudgetCategory[]; category: BudgetCategory; onClose: () => void }) {
  const remaining = category.budgetedCents - category.spentCents - category.pendingCents;
  const used = category.spentCents + category.pendingCents;
  const [detail, setDetail] = useState<ActivityTransaction | null>(null);
  async function openTransaction(id: string) { const response = await fetch(`/api/activity?transaction=${id}`); const body = await response.json() as { transactions?: ActivityTransaction[] }; if (response.ok && body.transactions?.[0]) setDetail(body.transactions[0]); }
  return <><BottomSheet className="home-category-sheet" label={`${category.name} category detail`} onClose={onClose} handleLabel="Drag down to close category detail">
    <div className="sheet-title"><div className="category-sheet-heading"><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} /></span><div><p className="eyebrow">Category detail</p><h2>{category.name}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close category detail"><X /></button></div>
    <strong className={remaining < 0 ? "category-detail-status negative" : "category-detail-status"}>{category.budgetedCents === 0 ? used > 0 ? `${formatCurrency(used)} unbudgeted` : "Not budgeted" : `${formatCurrency(Math.abs(remaining))} ${remaining < 0 ? "over" : "left"}`}</strong>
    <div className="category-detail-progress"><span style={{ width: `${Math.min(100, (category.spentCents + category.pendingCents) / Math.max(1, category.budgetedCents) * 100)}%`, background: remaining < 0 ? "var(--red)" : category.color }} /></div>
    <dl className="category-detail-metrics"><div><dt>Budget</dt><dd>{formatCurrency(category.budgetedCents)}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(category.spentCents)}</dd></div><div><dt>Pending</dt><dd>{formatCurrency(category.pendingCents)}</dd></div><div><dt>Remaining</dt><dd className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining)}</dd></div></dl>
    <CategoryActivity category={category} onTransaction={(transaction) => void openTransaction(transaction.id)} />
    <Link className="secondary-button category-transactions" href="/budget">Manage category <ChevronRight size={18} /></Link>
  </BottomSheet>{detail ? <TransactionDetail transaction={detail} categories={categories} onClose={() => setDetail(null)} onUpdated={setDetail} /> : null}</>;
}
