import { format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, FileUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PlanEditor } from "@/components/plan-editor";
import { RecurringCandidates } from "@/components/recurring-candidates";
import { getPlanData, getRecurringCandidates } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Cash-flow plan" };

export default async function PlanPage() {
  const [plan, candidates] = await Promise.all([getPlanData(), getRecurringCandidates()]);
  const nextIncome = plan.find((item) => item.type === "income");
  const dueBeforeIncome = nextIncome ? plan.filter((item) => item.type === "expense" && item.date <= nextIncome.date).reduce((sum, item) => sum + Math.abs(item.amountCents), 0) : 0;
  const upcomingIncome = plan.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amountCents, 0);
  const upcomingExpenses = plan.filter((item) => item.type === "expense").reduce((sum, item) => sum + Math.abs(item.amountCents), 0);

  return <PageShell>
    <h1 className="page-title">Cash-flow plan</h1>
    <p className="page-subtitle">Tell SPND what is coming before it hits your accounts. This is what makes Safe to SPND useful.</p>
    <Link className="plan-import-link card" href="/settings/imports"><FileUp size={20} /><span><strong>Import planned items</strong><small>Review a statement or budget file before applying it</small></span></Link>
    <div className="plan-summary-grid">
      <div className="summary-card card"><span><CalendarClock size={16} /> Next income</span><strong>{nextIncome ? format(parseISO(nextIncome.date), "MMM d") : "Not planned"}</strong><small>{nextIncome ? `${formatCurrency(dueBeforeIncome)} due first` : "Add a paycheck or deposit"}</small></div>
      <div className="summary-card card"><span><ArrowDownLeft size={16} /> Coming in</span><strong className="plan-income">{formatCurrency(upcomingIncome, { compact: true })}</strong><small>all upcoming income</small></div>
      <div className="summary-card card"><span><ArrowUpRight size={16} /> Going out</span><strong>{formatCurrency(upcomingExpenses, { compact: true })}</strong><small>all upcoming obligations</small></div>
    </div>
    <div className="section-heading"><div><h2>Upcoming cash flow</h2><p>Recurring items and one-time plans, ordered by date.</p></div></div>
    <section className="card plan-timeline">
      {plan.length ? plan.map((item) => <div className={`plan-item ${item.type}`} key={item.id}><span className="plan-direction">{item.type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="plan-meta"><strong>{item.name}</strong><span>{format(parseISO(item.date), "EEEE, MMM d")}</span></div><strong className={item.type === "income" ? "plan-income" : ""}>{formatCurrency(item.type === "income" ? item.amountCents : -item.amountCents, { signed: true })}</strong></div>) : <div className="plan-empty"><CalendarClock size={24} /><h3>Nothing planned yet</h3><p>Add your next income and any bills due before it. SPND will use them in the safe-to-spend calculation.</p></div>}
    </section>
    <PlanEditor />
    <RecurringCandidates initialCandidates={candidates} />
  </PageShell>;
}
