import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { PageShell } from "@/components/page-shell";
import { getAccountsData } from "@/lib/data";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const accounts = await getAccountsData();
  return <PageShell><h1 className="page-title">Accounts</h1><p className="page-subtitle">Verify each account’s role, balance basis, and pending behavior before trusting Safe to SPND.</p><AccountSettings initialAccounts={accounts} /></PageShell>;
}
