import type { Metadata } from "next";
import { IncomeView } from "@/components/income-view";
import { PageShell } from "@/components/page-shell";
import { getExpectedIncomeSources, getIncomeView } from "@/lib/data";

export const metadata: Metadata = { title: "Income" };
export default async function IncomePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) { const { month } = await searchParams; const [data,sources]=await Promise.all([getIncomeView(month),getExpectedIncomeSources()]); return <PageShell><h1 className="page-title">Income</h1><p className="page-subtitle">Expected income and the deposits that fulfill it.</p><IncomeView data={data} sources={sources}/></PageShell>; }
