# SPND — Owner Setup Checklist

## 1. Accounts and services

- [ ] GitHub repository created: `2rscrw8cmn-lang/SPND`
- [ ] Vercel project connected to this repository
- [ ] Supabase project created in the desired region
- [ ] SimpleFIN Bridge household subscription active
- [ ] Institutions tested in SimpleFIN before build completion
- [ ] Two email addresses identified for Zack and Stephanie

## 2. Supabase

1. Create a new Supabase project.
2. Copy project URL, anon key, and service-role key into Vercel environment variables.
3. Configure Auth redirect URLs for local development and production.
4. Apply migrations from the application repository.
5. Do not use service-role key in browser code.

## 3. Vercel

1. Import the GitHub repo as a Next.js project.
2. Add production and preview environment variables from `docs/03-architecture.md`.
3. Generate a random 32-byte encryption key for `SPND_ENCRYPTION_KEY_BASE64`.
4. Generate a long random `CRON_SECRET`.
5. Set the production domain after the first deployment.
6. Enable error monitoring before connecting real accounts.

## 4. First connection

- [ ] Verify SimpleFIN includes the desired institution/account.
- [ ] Generate a fresh SPND Setup Token in SimpleFIN.
- [ ] Paste it only into SPND's authenticated connection screen.
- [ ] Select included cash-flow accounts.
- [ ] Verify transaction count and balances.
- [ ] Set initial categories, fixed monthly amounts, bills, pay dates, and cash buffer.
- [ ] Confirm the Safe to SPND breakdown makes sense before trusting it.

## 5. Before daily use

- [ ] Create a backup/export process.
- [ ] Confirm both users can log in and see only the shared household.
- [ ] Test disconnect and reconnect.
- [ ] Review every category rule created during the first two weeks.
- [ ] Keep an external source of truth available until SPND has proven reliable for one full month.
