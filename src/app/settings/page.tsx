import type { Metadata } from "next";
import { CircleDollarSign, ClipboardCheck, Database, Download, FileUp, Landmark, ShieldCheck } from "lucide-react";
import { CategoryGroupSettings } from "@/components/category-group-settings";
import { PageShell } from "@/components/page-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { SimpleFinConnection } from "@/components/simplefin-connection";
import { getBudgetWorkspace, getConnectionHealth, getHouseholdSummary } from "@/lib/data";
import { isDemoMode } from "@/lib/env";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [health, workspace, household] = await Promise.all([getConnectionHealth(), getBudgetWorkspace(), getHouseholdSummary()]);
  const categoryCounts = workspace.categories.reduce<Record<string, number>>((counts, category) => ({ ...counts, [category.categoryGroup]: (counts[category.categoryGroup] ?? 0) + 1 }), {});
  return (
    <PageShell>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">{household.name} · {household.timezone}</p>
      <div className="section-heading"><div><h2>Budget structure</h2><p>Shape the budget around your household.</p></div></div>
      <CategoryGroupSettings initialGroups={workspace.categoryGroups} categoryCounts={categoryCounts} />
      <div className="section-heading"><h2>Connections</h2></div>
      <section className="form-card card">
        <p className="eyebrow">Bank sync</p>
        <h2>SimpleFIN Bridge</h2>
        <p className="page-subtitle">Read-only account balances and transactions. Your access credential stays encrypted on the server.</p>
        <SimpleFinConnection initialHealth={health} />
      </section>
      <div className="section-heading"><h2>Household</h2></div>
      <section className="card">
        <a className="settings-row" href="/settings/imports"><div><strong>Import inbox</strong><br /><span>Upload, review, and apply documents</span></div><FileUp /></a>
        <a className="settings-row" href="/settings/diagnostics"><div><strong>Reconciliation checks</strong><br /><span>Verify balances, transactions, and allocations</span></div><ClipboardCheck /></a>
        <div className="settings-row"><div><strong>Members</strong><br /><span>{household.memberCount} household member{household.memberCount === 1 ? "" : "s"}</span></div><ShieldCheck color="var(--lime)" /></div>
        <div className="settings-row"><div><strong>Minimum cash buffer</strong><br /><span>{formatCurrency(household.minimumCashBufferCents)}</span></div><CircleDollarSign /></div>
        <a className="settings-row" href="/settings/accounts"><div><strong>Accounts</strong><br /><span>Choose cash flow, net worth, or excluded</span></div><Landmark /></a>
      </section>
      <div className="section-heading"><h2>Data & privacy</h2></div>
      <section className="card">
        <a className="settings-row" href="/api/export/transactions"><div><strong>Export transactions</strong><br /><span>Download a CSV backup</span></div><Download /></a>
        <a className="settings-row" href="/api/export/budget"><div><strong>Export budget</strong><br /><span>Monthly amounts and categories</span></div><Database /></a>
        <SignOutButton demoMode={isDemoMode} />
      </section>
    </PageShell>
  );
}
