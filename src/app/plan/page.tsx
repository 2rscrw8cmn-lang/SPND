import { addMonths, format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncomeView } from "@/components/income-view";
import { PageShell } from "@/components/page-shell";
import { PlanEditor } from "@/components/plan-editor";
import { PlanList } from "@/components/plan-list";
import { RecurringCandidates } from "@/components/recurring-candidates";
import { getBudgetWorkspace, getExpectedIncomeSources, getIncomeView, getPlanData, getRecurringCandidates, getSafeBreakdown } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const [income, sources, plan, candidates, safe, workspace] = await Promise.all([
    getIncomeView(month),
    getExpectedIncomeSources(),
    getPlanData(month),
    getRecurringCandidates(),
    getSafeBreakdown(),
    getBudgetWorkspace(month),
  ]);
  const monthDate = parseISO(workspace.month);
  const expenses = plan.filter((item) => item.type === "expense" && item.state !== "inactive");
  const today = format(new Date(), "yyyy-MM-dd");
  const nextIncome = income.openExpectations.find((item) => item.date >= today) ?? income.upcoming.find((item) => item.date >= today) ?? income.upcoming[0];
  const dueBeforeIncome = expenses.filter((item) => !nextIncome || item.date <= nextIncome.date).reduce((sum, item) => sum + Math.abs(item.amountCents), 0);
  const projectedRemainder = income.expectedCents - expenses.reduce((sum, item) => sum + Math.abs(item.amountCents), 0);

  return <PageShell>
    <header className="cash-flow-heading"><div><h1 className="page-title">Plan</h1><p className="page-subtitle">Know what is coming and what is safe before the next deposit.</p></div>{!sources.some((source) => source.active) ? <a className="primary-button plan-income-cta" href="#income-setup">Plan your income</a> : null}</header>
    <nav className="month-rail" aria-label="Plan month">{[-1, 0, 1].map((offset) => { const date = addMonths(monthDate, offset); return <Link aria-current={offset === 0 ? "date" : undefined} className={offset === 0 ? "selected" : ""} href={`/plan?month=${format(date, "yyyy-MM")}`} key={offset}>{offset < 0 ? <ChevronLeft size={16} /> : null}{format(date, offset === 0 ? "MMM yyyy" : "MMM")}{offset > 0 ? <ChevronRight size={16} /> : null}</Link>; })}</nav>
    <section className="cash-flow-hero" aria-label="Cash-flow summary">
      <div className="cash-flow-hero-main"><span><ShieldCheck size={16} /> Safe to SPND</span><strong>{formatCurrency(safe.safeCents)}</strong><small>{safe.nextIncomeDate ? `until ${format(parseISO(safe.nextIncomeDate), "MMM d")}` : "Add expected income to complete the forecast"}</small></div>
      <dl><div><dt><CalendarClock size={14} /> Next income</dt><dd>{nextIncome ? format(parseISO(nextIncome.date), "MMM d") : "Not planned"}</dd></div><div><dt><ArrowUpRight size={14} /> Due first</dt><dd>{formatCurrency(dueBeforeIncome, { compact: true })}</dd></div><div><dt><ArrowDownLeft size={14} /> Projected</dt><dd className={projectedRemainder < 0 ? "negative" : "positive"}>{formatCurrency(projectedRemainder, { compact: true, signed: projectedRemainder < 0 })}</dd></div></dl>
    </section>
    <section id="income" className="cash-flow-section"><div className="section-heading"><div><h2>Income</h2><p>Expected deposits and the transactions that fulfill them.</p></div></div><IncomeView categories={workspace.categories} data={income} embedded sources={sources} /></section>
    <section className="cash-flow-section"><div className="section-heading"><div><h2>Upcoming obligations</h2><p>Recurring bills and one-time expenses ordered by date.</p></div></div><PlanList initialItems={expenses} /><PlanEditor /></section>
    <RecurringCandidates initialCandidates={candidates.filter((item) => item.type === "expense")} />
  </PageShell>;
}
