# SPND — Build Plan for Codex

## Non-negotiable implementation rules

1. Build in small, testable milestones. Do not attempt every screen at once.
2. Use TypeScript, strict mode, server-side validation, and database migrations.
3. Never send SimpleFIN credentials or access URLs to the browser.
4. All user-visible money values must use integer cents in storage and `Intl.NumberFormat` in the UI.
5. Treat transaction imports as idempotent. Re-running a sync must not duplicate records.
6. Keep a visible audit trail for manual transaction edits and category-rule changes.
7. Preserve dark-only design; do not implement a light theme.

## Milestone sequence

### M0 — Project shell

- Initialize Next.js App Router, TypeScript, ESLint, Prettier, Tailwind, shadcn/ui, and Lucide.
- Add Supabase client/server utilities and environment-variable validation.
- Implement auth and household membership with two invited users.
- Create the dark-only SPND shell, mobile bottom navigation, and desktop responsive layout.
- Seed a demo household with sample data behind a development-only toggle.

**Acceptance:** authenticated user sees the SPND home shell with responsive navigation and no finance data exposed to other users.

### M1 — Data foundation

- Implement migrations from [data model](07-data-model.md).
- Add Row Level Security policies based on `household_members`.
- Implement account and transaction repositories.
- Import a fixture file and prove dedupe, immutable source data, and manual overrides.

**Acceptance:** repeated fixture import creates no duplicates; both household members see the same approved data only.

### M2 — SimpleFIN connection and sync

- Implement the server-only setup-token claim route.
- Encrypt the returned access URL before storage.
- Fetch `/accounts?version=2` server-side on a scheduled job; normalize accounts and transactions.
- Write sync run status, structured API errors, and user-facing connection health.
- Provide revoke/disconnect behavior that deletes the encrypted token and stops sync.

**Acceptance:** one SimpleFIN connection imports balances and transactions safely, with a visible last-sync time and no credentials in logs or client responses.

### M3 — Transactions and categories

- Create Activity list with filters, merchant display, category chips, pending/posted state, and search.
- Build category assignment, split, exclusion, notes, and undo.
- Implement suggestion precedence: manual transaction assignment > exact merchant rule > normalized merchant history > default category > Unsorted.
- When a user chooses "Always categorize [merchant] as [category]," create a household rule.

**Acceptance:** common transactions arrive categorized, corrections are fast, and a merchant rule affects future imports without rewriting history.

### M4 — Fixed monthly budgets

- Build category and budget setup.
- Show budgeted, spent, pending, remaining, and pacing status.
- Let both users edit next month's amounts; log changes.
- Implement a simple, explicit rollover setting per category (default off).

**Acceptance:** budget numbers reconcile to included posted transactions and are easy to understand on a phone.

### M5 — Plan and Safe to SPND

- Detect candidate recurring transactions, but require user confirmation before a candidate affects forecast.
- Add manual future income and one-off planned expenses.
- Provide date-range cash forecast.
- Implement the explainable Safe to SPND calculation defined in the product brief.

**Acceptance:** user can see why the number changed and adjust its inputs without developer help.

### M6 — Polish and launch readiness

- Empty, loading, error, and disconnected states.
- Accessibility: keyboard support, contrast, semantic labels, touch targets.
- Database backup/export page and CSV export.
- Error monitoring, privacy review, and production deployment checklist.

## Phase Two

The next implementation phase is defined in [docs/09-phase-2-plan.md](09-phase-2-plan.md). Start with P2.1 compact mobile interface, then implement the real monthly Budget workspace, category icons and management, transaction detail/review, SimpleFIN health, document imports, and reconciliation QA. Do not begin document imports before the budget and transaction workflows are reliable.

## Recommended agent prompts

Start each milestone with:

```text
Read README.md and the relevant docs/ files first. Implement only Milestone [X].
Do not change product scope, add unrelated dependencies, or expose financial credentials.
Before editing, report the files you will change. After editing, run lint, typecheck, tests, and report the commands/results.
Use the established SPND dark-only design system and preserve mobile-first behavior.
```

## Definition of done for every change

- Typecheck, lint, and relevant tests pass.
- No secrets, access URLs, or raw financial payloads are written to logs.
- RLS is tested for both users and an unauthenticated request.
- Loading/error/empty states are included where the feature fetches data.
- Mobile viewport is checked at 390px width.
