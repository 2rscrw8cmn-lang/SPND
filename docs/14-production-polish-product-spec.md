# SPND — Production Polish Product Specification

> Status: approved direction for the final product-polish pass. This document refines the interface and daily workflows without changing the accounting rules in [12-accounting-rules.md](12-accounting-rules.md).

## Outcome

SPND should feel intentionally designed for both a phone and the web. The phone experience is not a narrowed desktop dashboard: it is a focused sequence of review, budgeting, and cash-flow decisions. Desktop uses the same data and actions with persistent navigation and contextual side panels.

This pass succeeds when Zack and Stephanie can:

1. open SPND and understand what is safe to spend;
2. clear the review inbox quickly;
3. inspect and move a transaction from any place it appears;
4. understand expected and received income;
5. recognize categories by icon and color before reading their names; and
6. move between phone and desktop without learning two products.

## Product principles

### One object, one interaction model

A transaction has the same visual structure and behavior on Home, Activity, Income, and category detail. Context may add a label or action, but it must not create a second transaction component.

### Review is a workflow

Needs review is not a peer filter beside Pending, Income, or Account. It is the household inbox and the default Activity mode while reviewable transactions exist.

### Categorized does not mean reviewed

A remembered rule can assign a category automatically while the transaction remains in the review inbox. Review confirms that the complete transaction is correct.

### Income is planned and reconciled

Expected income is a household plan input. Received income is a posted transaction matched to that expectation. Both must be visible, and they must never be double-counted.

### Density serves comprehension

Phone layouts should show useful content above the fold without tiny type or cramped controls. Reduce containers and decoration before reducing touch targets or readability.

## Primary navigation

Keep four bottom destinations on phone:

1. Home
2. Budget
3. Activity
4. Plan

Do not add a fifth Income tab. Income is accessible from the Budget summary and the Plan timeline. Activity shows a review-count badge when needed.

On desktop, use persistent left navigation. Detail workflows open in a right inspector when space permits.

## Screen contracts

### Home

Home answers, in order:

1. What is Safe to SPND?
2. When and how much is the next expected income?
3. Is anything awaiting review or attention?
4. Which budgets need attention?

Required composition:

- compact app header and greeting;
- one Safe to SPND hero with a restrained lime atmospheric gradient;
- next-income fact and confidence/freshness state;
- one review-inbox row such as `7 transactions to review`;
- Budget pulse with three to five urgency-sorted categories;
- no generic recent-activity block unless it has a concrete action.

Every transaction preview and category row is interactive.

### Budget

Budget is the monthly planning workspace.

Required composition:

- compact month rail;
- one summary surface;
- tappable metrics: Expected income, Assigned, Spent, Available;
- compact inline warnings;
- flat category groups and rows, not cards nested in cards;
- secondary access to excluded categories;
- Edit budget in the header, not a floating action button.

Tapping Expected income opens the monthly Income view. Tapping a category opens shared category detail.

### Activity

Activity has two primary modes:

    Review 7 | All activity

#### Review mode

- default while at least one reviewable transaction exists;
- grouped by day;
- swipe right to review;
- swipe left to move/change category;
- selecting a suggested category can review in the same flow;
- after the last item, show an all-caught-up state and a route to All activity.

#### All activity

- server-side search and pagination;
- filters for account, category, status, income, excluded, date, and amount;
- active filters appear as removable chips;
- Needs review is not included in the filter sheet;
- grouped by day with the same transaction rows as Review.

### Transaction detail

Phone uses a full-screen view with browser-back behavior. Desktop uses a right inspector. A small category picker may remain a bottom sheet.

Above the fold:

1. merchant, amount, date/status, and account;
2. selected or suggested category;
3. review action;
4. remembered-rule indication when applicable.

Below a More options disclosure:

- note;
- split;
- remember category;
- recurring state;
- transfer/exclusion treatment;
- merchant display name;
- audit history.

Show Save only while the form is dirty. Warn before discarding edits. Show Undo only when an undoable event exists.

### Category detail

Category detail leads with spending context rather than settings.

Required order:

1. icon, name, and semantic status such as `$75.99 over`;
2. compact Budget, Spent, Pending, and Available facts;
3. day-grouped transactions using the shared Activity row;
4. Move money and Edit monthly budget actions;
5. collapsed Category settings.

Transactions support the same tap, swipe, menu, and undo behavior as Activity. A transaction moved out of the current category disappears optimistically and can be restored from the toast.

For a split transaction, quick Move opens transaction detail so the household can choose which allocation moves.

### Income

Income is a dedicated view reached from Budget or Plan.

Monthly summary:

- Expected;
- Received;
- Remaining expected;
- variance when received differs from expectation.

Sections:

- Received: matched posted income transactions;
- Upcoming: active expected-income occurrences;
- Unmatched deposits: positive transactions that may be income but are not linked;
- past months through the standard month selector.

Expected-income actions:

- add recurring or one-time income;
- edit date, amount, acceptable variance, and active state;
- match or unmatch a deposit;
- mark a skipped occurrence without deleting the schedule.

### Plan

Plan remains the forward cash-flow timeline. Expected income and obligations are interleaved by date. Add/edit opens a focused phone view or desktop inspector instead of expanding a large form inside the timeline.

### Settings

Phone Settings is an index leading to focused screens. Import remains feature-flagged and hidden. Category visual identity, account behavior, expected-income defaults, SimpleFIN health, and security do not share one long settings page.

## Quality-of-life requirements

- Preserve selected month, filters, scroll position, and review position when closing detail.
- Use URL-addressable detail state so refresh and browser Back behave predictably.
- Use optimistic updates with rollback and a consistent Undo toast.
- Keep the bottom navigation above the device safe area.
- Keep primary actions visible above the software keyboard.
- Provide skeleton states that preserve layout dimensions.
- Show sync freshness quietly; elevate it only when stale, partial, or failed.
- Provide recent and frequently used categories before the full category list.
- Include visible menus for all swipe actions for accessibility and desktop use.
- Never rely on color alone to communicate reviewed, pending, over-budget, or income state.

## Explicit non-goals

- No general document-import workflow.
- No automatic budget rollover.
- No fifth phone navigation destination.
- No social, gamification, or financial-advice features.
- No decorative gradient on every surface.
- No separate transaction implementation for category detail.

## Product acceptance

- A user can review and categorize ten ordinary transactions without leaving Activity.
- A user can move a category transaction and undo it without navigating away.
- A remembered rule categorizes future pending and posted matches while leaving them in Review.
- Expected and received income reconcile without double counting.
- At 390px, each primary screen exposes its first useful action without excessive scrolling.
- The same transaction has the same hierarchy and actions in Activity and category detail.
- Desktop detail panels and phone full-screen views invoke the same domain actions and validation.

