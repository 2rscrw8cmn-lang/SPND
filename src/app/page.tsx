import { format, parseISO } from "date-fns";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BudgetRow } from "@/components/budget-row";
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
  return (
    <PageShell>
      <h1 className="page-title">Good afternoon, {user.firstName}</h1>
      <p className="page-subtitle">Here’s what your money can do next.</p>

      <section className="hero card" aria-labelledby="safe-heading">
        <p className="eyebrow" id="safe-heading">Safe to SPND</p>
        <p className="safe-value">{formatCurrency(safe.safeCents, { compact: true })}</p>
        <p className="safe-until">until {format(parseISO(safe.nextIncomeDate), "MMM d")}</p>
        <div className="hero-bottom">
          <div className="confidence"><span className="confidence-dot" /> {safe.needsReview ? "Needs review" : "Inputs are up to date"}</div>
          <Link className="breakdown-button" href="/safe-to-spnd">See breakdown <ChevronRight size={18} /></Link>
        </div>
        <div className="hero-ring" style={{ "--remaining": `${remainingPercent}%` } as React.CSSProperties} aria-label={`${remainingPercent} percent of monthly budget remaining`}><strong>{remainingPercent}%</strong><span>of budget remaining</span></div>
      </section>

      <SectionHeading title="Budget pulse" href="/budget" />
      <div className="budget-stack card">
        {categories.slice(0, 4).map((category) => <BudgetRow category={category} compact key={category.id} />)}
      </div>

      <Link href="/budget" className="insight card">
        <span className="insight-icon"><Check size={25} strokeWidth={3} /></span>
        <p>You’re on track this week.</p>
        <ChevronRight className="row-chevron" size={22} />
      </Link>

      <SectionHeading title="Recent activity" href="/activity" />
      <div className="activity-card card">
        {transactions.slice(0, 4).map((transaction) => <TransactionRow transaction={transaction} key={transaction.id} />)}
      </div>
    </PageShell>
  );
}
