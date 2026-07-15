export type SimpleFinTransaction = {
  id?: string;
  posted: number;
  transacted_at?: number;
  amount: string;
  description: string;
  pending?: boolean;
};

export type SimpleFinConnection = {
  conn_id: string;
  name: string;
  org_id?: string;
  org_name?: string;
};

export type SimpleFinAccount = {
  id: string;
  name: string;
  conn_id?: string;
  conn_name?: string;
  currency?: string;
  balance: string;
  "available-balance"?: string;
  "balance-date"?: number;
  transactions?: SimpleFinTransaction[];
};

export type SimpleFinIssue = {
  code?: string;
  msg?: string;
  message?: string;
  conn_id?: string;
  account_id?: string;
};

export type SimpleFinResponse = {
  accounts?: SimpleFinAccount[];
  connections?: SimpleFinConnection[];
  errors?: string[];
  errlist?: SimpleFinIssue[];
};

export type SyncWindow = { start: Date; endExclusive: Date };

const DAY_SECONDS = 86_400;

export function buildSyncWindows(anchor: Date, initial: boolean): SyncWindow[] {
  const endSeconds = Math.floor(anchor.getTime() / 1000) + 1;
  const windowCount = initial ? 4 : 1;
  const windowDays = initial ? 90 : 14;
  const firstStart = endSeconds - windowCount * windowDays * DAY_SECONDS;
  return Array.from({ length: windowCount }, (_, index) => {
    const start = firstStart + index * windowDays * DAY_SECONDS;
    const endExclusive = start + windowDays * DAY_SECONDS;
    return { start: new Date(start * 1000), endExclusive: new Date(endExclusive * 1000) };
  });
}

export function transactionDate(transaction: SimpleFinTransaction): string | null {
  const seconds = transaction.transacted_at && transaction.transacted_at > 0
    ? transaction.transacted_at
    : transaction.posted > 0
      ? transaction.posted
      : null;
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function connectionNames(payload: SimpleFinResponse) {
  return new Map((payload.connections ?? []).map((connection) => [connection.conn_id, connection.org_name ?? connection.name]));
}

export function sanitizeProviderIssues(payload: SimpleFinResponse) {
  const structured = (payload.errlist ?? []).map((item) => {
    if (item.code === "con.auth") return "An institution connection needs reauthentication in SimpleFIN.";
    if (item.code === "act.failed" || item.code === "act.missingdata") return "SimpleFIN could not retrieve one institution account completely. Try again later.";
    if (item.code === "gen.auth") return "SimpleFIN rejected the connection authorization.";
    return item.msg ?? item.message ?? item.code ?? "SimpleFIN reported an account issue.";
  });
  return [...(payload.errors ?? []), ...structured]
    .map((message) => message.replace(/https?:\/\/\S+/gi, "provider URL").replace(/[A-Za-z0-9._%+-]+:[^\s@]+@/g, "provider credentials@"))
    .filter(Boolean)
    .slice(0, 3);
}
