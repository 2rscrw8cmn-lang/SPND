import type { Metadata } from "next";
import { BudgetEditor } from "@/components/budget-editor";
import { PageShell } from "@/components/page-shell";
import { getBudgetData } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const categories = await getBudgetData();
  return (
    <PageShell>
      <h1 className="page-title">July budget</h1>
      <p className="page-subtitle">A clean monthly plan, shared by the Turco Household.</p>
      <BudgetEditor initialCategories={categories} />
    </PageShell>
  );
}
