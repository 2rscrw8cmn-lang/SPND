import { redirect } from "next/navigation";

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  redirect(`/plan${month ? `?month=${encodeURIComponent(month)}` : ""}#income`);
}
