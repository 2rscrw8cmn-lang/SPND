import type { Metadata } from "next";
import { BudgetWorkspace } from "@/components/budget-workspace";
import { PageShell } from "@/components/page-shell";
import { getBudgetWorkspace } from "@/lib/data";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const workspace = await getBudgetWorkspace(month);
  return (
    <PageShell>
      <BudgetWorkspace key={workspace.month} initialWorkspace={workspace} />
    </PageShell>
  );
}
