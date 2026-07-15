# SPND — Phase Three: Premium Mobile Product Pass

> Outcome: Make SPND feel like a polished, daily-use consumer finance app—not a prototype—while closing the remaining interaction and reliability gaps.

This is the final planned product phase. It is deliberately specific so an implementation agent can ship it in small, testable passes without inventing product decisions.

Read this document together with:

- [Product brief](01-product-brief.md)
- [Design guide](05-design-guide.md)
- [Data model](07-data-model.md)
- [Phase Two plan](09-phase-2-plan.md)
- [Design reference image guide](11-design-reference-images.md)

## Product decision: what SPND leads with

SPND is a shared household cash-flow app that uses categories to make the answer trustworthy. It is not primarily a category tracker.

The first question every screen should help answer is:

> What can we safely SPND right now?

### Canonical Home summary

Use one dominant Home hero, in this order:

1. Available to SPND — available money after committed obligations and reserves.
2. Safe to spend today — Available to SPND divided by days until next income, rounded down to whole dollars.
3. Until next income — human-readable day count and date.
4. A restrained lime progress arc or ring showing monthly cash-flow/budget progress.
5. One plain-language state: on track, attention needed, or disconnected.

Do not put a competing Budget Health card above the category list. If action is needed, show a compact inline alert below the hero:

    ⚠ Groceries is $74 over budget                         Move money ›

### Number definitions

- Income: included posted income within the selected monthly budget period.
- Assigned: monthly amounts assigned to active, included budget categories.
- Spent: included posted transaction allocations in the period.
- Pending: included pending transaction allocations. It is shown separately and conservatively subtracted from Safe to SPND.
- Available: money safe to allocate/spend after documented cash-flow reserves.
- Safe to spend today: available amount divided by days through the next confirmed income date.

The hero must never be hard-coded. Every displayed metric needs a clear calculation and an explain-this path.

## Design system: the SPND signature

### Visual character

- Dark-only forever: black/near-black background with subtly lifted charcoal surfaces.
- Lime is earned: use it for positive availability, the primary CTA, and success states; not as decorative default.
- Category colors are stable: each category has one curated accent that does not change month to month.
- Dense, touchable, calm: reduce vertical stacks and empty card padding without reducing tap targets.
- Depth, not noise: a very soft green/olive glow may sit behind the primary hero. Use blur only for sticky navigation or overlays.
- No generic generated look: category icons are filled or high-weight symbols on colored rounded-square backgrounds, not identical outline circles.

Target aesthetic: Apple Wallet clarity plus Copilot finance interactions plus Linear density.

### Typography and spacing

At a 390px viewport:

| Element | Target |
| --- | --- |
| App/section heading | 20–24px |
| Hero amount | 42–52px |
| Category name | 15–16px |
| Supporting copy | 12–13px |
| Category row height | 64–76px |
| Transaction row height | 56–68px |
| Main page inset | 16px |
| Card radius | 16–20px |
| Minimum touch target | 44 × 44px |

Avoid tall stacked cards, oversized page titles, duplicate metric cards, and floating action buttons on Budget. A user should see four to five category rows above the fold on a current iPhone.

### Categories

Use these fixed default visual identities unless the household changes a category:

| Category | Icon concept | Accent |
| --- | --- | --- |
| Housing | house | violet |
| Utilities | bolt | yellow |
| Groceries | cart | cyan |
| Dining | fork/knife | orange |
| Transportation | car | green |
| Insurance | shield | blue |
| Health | heart/cross | red |
| Family & Kids | people | pink |
| Shopping | bag | purple |
| Entertainment | ticket/film | magenta |
| Travel | plane | sky |
| Savings | piggy bank | teal |
| Debt | credit card | amber |
| Business | briefcase | slate |

Store an icon name and accent token in category metadata. Use a safe registry/fallback. Do not depend on emoji.

## P3.1 — Home: cash-flow first

Recompose Home instead of merely shrinking it.

Required order:

1. compact app header and greeting;
2. Available to SPND hero;
3. conditional one-line attention/disconnected banner;
4. Budget pulse: four to five highest-priority categories, ordered by urgency;
5. a compact review preview when transactions need attention;
6. a single unobtrusive entry point to Activity or Plan.

Budget pulse rows must be tappable and open the category detail sheet. They must not be display-only components.

Each category row shows:

- icon and category name;
- transaction count in the selected period, or No transactions;
- spent / budget amount;
- a semantic progress bar;
- a short right-side state such as $118 left or $74 over;
- disclosure affordance.

Progress semantics:

- neutral gray: not funded / no budget;
- lime/green: comfortably under budget;
- amber: approaching budget;
- red: over budget;
- muted: excluded or archived.

Do not include a floating plus button on Home or Budget. Put Add transaction in Activity and Edit budget in the Budget header.

**Acceptance**

- Tapping every Home budget-pulse row opens its category detail.
- The hero has one unmistakable primary number.
- At 390px, hero + alert (if any) + three category rows fit without feeling oversized.
- Empty states say Not budgeted — Add budget, or are hidden by the active filter; never show ambiguous $0 left.

## P3.2 — Budget: a monthly workspace, not a settings form

Budget is the planning screen. It uses a compact horizontal month rail:

    ‹   May   Jun   [Jul 2026]   Aug   Sep   ›

Requirements:

- Selected month is distinct, horizontal scroll is accessible, and previous/next update the same source of truth.
- Header has Edit budget; do not use a floating action button.
- One compact monthly summary visual: spent, available, and/or allocated—not a stack of competing cards.
- Use the inline alert pattern for an over-budget category.
- Show an information-dense metric strip: Income · Assigned · Spent · Available. Pending appears in context or a compact secondary label.
- Use the dense row contract above.
- Default sort: over budget, approaching, active/remaining, then empty; allow group filter or All.
- Excluded categories stay out of the primary list in a labeled secondary section.
- View all must not hide urgent categories.

### Category detail sheet

A category tap opens a sheet, not a route change. Its first job is understanding spending; settings are secondary.

Order:

1. category icon, name, and status ($74 over, $118 left, or Not budgeted);
2. progress visual and metrics: Budget, Spent, Pending, Remaining;
3. recent reviewed and unreconciled transactions, grouped by day;
4. View all transactions with category filter;
5. primary actions: Move money, Edit budget;
6. secondary actions: Recurring charges, Notes, Rename, Hide/archive, icon/color/group settings.

Do not lead with Category settings. Do not make the user navigate to Activity to see the transactions they tapped a category to inspect.

**Acceptance**

- Category settings no longer appear before transaction context.
- A category with transactions always shows them in the sheet.
- Changing a budget or moving money validates, updates optimistically with rollback, and creates an audit event.
- Motion, focus behavior, and Escape/backdrop controls work for the sheet.

## P3.3 — Activity: review queue built for speed

Activity must make transaction review quick and forgiving.

### Feed organization

- Group transaction rows by local transaction date: Today, Yesterday, weekday + date, then month/date for older items.
- Display one date heading per group, never a repeated date per row.
- Preserve account, pending, reviewed, split, transfer, and exclusion indicators in compact secondary UI.
- Keep filters sticky and obvious: Needs review, Pending, Income, Expenses, Excluded, Transfers, Category, Account, Date, Search.
- The selected filter controls the visible list, not just its styling.

### Review behavior

When a transaction is marked reviewed while Needs review is active:

1. persist review state;
2. remove it from filtered data immediately;
3. advance to the next visible transaction in the same order, or close the sheet if none remain;
4. update the visible review count and Home preview without refresh.

Never leave a reviewed item in Needs review because of stale local selected state.

### Gestures

Use Pointer Events rather than touch-only handlers, so gestures work on a phone and in desktop emulation. Keep every action discoverable through accessible buttons/overflow menus.

| Context | Gesture | Action |
| --- | --- | --- |
| Transaction row | Swipe right | Mark reviewed, with undo toast |
| Transaction row | Swipe left | Open quick category picker |
| Transaction row | Tap | Open detail sheet |
| Transaction sheet | Drag down from sheet handle | Dismiss when threshold/velocity is met |
| Category row | Swipe right | Show category transactions |
| Category row | Swipe left | Move money |
| Category row | Long press | Rename, hide, add transaction, goal, notes |

Gesture requirements:

- Do not fire a swipe during ordinary vertical scrolling.
- Use visible threshold, reduced-motion-safe animation, haptic feedback only when supported, and undo for review/destructive actions.
- Clicking action controls must not trigger the row click.
- The sheet has a drag handle, close button, backdrop dismissal, Escape support, focus management, and body-scroll lock.
- Every gesture has a keyboard/screen-reader equivalent.

**Acceptance**

- Activity is grouped by day.
- A review action instantly removes the row from Needs review and progresses cleanly.
- Category/transaction actions work without swiping.
- Dragging the detail sheet down closes it; scrolling its content never closes it accidentally.

## P3.4 — Transaction detail: correct once, then move on

The transaction detail sheet includes:

- merchant and editable display name;
- local date, amount, pending/posted state;
- account/card;
- category chip and quick category picker;
- raw imported description;
- note;
- split transaction;
- transfer, recurring, and exclude controls;
- always categorize this merchant rule;
- review state, undo, and audit context.

Interaction/data rules:

- Manual corrections take precedence over merchant rules and imported categories.
- Category changes update totals and Safe to SPND using pending/posted rules.
- Split allocations must equal the absolute transaction amount before save.
- A posted transaction matching a pending one replaces it without double counting.
- Pending affects Safe to SPND but not posted-spend budget totals.
- Changes survive refresh and are scoped by household RLS.

## P3.5 — Motion, loading, and resilience

Polish improves comprehension; it should not decorate every action.

- Use 160–220ms transitions for sheets, row state, and progress.
- Use a tiny budget pulse only when a category crosses a state boundary or money moves.
- Respect prefers-reduced-motion.
- Skeletons match compact layouts; no giant placeholder cards.
- Design empty, loading, error, and disconnected states for Home, Budget, Activity, category detail, imports, and SimpleFIN settings.
- Show offline/stale sync honestly without hiding last-known data.
- Never display raw SimpleFIN access URLs, setup tokens, API payloads, or service credentials.

## P3.6 — Imports: visible, reviewable budget inputs

Phase Two established the import inbox; finish its product behavior here.

Supported surfaces:

- bank/credit-card transaction CSV;
- budget template CSV/XLSX;
- income/paycheck document;
- recurring bill document;
- planned-expense list;
- manual one-off budget adjustment.

Requirements:

- Put uploads in Plan / Imports, not a global FAB.
- Every import has a state: Uploaded, Parsing, Needs review, Ready to apply, Applied, Rejected, Failed.
- Display original filename, type, uploaded date, accepted rows, duplicates, rows needing review, and errors.
- Require explicit Apply confirmation and show affected categories/transactions first.
- Preserve source-document and row-level provenance.
- PDFs may produce extracted candidates only; never silently modify budget values.
- Apply is idempotent and fully logged.

## P3.7 — Quality gates and release checklist

Do not call Phase Three complete until each item is demonstrated.

### Functional

- Home categories open detail.
- Category detail shows transactions before settings.
- Activity groups by date.
- Reviewed transactions leave Needs review immediately and counts reconcile.
- Swipe and button alternatives both work.
- Transaction sheet dismisses by drag, close control, backdrop, Escape, and browser back behavior as designed.
- No duplicate categories in Home, Budget, or selectors.
- Budget has meaningful summary, inline attention state, month rail, and dense list.
- SimpleFIN settings show successful/attempted sync, account/transaction counts, status, sanitized error, and retry/reconnect.
- Imports require review before data changes.

### Data and security

- All money stays integer cents.
- Category/dashboard totals reconcile to included transaction allocations.
- Pending subtraction occurs exactly once in Safe to SPND.
- Sync/imports are idempotent.
- User edits/audit events persist.
- RLS is verified with Zack, Stephanie, and unauthenticated sessions.
- Secrets never reach browser bundles, logs, errors, or screenshots.

### Interface QA

- Test iPhone-width 390px and 430px, plus desktop.
- Check Chrome/Safari mobile gesture behavior.
- Verify keyboard, screen-reader labels, focus restoration, contrast, and 44px targets.
- Test no data, many categories, 100+ transactions, disconnected SimpleFIN, failed sync, and failed import.
- Run lint, typecheck, unit tests, and a short end-to-end smoke path after each milestone.

## Implementation order

1. Fix interaction correctness: Home category taps, review removal/advance, day grouping, sheet dismissal.
2. Recompose Home and Budget information hierarchy.
3. Replace category sheet with transaction-first detail.
4. Add swipe/long-press interactions plus accessible alternatives.
5. Finalize category visual system, motion, and responsive density.
6. Finish import review UX and run reconciliation/security QA.

Do not begin a new feature before the prior acceptance tests pass.

## Codex implementation prompt

Read README.md and docs/01-product-brief.md, docs/05-design-guide.md, docs/07-data-model.md, docs/09-phase-2-plan.md, docs/10-phase-3-premium-mobile-product.md, and docs/11-design-reference-images.md before editing.

Implement only the requested Phase Three milestone. SPND is dark-only and mobile-first. It leads with Available to SPND / Safe to spend today; categories support that answer.

Before editing:
1. Identify existing components/routes/data paths.
2. Report exact files and migrations to change.
3. State acceptance criteria to verify.

Rules:
- Keep money in integer cents and preserve pending/posted semantics.
- Do not expose SimpleFIN credentials, access URLs, service keys, or raw provider payloads.
- Use accessible button alternatives for every gesture.
- Use Pointer Events for swipes and prevent accidental actions while scrolling.
- Keep category detail transaction-first; settings belong in a secondary section.
- Do not add oversized cards, light mode, Plaid, Teller, or a Budget FAB.
- Add/adjust migrations and RLS tests when data changes.
- Validate at 390px and 430px.

After editing:
1. Run lint, typecheck, tests, and relevant end-to-end smoke checks.
2. Report commands/results and any remaining limitation.
3. Include a concise manual QA checklist for the changed flow.
