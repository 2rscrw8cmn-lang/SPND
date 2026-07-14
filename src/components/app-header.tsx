import Link from "next/link";

export function AppHeader({ firstName }: { firstName: string }) {
  return (
    <header className="app-header">
      <Link href="/" className="wordmark" aria-label="SPND home">SPND</Link>
      <Link href="/settings" className="avatar" aria-label="Open settings">{firstName.slice(0, 1).toUpperCase()}</Link>
    </header>
  );
}

