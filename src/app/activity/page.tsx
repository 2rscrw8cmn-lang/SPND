import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { PageShell } from "@/components/page-shell";
import { getAccountsData, getActivityData, getBudgetWorkspace, getReviewCount } from "@/lib/data";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ category?: string; month?: string }> }) {
  const { category, month } = await searchParams;
  const [transactions, reviewTransactions, reviewCount, workspace, accounts] = await Promise.all([getActivityData(50, month), getActivityData(50, month, { filter: "needs_review" }), getReviewCount(), getBudgetWorkspace(month), getAccountsData()]);
  const merged = [...reviewTransactions.filter((transaction) => !transaction.isTransfer), ...transactions.filter((transaction) => !reviewTransactions.some((item) => item.id === transaction.id))].sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  return (
    <PageShell>
      <h1 className="page-title">Activity</h1>
      <p className="page-subtitle">Review, categorize, and keep the household current.</p>
      <ActivityList initialTransactions={merged} categories={workspace.categories.filter((item) => item.isActive)} accounts={accounts} initialCategoryId={category} initialReviewCount={reviewCount} selectedMonth={month ? workspace.month.slice(0, 7) : undefined} />
    </PageShell>
  );
}
