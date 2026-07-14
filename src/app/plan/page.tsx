import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { PlanEditor } from "@/components/plan-editor";
import { RecurringCandidates } from "@/components/recurring-candidates";
import { getPlanData, getRecurringCandidates } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const [plan, candidates] = await Promise.all([getPlanData(), getRecurringCandidates()]);
  const nextIncome = plan.find((item) => item.type === "income");
  const dueBeforeIncome = nextIncome
    ? plan.filter((item) => item.type === "expense" && item.date <= nextIncome.date).reduce((sum, item) => sum + Math.abs(item.amountCents), 0)
    : 0;
  return (
    <PageShell>
      <h1 className="page-title">Plan</h1>
      <p className="page-subtitle">Confirmed income and obligations that shape what’s safe to spend.</p>
      <div className="summary-grid">
        <div className="summary-card card"><span>Next income</span><strong>{nextIncome ? format(parseISO(nextIncome.date), "MMM d") : "Needs review"}</strong></div>
        <div className="summary-card card"><span>Due before then</span><strong>{formatCurrency(dueBeforeIncome, { compact: true })}</strong></div>
      </div>
      <div className="section-heading"><h2>Upcoming</h2></div>
      <section className="card">
        {plan.map((item) => (
          <div className="plan-item" key={item.id}>
            <div className="plan-meta"><strong>{item.name}</strong><span>{format(parseISO(item.date), "EEEE, MMM d")}</span></div>
            <strong className={item.type === "income" ? "plan-income" : ""}>{formatCurrency(item.type === "income" ? item.amountCents : -item.amountCents, { signed: true })}</strong>
          </div>
        ))}
      </section>
      <PlanEditor />
      <RecurringCandidates initialCandidates={candidates} />
    </PageShell>
  );
}
