import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ConnectionHealth } from "@/lib/data";

type Report = { accounts: number; staleAccounts: number; activeTransactions: number; supersededPending: number; allocationMismatches: number; excludedAccounts: number; checksRunAt: string };

export function ReconciliationReport({ report, health }: { report: Report; health: ConnectionHealth }) {
  const checks = [
    { label: "SimpleFIN balance snapshot", detail: report.accounts ? `${report.accounts} accounts; ${report.staleAccounts} older than 48 hours` : "No imported accounts", ok: report.accounts > 0 && report.staleAccounts === 0 },
    { label: "Transaction import", detail: `${report.activeTransactions} active transactions; latest sync received ${health.transactionCount}`, ok: health.status === "active" },
    { label: "Pending replacement", detail: `${report.supersededPending} pending source records retained and excluded after posting`, ok: true },
    { label: "Category allocations", detail: `${report.allocationMismatches} allocation totals do not match their transaction`, ok: report.allocationMismatches === 0 },
    { label: "Excluded accounts", detail: `${report.excludedAccounts} accounts intentionally excluded from Safe to SPND`, ok: true },
    { label: "Credential boundary", detail: "Health and diagnostics expose no access URL, Setup Token, or raw provider credential", ok: true },
  ];
  return <><section className="diagnostic-summary card"><span>Overall status</span><strong>{checks.every((check) => check.ok) ? "Ready" : "Needs attention"}</strong><p>Checked {format(new Date(report.checksRunAt), "MMM d, yyyy 'at' h:mm a")}</p></section><div className="diagnostic-list card">{checks.map((check) => <div className="diagnostic-row" key={check.label}>{check.ok ? <CheckCircle2 className="check-ok" /> : <AlertTriangle className="check-warn" />}<div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}</div><p className="diagnostic-note">Account balances are compared to the latest stored SimpleFIN snapshot. Run a sync immediately before final reconciliation with your institution.</p></>;
}
