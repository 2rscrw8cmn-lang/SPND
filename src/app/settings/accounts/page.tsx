import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { PageShell } from "@/components/page-shell";
import { getAccountsData } from "@/lib/data";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const accounts = await getAccountsData();
  return <PageShell><h1 className="page-title">Accounts</h1><p className="page-subtitle">Only “Available cash” accounts can increase Safe to SPND. Credit cards should usually be net-worth-only.</p><AccountSettings initialAccounts={accounts} /></PageShell>;
}

