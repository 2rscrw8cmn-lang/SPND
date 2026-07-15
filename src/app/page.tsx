import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HomeBudgetPulse } from "@/components/home-budget-pulse";
import { PageShell } from "@/components/page-shell";
import { SectionHeading } from "@/components/section-heading";
import { TransactionRow } from "@/components/transaction-row";
import { requireUser } from "@/lib/auth";
import { getActivityData, getBudgetWorkspace, getSafeBreakdown } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export default async function HomePage() {
  const user = await requireUser();
  const [budget, transactions, safe] = await Promise.all([getBudgetWorkspace(), getActivityData(5), getSafeBreakdown()]);
  const categories = budget.categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const remainingPercent = budget.totals.budgetedCents > 0 ? Math.max(0, Math.min(100, Math.round((budget.totals.remainingCents / budget.totals.budgetedCents) * 100))) : 0;
  const daysUntilIncome = Math.max(1, differenceInCalendarDays(parseISO(safe.nextIncomeDate), new Date()) + 1);
  const safeTodayCents = Math.floor(safe.safeCents / daysUntilIncome / 100) * 100;
  return (
    <PageShell>
      <h1 className="page-title">Good afternoon, {user.firstName}</h1>
      <p className="page-subtitle">Here’s what your money can do next.</p>

      <section className="hero card" aria-labelledby="safe-heading">
        <div className="hero-primary"><p className="eyebrow" id="safe-heading">Available to SPND</p><p className="safe-value">{formatCurrency(safe.safeCents, { compact: true })}</p><p className="safe-today"><strong>{formatCurrency(safeTodayCents, { compact: true })}</strong> safe today</p></div>
        <div className="hero-ring" style={{ "--remaining": `${remainingPercent}%` } as React.CSSProperties} aria-label={`${remainingPercent} percent of monthly budget remaining`}><div><strong>{remainingPercent}%</strong><span>budget left</span></div></div>
        <div className="hero-context"><div><CalendarDays size={16} /><span><strong>{daysUntilIncome} days</strong><small>until {format(parseISO(safe.nextIncomeDate), "MMM d")}</small></span></div><div><ShieldCheck size={16} /><span><strong>{safe.needsReview ? "Attention needed" : "On track"}</strong><small>{safe.needsReview ? "Review inputs" : "for this month"}</small></span></div></div>
        <div className="hero-bottom"><div className="confidence"><span className="confidence-dot" /> {safe.needsReview ? "Needs review" : "Inputs up to date"}</div><Link className="breakdown-button" href="/safe-to-spnd">See breakdown <ChevronRight size={18} /></Link></div>
      </section>

      <SectionHeading title="Budget pulse" href="/budget" />
      <HomeBudgetPulse categories={categories.slice(0, 5)} />

      <SectionHeading title="Recent activity" href="/activity" />
      <div className="activity-card card">
        {transactions.slice(0, 4).map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} />)}
      </div>
    </PageShell>
  );
}
