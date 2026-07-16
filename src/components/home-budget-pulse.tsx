"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CategoryDetail } from "@/components/category-detail";
import { BudgetRow } from "@/components/budget-row";
import type { BudgetCategory } from "@/lib/data";
import { sortBudgetCategories } from "@/lib/budget-sort";

export function HomeBudgetPulse({ categories }: { categories: BudgetCategory[] }) {
  const [selected, setSelected] = useState<BudgetCategory | null>(null);
  return <><div className="budget-stack card">{sortBudgetCategories(categories).slice(0, 5).map((category) => <BudgetRow category={category} compact key={category.id} onSelect={() => setSelected(category)} />)}</div>{selected ? <HomeCategorySheet categories={categories} category={selected} onClose={() => setSelected(null)} /> : null}</>;
}

function HomeCategorySheet({ categories, category, onClose }: { categories: BudgetCategory[]; category: BudgetCategory; onClose: () => void }) {
  return <CategoryDetail actions={<Link className="secondary-button category-transactions" href="/budget">Manage category <ChevronRight size={18} /></Link>} allCategories={categories} category={category} onClose={onClose} />;
}
