import { addMonths, format, parseISO } from "date-fns";
import { Banknote, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ExpectedIncomeSettings } from "@/components/expected-income-settings";
import { IncomeDeposits } from "@/components/income-deposits";
import type { ExpectedIncomeSource, IncomeViewData } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

export function IncomeView({ data, sources }: { data: IncomeViewData; sources: ExpectedIncomeSource[] }) {
  const monthDate = parseISO(data.month);
  const today = format(new Date(), "yyyy-MM-dd");
  const nextExpected = data.upcoming.find((item) => item.date >= today);
  const receivedPercent = data.expectedCents > 0 ? Math.min(100, Math.round((data.receivedCents / data.expectedCents) * 100)) : 0;
  return <>
    <nav className="month-rail" aria-label="Income month">{[-1,0,1].map((offset) => { const date = addMonths(monthDate, offset); return <Link aria-current={offset === 0 ? "date" : undefined} className={offset === 0 ? "selected" : ""} href={`/income?month=${format(date,"yyyy-MM")}`} key={offset}>{offset < 0 ? <ChevronLeft size={16}/> : null}{format(date, offset === 0 ? "MMM yyyy" : "MMM")}{offset > 0 ? <ChevronRight size={16}/> : null}</Link>; })}</nav>
    <section className="income-summary"><span className="income-summary-icon"><Banknote /></span><div><strong>{formatCurrency(data.expectedCents)}</strong><span>expected</span></div><p><b>{formatCurrency(data.receivedCents)}</b> received · {formatCurrency(data.remainingCents)} remaining</p><div className="income-progress-line"><progress max={Math.max(1,data.expectedCents)} value={Math.min(data.expectedCents,data.receivedCents)} /><span>{receivedPercent}%</span></div>{nextExpected ? <p className="income-next-expected"><CalendarDays size={14} /> Next expected {format(parseISO(nextExpected.date), "MMM d")} · {formatCurrency(nextExpected.amountCents)}</p> : null}</section>
    <IncomeDeposits openExpectations={data.openExpectations} received={data.received} receivedCents={data.receivedCents} unmatched={data.unmatched}>
      <section className="income-section"><div className="section-line"><h2>Upcoming</h2><span>{data.upcoming.length}</span></div><div className="income-upcoming card">{data.upcoming.map((item)=><div key={`${item.sourceId}-${item.date}`}><CalendarDays/><span><strong>{item.name}</strong><small>{format(parseISO(item.date),"MMM d")}</small></span><strong>{formatCurrency(item.amountCents)}</strong></div>)}{!data.upcoming.length?<p className="compact-empty">No expected income scheduled.</p>:null}</div></section>
    </IncomeDeposits>
    <ExpectedIncomeSettings initialSources={sources}/>
  </>;
}
