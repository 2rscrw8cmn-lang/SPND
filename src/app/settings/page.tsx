import {
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Download,
  FileUp,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { SimpleFinConnection } from "@/components/simplefin-connection";
import { ExpectedIncomeSettings } from "@/components/expected-income-settings";
import {
  getBudgetWorkspace,
  getConnectionHealth,
  getExpectedIncomeSources,
  getHouseholdSummary,
} from "@/lib/data";
import { getMerchantRules } from "@/lib/data";
import { HouseholdSettings } from "@/components/household-settings";
import { MerchantRuleSettings } from "@/components/merchant-rule-settings";
import { isDemoMode } from "@/lib/env";
import { formatCurrency } from "@/lib/utils";
import { importsEnabled } from "@/lib/env";
import { InstallAppSettings } from "@/components/install-app-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [health, workspace, household, incomeSources, merchantRules] =
    await Promise.all([
      getConnectionHealth(),
      getBudgetWorkspace(),
      getHouseholdSummary(),
      getExpectedIncomeSources(),
      getMerchantRules(),
    ]);
  return (
    <PageShell>
      <header className="settings-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Manage the household, budget structure, and connected data.
          </p>
        </div>
        <span className={`connection-pill ${health.status}`}>
          {health.status === "active" ? "Bank connected" : health.status}
        </span>
      </header>

      <section
        className="settings-household-card card"
        aria-label="Household summary"
      >
        <div className="settings-household-title">
          <span>
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>{household.name}</strong>
            <small>{household.timezone}</small>
          </div>
        </div>
        <dl>
          <div>
            <dt>
              <Users size={15} /> Members
            </dt>
            <dd>{household.memberCount}</dd>
          </div>
          <div>
            <dt>
              <CircleDollarSign size={15} /> Cash buffer
            </dt>
            <dd>{formatCurrency(household.minimumCashBufferCents)}</dd>
          </div>
        </dl>
      </section>
      <section className="settings-section">
        <HouseholdSettings initialHousehold={household} />
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>Budget planning</h2>
            <p>
              Maintain expected income and transaction automation. Category
              structure now lives in Edit budget.
            </p>
          </div>
        </div>
        <ExpectedIncomeSettings initialSources={incomeSources} />
        <MerchantRuleSettings
          initialRules={merchantRules}
          categories={workspace.categories}
        />
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>Accounts & data</h2>
            <p>Control connected accounts and verify household data health.</p>
          </div>
        </div>
        <div className="settings-link-card card">
          <a className="settings-row" href="/settings/accounts">
            <span className="settings-row-icon">
              <Landmark size={19} />
            </span>
            <div>
              <strong>Accounts</strong>
              <span>Roles, balance treatment, and net worth</span>
            </div>
          </a>
          {importsEnabled() ? (
            <a className="settings-row" href="/settings/imports">
              <span className="settings-row-icon">
                <FileUp size={19} />
              </span>
              <div>
                <strong>Experimental import inbox</strong>
                <span>Controlled testing only</span>
              </div>
            </a>
          ) : null}
          <a className="settings-row" href="/settings/diagnostics">
            <span className="settings-row-icon">
              <ClipboardCheck size={19} />
            </span>
            <div>
              <strong>Data health</strong>
              <span>Check balances, transactions, and allocations</span>
            </div>
          </a>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>Bank connection</h2>
            <p>Read-only transaction and balance sync.</p>
          </div>
        </div>
        <details className="settings-disclosure card">
          <summary>
            <span>
              <Landmark size={19} />
            </span>
            <span>
              <strong>SimpleFIN Bridge</strong>
              <small>
                {health.status === "active"
                  ? "Connected and syncing"
                  : "Manage connection"}
              </small>
            </span>
            <ChevronDown size={17} />
          </summary>
          <div className="settings-connection-card">
            <SimpleFinConnection initialHealth={health} />
          </div>
        </details>
      </section>

      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>Data & session</h2>
            <p>Download a copy of your household data or end this session.</p>
          </div>
        </div>
        <div className="settings-link-card card">
          <a className="settings-row" href="/api/export/transactions">
            <span className="settings-row-icon">
              <Download size={19} />
            </span>
            <div>
              <strong>Export transactions</strong>
              <span>CSV backup of transaction history</span>
            </div>
          </a>
          <a className="settings-row" href="/api/export/budget">
            <span className="settings-row-icon">
              <Database size={19} />
            </span>
            <div>
              <strong>Export budget</strong>
              <span>Monthly amounts and category structure</span>
            </div>
          </a>
          <SignOutButton demoMode={isDemoMode} />
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading">
          <div>
            <h2>App</h2>
            <p>Install SPND for a full-screen, home-screen experience.</p>
          </div>
        </div>
        <InstallAppSettings />
      </section>
    </PageShell>
  );
}
