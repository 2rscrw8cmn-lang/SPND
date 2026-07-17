import type { Metadata } from "next";
import { PasswordLoginForm } from "@/components/password-login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const error = (await searchParams).error;
  const initialMessage = error === "invalid_link"
    ? "That sign-in link is invalid or expired. Sign in with your email and password below."
    : "";

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="wordmark">SPND</div>
        <p className="eyebrow">Turco Household</p>
        <h1>Welcome home.</h1>
        <p>Sign in with your approved household email and password.</p>
        <PasswordLoginForm initialMessage={initialMessage} />
      </section>
    </main>
  );
}
