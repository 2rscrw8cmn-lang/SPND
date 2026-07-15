import { NextResponse } from "next/server";
import { authenticatedHousehold } from "@/lib/server-auth";
import { getActivityData } from "@/lib/data";

export async function GET(request: Request) {
  if (!await authenticatedHousehold()) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const url = new URL(request.url); const limit = 50;
  const transactions = await getActivityData(limit, url.searchParams.get("month") ?? undefined, { query: url.searchParams.get("q") ?? undefined, filter: url.searchParams.get("filter") ?? undefined, categoryId: url.searchParams.get("category") ?? undefined, accountId: url.searchParams.get("account") ?? undefined, date: url.searchParams.get("date") ?? undefined, before: url.searchParams.get("before") ?? undefined, transactionId: url.searchParams.get("transaction") ?? undefined });
  return NextResponse.json({ transactions, nextCursor: transactions.length === limit ? transactions.at(-1)?.isoDate ?? null : null });
}
