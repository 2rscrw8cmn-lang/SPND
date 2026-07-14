import type { Metadata } from "next";
import { ChevronRight, Database, Download, Landmark, LogOut, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SimpleFinConnection } from "@/components/simplefin-connection";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageShell>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Turco Household · America/New_York</p>
      <section className="form-card card">
        <p className="eyebrow">Connections</p>
        <h2>SimpleFIN Bridge</h2>
        <p className="page-subtitle">Read-only account balances and transactions. Your access credential stays encrypted on the server.</p>
        <SimpleFinConnection />
      </section>
      <div className="section-heading"><h2>Household</h2></div>
      <section className="card">
        <div className="settings-row"><div><strong>Members</strong><br /><span>Zack and Stephanie</span></div><ShieldCheck color="var(--lime)" /></div>
        <div className="settings-row"><div><strong>Minimum cash buffer</strong><br /><span>$750.00</span></div><ChevronRight /></div>
        <a className="settings-row" href="/settings/accounts"><div><strong>Accounts</strong><br /><span>Choose cash flow, net worth, or excluded</span></div><Landmark /></a>
      </section>
      <div className="section-heading"><h2>Data & privacy</h2></div>
      <section className="card">
        <a className="settings-row" href="/api/export/transactions"><div><strong>Export transactions</strong><br /><span>Download a CSV backup</span></div><Download /></a>
        <a className="settings-row" href="/api/export/budget"><div><strong>Export budget</strong><br /><span>Monthly amounts and categories</span></div><Database /></a>
        <div className="settings-row"><div><strong>Sign out</strong><br /><span>End this session</span></div><LogOut /></div>
      </section>
    </PageShell>
  );
}
