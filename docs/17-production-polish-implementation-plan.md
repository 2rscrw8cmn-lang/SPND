# SPND — Production Polish Implementation Plan

> Execution order for [14-production-polish-product-spec.md](14-production-polish-product-spec.md), [15-transaction-review-and-rules.md](15-transaction-review-and-rules.md), and [16-responsive-visual-system.md](16-responsive-visual-system.md).

## Release rule

This is a refinement and correctness pass, not an open-ended feature phase. Do not begin visual polish until the transaction/review contracts are protected by tests. Do not replace accounting formulas defined in [12-accounting-rules.md](12-accounting-rules.md).

## P0 — Baseline and protect

1. Run unit tests, lint, typecheck, build, and current mobile tests.
2. Capture current 390px and desktop screenshots for Home, Budget, Activity, Plan, category detail, and transaction detail.
3. Inventory duplicate transaction/category components and CSS override layers.
4. Add feature flags for the new Activity modes and Income view if incremental deployment is required.
5. Confirm migrations through `202607150002` are deployed before adding forward-only migrations.

Exit criteria:

- baseline results are recorded;
- no uncommitted household-specific credentials or data exist in fixtures;
- accounting calculations have unchanged passing tests.

## P1 — Transaction correctness and remembered rules

1. Implement the state contract in [15-transaction-review-and-rules.md](15-transaction-review-and-rules.md).
2. Add a server-side remembered-rule service used by both transaction PATCH and SimpleFIN sync.
3. Apply rules to pending and posted transactions before Review results are returned.
4. Retroactively update eligible existing unreviewed matches when a rule changes.
5. Preserve manual/split allocations and reviewed history.
6. Return updated transaction records and aggregate deltas from mutations.
7. Remove correctness dependencies on page reloads.
8. Add concurrency protection for two-member edits.

Required tests are the twelve cases listed in the transaction contract plus provider reconciliation fixtures.

Exit criteria:

- automatic category assignment never implies reviewed;
- remembered rules work on pending, posted, and eligible existing unreviewed transactions;
- pending-to-posted retains household decisions;
- transaction APIs are atomic and audited.

## P2 — Shared transaction system

1. Extract one `TransactionRow` used everywhere.
2. Extract day grouping and group headers.
3. Standardize swipe directions and thresholds.
4. Add accessible overflow equivalents.
5. Add one optimistic mutation/Undo mechanism.
6. Build shared transaction inspector content.
7. Render it in a full-screen phone wrapper and desktop right inspector.
8. Add dirty-state close protection and conditional Save/Undo controls.

Exit criteria:

- Activity and category detail use the same row component;
- moving from a category updates the row and aggregates without navigation;
- split Move opens detail;
- keyboard and screen-reader equivalents exist.

## P3 — Activity becomes Review plus All activity

1. Replace Needs review filter with `Review {count} | All activity` mode switcher.
2. Default to Review while reviewable items exist.
3. Retain search/filters only in All activity.
4. Add server-side pagination, search, and filters.
5. Implement review-one, categorize-and-review, day-group review, and undo.
6. Prevent unsafe bulk review of Uncategorized, split-error, duplicate, or suspicious-transfer items.
7. Add review badge to Activity navigation.
8. Add all-caught-up state.

Exit criteria:

- a normal ten-item queue can be cleared without leaving Activity;
- a reviewed transaction leaves Review immediately;
- All activity still exposes it in the correct day group;
- filter and scroll state survive opening detail.

## P4 — Shared category detail

1. Replace Home and Budget category-detail variants with one component.
2. Use shared day-grouped transaction rows.
3. Add swipe Move/Review and menu fallbacks.
4. Make Move money and Edit monthly budget contextual actions.
5. Keep category settings collapsed and secondary.
6. Use `$X over`, `$X available`, or `Not budgeted`; do not show a positive red number labeled Remaining.
7. Phone uses full-screen detail; desktop uses right inspector.

Exit criteria:

- category transaction behavior matches Activity;
- a moved transaction disappears from the old category and Undo restores it;
- updated totals reconcile exactly;
- settings never precede spending context.

## P5 — Expected and received Income

1. Complete expected-income schedule schema and recurrence expansion required by the stabilization plan.
2. Add occurrence/match state so a posted deposit can fulfill an expected item without double counting.
3. Build monthly Income view with Expected, Received, Remaining, Upcoming, and Unmatched deposits.
4. Link Budget’s Expected income metric to the view.
5. Link Plan’s income events to the same view/editor.
6. Show next-income amount/date on Home and Safe-to-SPND explanation.
7. Add matching suggestions with explicit confirmation for ambiguous deposits.

Exit criteria:

- monthly expected and received values reconcile from explainable records;
- refunds/transfers do not become income automatically;
- matched expected and actual records count once;
- both household members can edit schedules and matches.

## P6 — Visual identity and responsive architecture

1. Create category icon/palette registry and migration-safe fallbacks.
2. Replace identical outline circles with curated filled/duotone rounded-square tiles.
3. Add semantic gradients according to [16-responsive-visual-system.md](16-responsive-visual-system.md).
4. Flatten transaction and category lists.
5. Implement phone, tablet, and desktop layout modes.
6. Consolidate active CSS and remove stale override layers.
7. Standardize typography, touch targets, focus states, alerts, and toasts.
8. Add safe-area and software-keyboard handling.
9. Add installable PWA metadata after the responsive shell is stable.

Exit criteria:

- visual acceptance criteria in the responsive guide pass;
- no 9–10px essential labels remain;
- no required touch target is below 44px;
- phone detail is not a 96dvh pseudo-sheet;
- desktop supports useful master-detail layouts.

## P7 — Regression, reconciliation, and release

Run:

- unit tests;
- integration tests against a disposable Supabase project;
- lint;
- typecheck;
- production build;
- Playwright at every required viewport;
- keyboard-only and reduced-motion checks;
- real-device Safari and Chrome smoke tests;
- two-household-member concurrency test;
- SimpleFIN sync/reconciliation fixtures;
- expected-income reconciliation fixtures.

Manual release scenarios:

1. new pending remembered-rule match enters Review categorized;
2. it posts without duplication or lost review state;
3. a category transaction moves and Undo restores it;
4. ten transactions can be reviewed quickly;
5. expected paycheck matches a deposit exactly once;
6. Budget, Income, Plan, and Safe to SPND show reconciling values;
7. stale or partial SimpleFIN data produces a visible warning;
8. phone browser Back and keyboard never strand the user.

## Definition of done

- All acceptance criteria in docs 14–17 pass.
- Accounting and Safe-to-SPND tests remain authoritative and green.
- No hidden feature is exposed accidentally, including imports.
- All mutations are household-scoped, audited, and safe under concurrent edits.
- New reference mocks are linked from [11-design-reference-images.md](11-design-reference-images.md).
- README documentation index is current.

