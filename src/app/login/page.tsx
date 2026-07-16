import type { Metadata } from "next";
import { MagicLinkForm } from "@/components/magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const error = (await searchParams).error;
  const initialMessage = error === "invalid_link"
    ? "That sign-in link is invalid, expired, or has already been used. Request a fresh link below."
    : "";

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="wordmark">SPND</div>
        <p className="eyebrow">Turco Household</p>
        <h1>Welcome home.</h1>
        <p>Use your approved household email. We’ll send a secure link—no password to remember.</p>
        <MagicLinkForm initialMessage={initialMessage} />
      </section>
    </main>
  );
}
