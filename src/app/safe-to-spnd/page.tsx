import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { getSafeBreakdown } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Safe to SPND" };

export default async function SafeToSpndPage() {
  const safe = await getSafeBreakdown();
  const rows = [
    ["Available cash", safe.availableCashCents, true],
    ["Bills due before income", safe.billsDueCents, false],
    ["Expected category spending", safe.categoryReserveCents, false],
    ["Pending transactions", safe.pendingExpenseCents, false],
    ["Minimum cash buffer", safe.minimumBufferCents, false],
  ] as const;
  return (
    <PageShell>
      <h1 className="page-title">Your number, explained</h1>
      <p className="page-subtitle">Expected category spending is prorated only through your next income date.</p>
      <section className="hero card">
        <p className="eyebrow">Safe to SPND</p>
        <p className="safe-value">{formatCurrency(safe.safeCents, { compact: true })}</p>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        {rows.map(([label, amount, positive]) => (
          <div className="breakdown-row" key={label}><span>{label}</span><strong>{positive ? "" : "−"}{formatCurrency(amount)}</strong></div>
        ))}
        <div className="breakdown-row breakdown-total"><strong>Safe to SPND</strong><strong>{formatCurrency(safe.safeCents)}</strong></div>
      </section>
      <div className="insight card"><span className="insight-icon"><AlertCircle size={22} /></span><p>Pending purchases are reserved now and matched when they post, so they aren’t counted twice.</p></div>
    </PageShell>
  );
}
