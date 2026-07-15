# SPND release runbook

Use this runbook after S1–S6 are merged and before promoting a production deployment. Automated gates catch code and database regressions; financial reconciliation requires a real, redacted household dataset.

## One-time deployment setup

1. Create separate Supabase projects for preview/staging and production. Never point pull requests at production.
2. Apply migrations in filename order with `supabase link --project-ref <project-ref>` followed by `supabase db push`.
3. Configure hosting with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SIMPLEFIN_ENCRYPTION_KEY`, and `SIMPLEFIN_CREDENTIALS_KEY`. Keep server-only values out of browser-exposed variables.
4. Leave `ENABLE_EXPERIMENTAL_IMPORTS` unset or `false` for release.
5. Require the GitHub `Quality` workflow on protected `main`. Its Supabase job starts a disposable local stack and uses no production credentials.
6. Deploy over HTTPS. On iPhone, open SPND in Safari, tap Share, then **Add to Home Screen**. On Chromium, use **Install app** in Settings or the browser install control.

## Local release verification

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:visual
```

For disposable database tests, install Docker and the Supabase CLI, then run:

```bash
supabase start
supabase status -o env > .supabase-test.env
set -a
source .supabase-test.env
set +a
RUN_SUPABASE_INTEGRATION=true \
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
npm run test:integration
supabase stop
rm .supabase-test.env
```

The integration suite verifies both household members, outsider and anonymous denial, allocation replacement, budget money movement, recurring decision preservation, and pending-to-posted linkage. SimpleFIN fixtures remain the source of truth for provider reconciliation behavior.

## Financial acceptance checklist

- [ ] Reconcile every included account to its institution balance and timestamp.
- [ ] Reconcile one real credit-card liability and its checking-account payment; confirm the payment is a transfer, not spending or income.
- [ ] Confirm Budget assigned, spent, pending, and remaining totals reconcile to transaction allocations in integer cents.
- [ ] Verify one pending purchase reduces Safe to SPND once and posting it does not change the total merely because its status changed.
- [ ] Verify Expected income remains a planning input while Received income comes from posted income transactions.
- [ ] Match and unmatch a Plan item; confirm its transaction relationship and recurring decision survive refresh and sync.
- [ ] Exercise SimpleFIN full success and partial failure; confirm health, last success, and sanitized error state.
- [ ] Complete the workflow as Zack and Stephanie, including a household neither belongs to.

## Device and accessibility QA

- [ ] Run Playwright at 390×844 and 430×932 with no horizontal overflow.
- [ ] Test an installed build on Safari for iPhone, including safe areas, relaunch, and offline banner.
- [ ] Test desktop Safari or Chromium.
- [ ] Keyboard through dialogs and menus; verify visible focus, trapping, Escape, and focus restoration.
- [ ] Verify bottom-sheet drag dismissal does not interfere with scrolling.
- [ ] Enable reduced motion and confirm state changes remain understandable.
- [ ] Check headings, button names, labels, status announcements, and transaction meaning with VoiceOver or another screen reader.
- [ ] Disconnect networking on a financial screen. Confirm values are marked last-known and failed changes are not shown as saved.

## Release evidence and rollback

1. Capture redacted screenshots using [Design reference images](11-design-reference-images.md). Remove names, account numbers, access URLs, and exact balances.
2. Record the commit SHA, migrations, completed checklist, reconciliation timestamp, and reviewer in release notes.
3. Back up Supabase before production migrations. Roll back app code by redeploying the previous commit; correct databases with a forward migration.
4. After promotion, verify sign-in, Home, Budget, Activity, Plan, Settings, manifest, icons, SimpleFIN health, and one read-only sync. Stop if reconciliation changes unexpectedly.
