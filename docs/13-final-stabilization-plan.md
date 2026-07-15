# SPND — Final Stabilization and Release Plan

> Purpose: complete the current product without opening another broad feature phase. Correct financial logic first, then finish the daily workflows and visual consistency.

This plan is based on a source-level audit of the current main branch after Phase Three. The authoritative accounting behavior is defined in [12-accounting-rules.md](12-accounting-rules.md).

## Current quality baseline

At the time of the audit:

- Production build passed.
- TypeScript passed.
- ESLint passed.
- 19 unit tests passed.
- The repository contained 42 Playwright mobile checks for 390px and 430px.
- The visual suite could not be executed in the audit environment because its browser binary was unavailable; this was an environment limitation, not a product-test result.

The implementation is visually mature, but several data and accounting behaviors must be corrected before Safe to SPND is trusted for real decisions.

## Release rule

Do not add new decorative features during this plan. Work in the order below. A milestone is complete only after its acceptance tests pass and the related calculations reconcile using realistic checking, credit-card, pending, refund, and transfer fixtures.

## S1 — Correct SimpleFIN Version 2 synchronization

### Problems found

- The account request does not include the pending=1 parameter. SimpleFIN excludes pending transactions by default.
- Pending transactions may have posted=0, but the importer currently uses posted as the date for every transaction.
- The importer requests Version 2 but reads the older account-level organization shape instead of top-level connections and conn_id.
- The initial four 90-day windows leave gaps between windows.
- Processed transaction count can count the same upserted transaction more than once across overlapping/provider windows.
- Recurring-candidate detection overwrites confirmed and dismissed decisions.

### Required work

1. Add pending=1 to transaction requests.
2. Model Version 2 response data:
   - connections;
   - account conn_id;
   - transaction transacted_at;
   - structured errlist.
3. Use transacted_at when supplied. Use posted only when it is a valid non-zero timestamp. A pending transaction without a valid date enters a sanitized review/error path; never create a 1970 transaction.
4. Map account institution/connection names through conn_id.
5. Generate contiguous request windows with end-date exclusivity handled explicitly.
6. Count unique inserted/updated transactions and report separate received, created, updated, and reconciled totals.
7. Preserve manual transaction fields and allocations across repeated sync.
8. Preserve recurring Confirmed, Dismissed, and Inactive states. Detection may update inference metadata without resetting a household decision.
9. Decide how partial account errors behave:
   - retain successfully returned accounts;
   - surface affected connection/account warnings;
   - do not report a fully healthy sync while data is incomplete.
10. Add a fixture-driven SimpleFIN test suite.

### Acceptance

- Pending fixture imports with a realistic date.
- posted=0 never becomes 1970.
- Version 2 institution names display correctly.
- Four history windows have no missing seconds/days.
- Re-running the same sync creates no duplicate transactions.
- A confirmed recurring item remains confirmed.
- A dismissed recurring item remains dismissed.
- Pending-to-posted replacement preserves category, note, review state, recurring state, and merchant display name.
- Connection health reports accurate unique counts and sanitized partial errors.

## S2 — Rebuild Safe to SPND around verified account roles

Follow [12-accounting-rules.md](12-accounting-rules.md).

### Schema/data changes

Add or confirm:

- explicit account role;
- credit-card pay-in-full setting;
- normalized liability balance or balance-sign setting;
- verified balance-basis state;
- credit-card due date when it cannot be reliably inferred;
- category behavior type;
- expected income sources/dates;
- Plan item state and matched transaction;
- household-editable minimum cash buffer.

Use migrations, backfills, and safe defaults. Existing accounts/categories that cannot be classified confidently must display Needs review rather than silently affecting the calculation.

### Calculation changes

Replace the global pending subtraction with component-level treatment:

- cash balance basis;
- paid-in-full card reserve;
- obligations;
- goals;
- variable spending reserve;
- minimum buffer.

Return a structured calculation result containing each component and the records behind it. The UI must not reverse-engineer explanations from one total.

### Credit-card reconciliation

- Normalize amount owed.
- Reserve the complete unpaid liability for paid-in-full cards.
- Include unmatched pending card purchases only when they are not already reflected in the chosen liability balance.
- Pair the checking and card legs of a payment as one excluded transfer.
- Alert on unexplained liability changes.

### Acceptance

Create table-driven tests for:

1. checking only;
2. checking plus pending debit-card purchase;
3. checking plus one paid-in-full card;
4. card with posted and pending purchases;
5. card payment transfer;
6. refund;
7. reimbursement;
8. obligation and spending category without double reserve;
9. goal contribution transfer;
10. negative raw result;
11. missing next income;
12. stale/ambiguous account balance.

For every fixture, verify every component and the final number.

## S3 — Expected income and a usable monthly Budget

### Expected income

Add a household-managed income schedule. Support recurring and one-time income. Both household members can edit it.

Budget displays:

- Expected income
- Received
- Remaining expected
- Assigned
- Left to assign
- Spent
- Pending

Replace the current Available metric based on posted positive transactions. Refunds, transfers, and reimbursements do not automatically become income.

### Month setup

Add:

- Copy previous month.
- Save as default monthly template.
- Apply template to an empty month.
- Confirmation showing categories and total assigned.
- Edit exceptions after copying.
- Warning when assigned exceeds expected income.

Do not implement automatic budget rollover. Category balances remain monthly.

### Category behavior

Backfill category types using the approved defaults, then provide a secondary category setting to change behavior.

Budget category rows remain compact, but their labels depend on type:

- Spending: spent, pending, remaining.
- Obligation: due, paid/matched, remaining.
- Goal: target contribution, contributed, remaining.
- Income: expected/received and hidden from spending list.
- Excluded: hidden from normal Budget.

### Activate existing orphaned functionality

- Add Category UI using the existing category endpoint.
- Add Move Money UI using the existing transactional database function.
- Move Money opens from an over-budget alert and category detail.
- Add category and move-money audit events to the visible history where helpful.

### Acceptance

- A new month can be prepared from the previous month in under 30 seconds.
- Expected income, not posted deposits, determines Left to assign.
- A refund does not inflate expected income.
- Assigning more than expected income gives a clear warning.
- Add Category and Move Money are usable without calling an API manually.
- Savings and debt goals reconcile without categorizing transfers as ordinary spending.

## S4 — Finish the daily workflows

### Activity

Replace the fixed latest-100 client dataset with server-side:

- cursor pagination;
- search;
- filter;
- category/account/date selection;
- month policy consistent with Budget.

Keep day grouping and swipe actions. Show Load more or automatic paging with a clear end state.

Fix copy and interaction details:

- correct singular/plural transaction labels;
- choosing a category from Needs review offers Categorize and review;
- Home recent transactions open transaction detail;
- category-sheet transaction taps open transaction detail without forcing navigation;
- updates propagate to Home/Budget/Activity or trigger a deliberate refresh strategy.

### Shared category detail

Replace separate Home and Budget category-detail implementations with one shared component.

It must support contextual actions:

- inspect recent transactions;
- open transaction detail;
- view all;
- edit monthly amount;
- move money;
- open secondary category settings.

### Transaction detail and rules

- Hide or disable Undo when no undoable audit event exists.
- Avoid full-page reload after Undo.
- Warn before closing a dirty transaction form.
- Collapse low-frequency Automation and Budget treatment controls under an Advanced disclosure after the primary review flow is proven.
- Add Merchant Rules settings: list, rename/recategorize, disable, delete, and show affected normalized merchant.
- Make income/expense category pickers context-aware.
- Make transaction update plus allocation replacement atomic in the database.

### Plan

Add editing and lifecycle actions:

- edit;
- skip;
- complete/match;
- delete/cancel;
- activate/deactivate recurring item.

Separate recurring suggestions from confirmed items. Matching a transaction marks the plan item fulfilled and stops its reserve.

### Household settings

Add editing for:

- household name;
- timezone;
- minimum cash buffer;
- expected income;
- account role/balance interpretation.

Zack and Stephanie have equal editing permissions. Show actor names in relevant audit history.

### Acceptance

- Search can find a transaction older than the latest 100.
- Home recent transactions are interactive.
- Home and Budget use the same category sheet.
- Closing a dirty transaction asks for confirmation.
- An incorrect merchant rule can be disabled or deleted.
- A planned bill can be edited and matched.
- Both household members can complete every daily workflow.

## S5 — Hide imports and simplify investment handling

### Product decision

General imports are preserved but hidden until a real need is demonstrated.

### Required work

1. Add a server-controlled feature flag with default false, such as SPND_ENABLE_IMPORTS.
2. When false:
   - remove Import inbox links from Plan and Settings;
   - do not show upload controls;
   - keep existing applied/history data intact;
   - keep routes protected by authentication;
   - optionally return Not found from import pages/APIs unless explicitly enabled.
3. Do not delete migrations, tables, storage objects, parsing code, or audit history.
4. Mark the import feature experimental in internal documentation.
5. Remove language implying PDF bank statements are a supported everyday workflow.

### Investment fallback

Prefer SimpleFIN investment accounts as Net worth only.

If a connected investment is unavailable, add later only when requested:

- Manual account.
- Manual balance update.
- As-of date.
- Optional note.
- Balance history.

Do not build investment-document parsing now.

### Acceptance

- No import entry point is visible in the default production UI.
- Existing import data is retained.
- Direct import routes remain authenticated and disabled by default.
- Investment accounts never affect Budget or Safe to SPND.
- Net worth can include connected investment balances.

## S6 — Design consolidation, PWA, and release QA

### Design refinements

Do not redesign the established composition. Refine consistency:

- Use rounded-square category symbols.
- Reserve circles for status, account avatars, and progress rings.
- Expand the default category palette so unrelated categories do not share the same identity unnecessarily.
- Reserve lime for primary positive status and actions.
- Raise meaningful supporting text to at least 12px; use 11px only for short tertiary labels.
- Keep all interactive targets at least 44 by 44px.
- Preserve compact rows and current dark-only character.
- Add clear loading, stale, disconnected, and calculation-needs-review states.

### CSS/component cleanup

- Consolidate globals.css by tokens, primitives, navigation, rows, sheets, and screens.
- Remove stale Phase Two selectors and superseded duplicate rules.
- Create shared Button, Sheet, Toast, Metric strip, Category icon, and Row primitives where repetition is causing drift.
- Replace ad hoc inline styles and per-component messages with consistent patterns.
- Move the obsolete root screenshot into the reference folder or remove it if it conflicts with current terminology.
- Ensure Safe-to-SPND explanatory content is not hidden by a global CSS rule.

### App-like installation

Add:

- web-app manifest;
- SPND icons;
- Apple touch icon;
- standalone display metadata;
- safe-area handling;
- installation instructions in Settings.

An offline financial calculation is not required. When offline, show last-known values with an explicit stale indicator and do not pretend changes were saved.

### Automated quality gates

Add GitHub Actions for:

- npm ci;
- lint;
- typecheck;
- unit tests;
- production build;
- Playwright mobile smoke tests.

Add integration tests against a disposable Supabase environment for:

- RLS for Zack;
- RLS for Stephanie;
- unauthenticated denial;
- atomic transaction allocation edits;
- move money;
- recurring decision preservation;
- pending-to-posted reconciliation.

### Release checklist

- Reconcile every included account.
- Reconcile credit-card liability and a real payment.
- Reconcile Budget totals to transaction allocations.
- Verify pending affects Safe to SPND exactly once.
- Verify Expected income and Received income separately.
- Verify Plan matching.
- Verify SimpleFIN connection health after partial and full success.
- Test 390px, 430px, Safari iPhone, and desktop.
- Test keyboard, focus trapping, Escape, drag dismissal, reduced motion, and screen-reader labels.
- Test both household members.
- Capture redacted screenshots using [11-design-reference-images.md](11-design-reference-images.md).

## Deferred intentionally

These are not required for the final release:

- general PDF/document imports;
- investment-document parsing;
- native iOS application;
- complex rollover;
- bank transfers or payments initiated by SPND;
- AI financial advice;
- multi-household roles beyond Zack and Stephanie;
- historical forecasting beyond the explainable near-term Safe-to-SPND model.

## Recommended agent kickoff prompt

Read README.md and docs/02-agent-build-plan.md, docs/03-architecture.md, docs/04-simplefin-setup.md, docs/07-data-model.md, docs/10-phase-3-premium-mobile-product.md, docs/12-accounting-rules.md, and docs/13-final-stabilization-plan.md.

Implement only S1 — Correct SimpleFIN Version 2 synchronization.

Before editing:

1. Inspect current SimpleFIN types, request construction, sync windows, pending reconciliation, recurring detection, connection health, migrations, and tests.
2. Report exact files and migrations to change.
3. State fixture cases and acceptance criteria.
4. Do not change Safe-to-SPND formulas during S1 except where required to preserve accurate imported pending/account data.

Rules:

- Use the current official SimpleFIN Version 2 response shape.
- Request pending transactions explicitly.
- Never create a transaction from posted=0 without a valid transacted_at.
- Preserve every manual transaction override.
- Preserve recurring Confirmed, Dismissed, and Inactive decisions.
- Keep access URLs and credentials server-only and sanitized from logs/errors.
- Make repeated sync idempotent.
- Keep all money values in integer cents.

After editing:

1. Run lint, typecheck, unit tests, production build, and SimpleFIN fixture tests.
2. Report exact commands/results.
3. Report any provider ambiguity that still requires account-level review.
4. Do not begin S2 automatically.
