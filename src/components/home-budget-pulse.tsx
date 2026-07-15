"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BudgetRow } from "@/components/budget-row";
import { CategoryIcon } from "@/components/icons";
import type { BudgetCategory } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export function HomeBudgetPulse({ categories }: { categories: BudgetCategory[] }) {
  const [selected, setSelected] = useState<BudgetCategory | null>(null);
  return <><div className="budget-stack card">{categories.map((category) => <BudgetRow category={category} compact key={category.id} onSelect={() => setSelected(category)} />)}</div>{selected ? <HomeCategorySheet category={selected} onClose={() => setSelected(null)} /> : null}</>;
}

function HomeCategorySheet({ category, onClose }: { category: BudgetCategory; onClose: () => void }) {
  const sheetRef = useRef<HTMLElement>(null);
  const remaining = category.budgetedCents - category.spentCents;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; sheetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" className="home-category-sheet" aria-label={`${category.name} category detail`}>
    <div className="sheet-handle" aria-hidden="true" /><div className="sheet-title"><div className="category-sheet-heading"><span className="category-disc" style={{ "--category": category.color } as React.CSSProperties}><CategoryIcon name={category.icon} /></span><div><p className="eyebrow">Category detail</p><h2>{category.name}</h2></div></div><button className="icon-button" onClick={onClose} aria-label="Close category detail"><X /></button></div>
    <strong className={remaining < 0 ? "category-detail-status negative" : "category-detail-status"}>{category.budgetedCents === 0 ? "Not budgeted" : `${formatCurrency(Math.abs(remaining))} ${remaining < 0 ? "over" : "left"}`}</strong>
    <dl className="category-detail-metrics"><div><dt>Budget</dt><dd>{formatCurrency(category.budgetedCents)}</dd></div><div><dt>Spent</dt><dd>{formatCurrency(category.spentCents)}</dd></div><div><dt>Pending</dt><dd>{formatCurrency(category.pendingCents)}</dd></div></dl>
    <Link className="secondary-button category-transactions" href={`/activity?category=${category.id}`}>View category transactions <ChevronRight size={18} /></Link>
  </section></div>;
}
