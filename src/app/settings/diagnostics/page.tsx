import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ReconciliationReport } from "@/components/reconciliation-report";
import { getConnectionHealth, getReconciliationData } from "@/lib/data";

export const metadata: Metadata = { title: "Reconciliation checks" };

export default async function DiagnosticsPage() {
  const [report, health] = await Promise.all([getReconciliationData(), getConnectionHealth()]);
  return <PageShell><h1 className="page-title">Reconciliation</h1><p className="page-subtitle">A read-only health check for the data behind your daily numbers.</p><ReconciliationReport report={report} health={health} /></PageShell>;
}
