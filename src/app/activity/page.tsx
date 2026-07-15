import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { PageShell } from "@/components/page-shell";
import { getAccountsData, getActivityData, getBudgetWorkspace } from "@/lib/data";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [transactions, workspace, accounts] = await Promise.all([getActivityData(), getBudgetWorkspace(), getAccountsData()]);
  return (
    <PageShell>
      <h1 className="page-title">Activity</h1>
      <p className="page-subtitle">Review, categorize, and keep the household current.</p>
      <ActivityList initialTransactions={transactions} categories={workspace.categories.filter((item) => item.isActive)} accounts={accounts} initialCategoryId={category} />
    </PageShell>
  );
}
