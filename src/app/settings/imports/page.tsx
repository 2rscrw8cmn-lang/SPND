import type { Metadata } from "next";
import { ImportInbox } from "@/components/import-inbox";
import { PageShell } from "@/components/page-shell";
import { getAccountsData, getImportInbox } from "@/lib/data";

export const metadata: Metadata = { title: "Import inbox" };

export default async function ImportsPage() {
  const [imports, accounts] = await Promise.all([getImportInbox(), getAccountsData()]);
  return <PageShell><h1 className="page-title">Import inbox</h1><p className="page-subtitle">Upload, inspect, correct, then approve. Nothing changes your budget until you apply it.</p><ImportInbox initialImports={imports} accounts={accounts} /></PageShell>;
}
