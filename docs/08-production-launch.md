# SPND — Production Launch

The application is built and deployed at [spnd-omega.vercel.app](https://spnd-omega.vercel.app) through the `verus-domus/spnd` Vercel project. Production activation is intentionally separate from development so no financial data or provider credential is deployed accidentally.

## 1. Apply the Supabase migration

Apply `supabase/migrations/202607140001_initial_schema.sql` and then `supabase/migrations/202607140002_schema_sync.sql` to project `iaybcbjtxizyevmillar` using the Supabase SQL editor or an authenticated Supabase CLI session.

The migration creates the Turco Household, allowlists:

- `zack@turco.family`
- `stephanie@turco.family`

It also enables RLS, installs the user-membership trigger, and creates the starting category taxonomy.

## 2. Configure Supabase Auth

In **Authentication → URL Configuration**, add:

- `http://localhost:3000/auth/confirm`
- `https://spnd-omega.vercel.app/auth/confirm`

Keep email OTP/magic-link authentication enabled. Disable public user discovery and do not add other household invitations without updating `household_invites`.

### Email delivery

Supabase's built-in email sender is intended for testing and only delivers to pre-authorized project/team addresses. For `zack@turco.family` and `stephanie@turco.family`, configure a custom SMTP provider under **Authentication → SMTP Settings** before daily use. Use a verified sender on `turco.family`, sender name `SPND`, and the provider's SMTP host, port, username, and password/API key. Keep link tracking disabled so Supabase confirmation URLs are not rewritten.

## 3. Add protected environment values

Add these to Vercel Production and Preview settings. Never paste their values into source files, chat, screenshots, or issues.

```text
SUPABASE_SERVICE_ROLE_KEY
SPND_ENCRYPTION_KEY_BASE64
CRON_SECRET
```

Generate the encryption key once:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate the cron secret once:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Also set:

```text
NEXT_PUBLIC_SUPABASE_URL=https://iaybcbjtxizyevmillar.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
NEXT_PUBLIC_APP_URL=https://<production-domain>
SPND_DEMO_MODE=false
```

`SENTRY_DSN` remains optional until a Sentry project is created.

## 4. Import the historical file

Keep `transactions.csv` at the repository root. It is gitignored and must remain private. Add `SUPABASE_SERVICE_ROLE_KEY` to the ignored `.env.local`, then run:

```powershell
npm run import:transactions
```

The importer is idempotent. It converts the source file's signs into SPND's convention, preserves source categories and notes, and excludes transfers. Imported accounts begin as excluded; choose their correct treatment in **Settings → Accounts**.

## 5. Connect SimpleFIN

After production authentication works:

1. Sign in as Zack.
2. Open **Settings → SimpleFIN Bridge**.
3. Paste a newly generated one-time Setup Token into that screen only.
4. Wait for the initial twelve-month sync to complete.
5. Open **Settings → Accounts** and mark each account as Available cash, Net worth only, or Excluded.

Never put the Setup Token in an environment variable. SPND claims it once and encrypts the returned access URL immediately.

## 6. Establish the first trustworthy plan

Before relying on Safe to SPND:

- Set the minimum cash buffer.
- Enter monthly category amounts.
- Confirm the next income date and amount.
- Confirm detected recurring bills or add planned obligations manually.
- Check the pending total and account balances against the institutions.
- Review the full Safe to SPND breakdown.

Keep an external source of truth for the first month of use.
