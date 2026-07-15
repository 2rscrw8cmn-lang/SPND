import type { Metadata } from "next";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { getSafeBreakdown } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Safe to SPND" };

export default async function SafeToSpndPage() {
  const safe = await getSafeBreakdown();
  const rows = [
    ["Effective cash", safe.effectiveCash, true], ["Paid-in-full card reserve", safe.cardReserve, false],
    ["Obligations before income", safe.obligations, false], ["Goal contributions", safe.goals, false],
    ["Variable spending before income", safe.variableSpending, false], ["Minimum cash buffer", safe.minimumBuffer, false],
  ] as const;
  return <PageShell>
    <h1 className="page-title">Your number, explained</h1>
    <p className="page-subtitle">Every dollar is assigned to one calculation component so pending activity is never subtracted globally twice.</p>
    <section className="hero card"><p className="eyebrow">Safe to SPND</p><p className="safe-value">{safe.needsReview ? "Needs review" : formatCurrency(safe.safeCents, { compact: true })}</p>{safe.shortfallCents ? <p className="connection-error">Shortfall: {formatCurrency(safe.shortfallCents)}</p> : null}</section>
    {safe.needsReview ? <section className="insight card safe-review"><span className="insight-icon"><AlertTriangle size={22} /></span><div><strong>Calculation needs review</strong>{safe.reviewReasons.map((reason) => <p key={reason}>{reason}</p>)}</div></section> : null}
    <section className="card safe-components">
      {rows.map(([label, component, positive]) => <details className="safe-component" key={label}><summary><span>{label}</span><strong>{positive ? "" : "−"}{formatCurrency(component.totalCents)}</strong></summary>{component.records.length ? <div className="safe-component-records">{component.records.map((record) => <div key={record.id}><span>{record.name}<small>{record.detail}</small></span><strong>{formatCurrency(record.amountCents)}</strong></div>)}</div> : <p>Nothing reserved in this component.</p>}</details>)}
      <div className="breakdown-row breakdown-total"><strong>Raw Safe to SPND</strong><strong>{formatCurrency(safe.rawSafeCents)}</strong></div>
      <div className="breakdown-row"><strong>Displayed Safe to SPND</strong><strong>{formatCurrency(safe.safeCents)}</strong></div>
    </section>
    <div className="insight card"><span className="insight-icon"><AlertCircle size={22} /></span><p>Paid-in-full card purchases affect their category once and the card liability once. Card payments themselves are excluded transfers.</p></div>
  </PageShell>;
}
