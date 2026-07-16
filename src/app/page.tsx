import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, ReceiptText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HomeBudgetPulse } from "@/components/home-budget-pulse";
import { PageShell } from "@/components/page-shell";
import { SectionHeading } from "@/components/section-heading";
import { RecentActivity } from "@/components/recent-activity";
import { requireUser } from "@/lib/auth";
import { getActivityData, getBudgetWorkspace, getHouseholdSummary, getNextExpectedIncome, getReviewCount, getSafeBreakdown } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export default async function HomePage() {
  const user = await requireUser();
  const [budget, transactions, safe, household, nextIncome, reviewCount] = await Promise.all([getBudgetWorkspace(), getActivityData(5), getSafeBreakdown(), getHouseholdSummary(), getNextExpectedIncome(), getReviewCount()]);
  const categories = budget.categories.filter((category) => category.isActive && category.showInBudget && !category.isExcluded);
  const remainingPercent = budget.totals.budgetedCents > 0 ? Math.max(0, Math.min(100, Math.round((budget.totals.remainingCents / budget.totals.budgetedCents) * 100))) : 0;
  const daysUntilIncome = safe.nextIncomeDate ? Math.max(1, differenceInCalendarDays(parseISO(safe.nextIncomeDate), new Date()) + 1) : 1;
  const safeTodayCents = Math.floor(safe.safeCents / daysUntilIncome / 100) * 100;
  const householdHour = hourInTimezone(household.timezone);
  const greeting = householdHour < 12 ? "Good morning" : householdHour < 18 ? "Good afternoon" : "Good evening";
  return (
    <PageShell>
      <h1 className="page-title">{greeting}, {user.firstName}</h1>
      <p className="page-subtitle">Here’s what your money can do next.</p>

      <section className="hero card" aria-labelledby="safe-heading">
        <div className="hero-primary"><p className="eyebrow" id="safe-heading">Safe to SPND</p><p className={`safe-value${safe.needsReview ? " safe-value-state" : ""}`}>{safe.needsReview ? "Needs review" : formatCurrency(safe.safeCents, { compact: true })}</p><p className="safe-today">{safe.needsReview ? "Verify calculation inputs" : <><strong>{formatCurrency(safeTodayCents, { compact: true })}</strong> safe today</>}</p></div>
        <div className="hero-ring" style={{ "--remaining": `${remainingPercent}%` } as React.CSSProperties} aria-label={`${remainingPercent} percent of monthly budget remaining`}><div><strong>{remainingPercent}%</strong><span>budget left</span></div></div>
        <div className="hero-context"><div><CalendarDays size={16} /><span><strong>{safe.nextIncomeDate ? `${daysUntilIncome} days${nextIncome && nextIncome.date === safe.nextIncomeDate ? ` · ${formatCurrency(nextIncome.amountCents, { compact: true })}` : ""}` : "Not scheduled"}</strong><small>{safe.nextIncomeDate ? `next income ${format(parseISO(safe.nextIncomeDate), "MMM d")}` : "next expected income"}</small></span></div><div><ShieldCheck size={16} /><span><strong>{safe.needsReview ? "Attention needed" : "On track"}</strong><small>{safe.needsReview ? "Review inputs" : "for this month"}</small></span></div></div>
        <div className="hero-bottom"><div className="confidence"><span className="confidence-dot" /> {safe.needsReview ? "Needs review" : "Inputs up to date"}</div><Link className="breakdown-button" href="/safe-to-spnd">See breakdown <ChevronRight size={18} /></Link></div>
      </section>

      {reviewCount ? <Link className="home-review-row card" href="/activity"><span className="home-review-icon" aria-hidden="true"><ReceiptText size={18} /></span><strong>{reviewCount} transaction{reviewCount === 1 ? "" : "s"} to review</strong><ChevronRight className="row-chevron" size={19} /></Link> : null}

      <SectionHeading title="Budget pulse" href="/budget" />
      <HomeBudgetPulse categories={categories} />

      <SectionHeading title="Recent activity" href="/activity" />
      <RecentActivity initialTransactions={transactions} categories={budget.categories.filter((category) => category.isActive)} />
    </PageShell>
  );
}

function hourInTimezone(timezone: string) {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date())) % 24;
  } catch {
    return new Date().getHours();
  }
}
