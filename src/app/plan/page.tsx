import { format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, FileUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PlanEditor } from "@/components/plan-editor";
import { RecurringCandidates } from "@/components/recurring-candidates";
import { PlanList } from "@/components/plan-list";
import { getActivityData, getPlanData, getRecurringCandidates } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { importsEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Cash-flow plan" };

export default async function PlanPage() {
  const [plan, candidates, transactions] = await Promise.all([getPlanData(), getRecurringCandidates(), getActivityData(50)]);
  const activePlan = plan.filter((item) => item.state !== "inactive");
  const nextIncome = activePlan.find((item) => item.type === "income");
  const dueBeforeIncome = nextIncome ? activePlan.filter((item) => item.type === "expense" && item.date <= nextIncome.date).reduce((sum, item) => sum + Math.abs(item.amountCents), 0) : 0;
  const upcomingIncome = activePlan.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amountCents, 0);
  const upcomingExpenses = activePlan.filter((item) => item.type === "expense").reduce((sum, item) => sum + Math.abs(item.amountCents), 0);

  return <PageShell>
    <h1 className="page-title">Cash-flow plan</h1>
    <p className="page-subtitle">Tell SPND what is coming before it hits your accounts. This is what makes Safe to SPND useful.</p>
    {importsEnabled() ? <Link className="plan-import-link card" href="/settings/imports"><FileUp size={20} /><span><strong>Experimental import inbox</strong><small>Controlled testing only</small></span></Link> : null}
    <div className="plan-summary-grid">
      <Link className="summary-card card plan-income-link" href="/income"><span><CalendarClock size={16} /> Next income</span><strong>{nextIncome ? format(parseISO(nextIncome.date), "MMM d") : "Not planned"}</strong><small>{nextIncome ? `${formatCurrency(dueBeforeIncome)} due first` : "Add a paycheck or deposit"}</small></Link>
      <div className="summary-card card"><span><ArrowDownLeft size={16} /> Coming in</span><strong className="plan-income">{formatCurrency(upcomingIncome, { compact: true })}</strong><small>all upcoming income</small></div>
      <div className="summary-card card"><span><ArrowUpRight size={16} /> Going out</span><strong>{formatCurrency(upcomingExpenses, { compact: true })}</strong><small>all upcoming obligations</small></div>
    </div>
    <div className="section-heading"><div><h2>Upcoming cash flow</h2><p>Recurring items and one-time plans, ordered by date.</p></div></div>
    <PlanList initialItems={plan} transactions={transactions} />
    <PlanEditor />
    <RecurringCandidates initialCandidates={candidates} />
  </PageShell>;
}
