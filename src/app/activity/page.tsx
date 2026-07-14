import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { PageShell } from "@/components/page-shell";
import { getActivityData } from "@/lib/data";
import { getBudgetData } from "@/lib/data";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const [transactions, categories] = await Promise.all([getActivityData(), getBudgetData()]);
  return (
    <PageShell>
      <h1 className="page-title">Activity</h1>
      <p className="page-subtitle">Review what’s new and correct a category in a couple of taps.</p>
      <ActivityList initialTransactions={transactions} categories={categories} />
    </PageShell>
  );
}
