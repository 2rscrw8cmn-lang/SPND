import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm sign in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const emailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const code = first(params.code);
  const type = first(params.type);
  const hasTokenHash = Boolean(tokenHash && type && emailOtpTypes.has(type));
  const canConfirm = hasTokenHash || Boolean(code);

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="wordmark">SPND</div>
        <p className="eyebrow">Secure sign in</p>
        <h1>{canConfirm ? "One last step." : "This link isn’t valid."}</h1>
        <p>
          {canConfirm
            ? "Continue to finish signing in. Your secure link is not used until you press the button below."
            : "Request a fresh sign-in link, then open the newest email you receive."}
        </p>
        {canConfirm ? (
          <form action="/auth/verify" method="post">
            {hasTokenHash ? (
              <>
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value={type} />
              </>
            ) : (
              <input type="hidden" name="code" value={code} />
            )}
            <button className="primary-button auth-submit" type="submit">
              Continue to SPND
            </button>
          </form>
        ) : (
          <a className="primary-button auth-submit" href="/login">
            Request a new link
          </a>
        )}
      </section>
    </main>
  );
}
