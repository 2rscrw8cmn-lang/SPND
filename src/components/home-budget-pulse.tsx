"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon } from "@/components/icons";
import type { BudgetCategory } from "@/lib/data";
import { sortBudgetCategories } from "@/lib/budget-sort";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import { formatCurrency } from "@/lib/utils";

export function HomeBudgetPulse({ categories }: { categories: BudgetCategory[] }) {
  const [selected, setSelected] = useState<BudgetCategory | null>(null);
  return <><div className="budget-stack card">{sortBudgetCategories(categories).slice(0, 5).map((category) => <BudgetRow category={category} compact key={category.id} onSelect={() => setSelected(category)} />)}</div>{selected ? <HomeCategorySheet category={selected} onClose={() => setSelected(null)} /> : null}</>;
}

function HomeCategorySheet({ category, onClose }: { category: BudgetCategory; onClose: () => void }) {
  const sheetRef = useRef<HTMLElement>(null);
  const remaining = category.budgetedCents - category.spentCents - category.pendingCents;
  const used = category.spentCents + category.pendingCents;
  const transactionGroups = groupTransactionsByDay(category.recentTransactions);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; sheetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" className="home-category-sheet" aria-label={`${category.name} category detail`}>
    <div className="sheet-handle" aria-hidden="true" /><div className="sheet-title"><div className="category-sheet-heading"><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} /></span><div><p className="eyebrow">Category detail</p><h2>{category.name}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close category detail"><X /></button></div>
    <strong className={remaining < 0 ? "category-detail-status negative" : "category-detail-status"}>{category.budgetedCents === 0 ? used > 0 ? `${formatCurrency(used)} unbudgeted` : "Not budgeted" : `${formatCurrency(Math.abs(remaining))} ${remaining < 0 ? "over" : "left"}`}</strong>
    <div className="category-detail-progress"><span style={{ width: `${Math.min(100, (category.spentCents + category.pendingCents) / Math.max(1, category.budgetedCents) * 100)}%`, background: remaining < 0 ? "var(--red)" : category.color }} /></div>
    <dl className="category-detail-metrics"><div><dt>Budget</dt><dd>{formatCurrency(category.budgetedCents)}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(category.spentCents)}</dd></div><div><dt>Pending</dt><dd>{formatCurrency(category.pendingCents)}</dd></div><div><dt>Remaining</dt><dd className={remaining < 0 ? "negative" : ""}>{formatCurrency(remaining)}</dd></div></dl>
    <section className="category-activity"><div className="section-line"><h3>Recent transactions</h3><Link href={`/activity?category=${category.id}`}>View all</Link></div>{transactionGroups.length ? transactionGroups.map((group) => <div className="category-day" key={group.key}><h4>{group.label}</h4>{group.transactions.map((transaction) => <Link href={`/activity?category=${category.id}`} key={transaction.id}><span><strong>{transaction.merchant}</strong><small>{transaction.status}{transaction.reviewStatus === "needs_review" ? " · needs review" : ""}</small></span><strong>{formatCurrency(transaction.amountCents, { signed: true })}</strong></Link>)}</div>) : <p className="compact-empty">No transactions in this month.</p>}</section>
    <Link className="secondary-button category-transactions" href="/budget">Manage category <ChevronRight size={18} /></Link>
  </section></div>;
}
