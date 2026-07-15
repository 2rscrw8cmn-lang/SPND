# SPND — Transaction, Review, and Remembered-Rule Contract

> Purpose: define the binding transaction behavior for import, reconciliation, categorization, review, moving, and display. This document supplements [12-accounting-rules.md](12-accounting-rules.md).

## Independent state axes

A transaction has independent states. Do not infer one from another.

| Axis | Example values | Meaning |
| --- | --- | --- |
| Provider status | Pending, Posted | Bank lifecycle |
| Review status | Needs review, Reviewed | Household verification |
| Categorization source | Manual, Merchant rule, History, Provider, Unsorted | Why a category was assigned |
| Budget treatment | Included, Excluded, Transfer | Accounting behavior |
| Allocation shape | Single, Split | Whether one or multiple categories own the amount |
| Income matching | Unmatched, Suggested, Matched | Relationship to expected income |

A pending transaction may be categorized, remembered, and reviewed. A posted transaction may still need review. An automatically categorized transaction remains unreviewed unless the user explicitly enables a future auto-review feature; auto-review is not part of this pass.

## Canonical review state

Use `review_status`, `reviewed_at`, and `reviewed_by` as the canonical state. `reviewed_at` and `reviewed_by` are null while review is required.

Transitions:

- Needs review → Reviewed: explicit review action, or a defined auto-review case such as exclusion/confirmed transfer.
- Reviewed → Needs review: explicit undo, or a material provider change that invalidates what was reviewed.
- Pending → Posted: preserve review state unless merchant or amount changes materially outside the reconciliation tolerance.

Record every transition in the audit log.

## Review inbox membership

A transaction belongs in Review when all are true:

- `review_status = needs_review`;
- it is not a superseded pending record;
- it is not excluded;
- it is not a confirmed transfer that the household has accepted;
- it is not a deleted/duplicate record.

Pending transactions are eligible. Categorized transactions are eligible. Remembered-rule matches are eligible.

## Remembered merchant rules

### Rule creation

`Remember this category` creates or updates a household rule using normalized merchant identity. The confirmation reports the number of matching unreviewed transactions that will be updated.

### Rule application

Rules run:

1. during every SimpleFIN import/upsert;
2. for both pending and posted transactions;
3. before the transaction is returned to Review;
4. when a new or changed rule is saved, against matching existing unreviewed transactions.

Rule application updates the allocation and its source. It does not mark the transaction reviewed.

### Retroactive scope

When a rule is saved, update matching transactions only when:

- they still need review;
- they are not manually split;
- their current allocation source is `merchant_rule`, `merchant_history`, `provider`, `default`, or `unsorted`;
- they are not excluded or confirmed transfers.

Do not rewrite reviewed history or manual allocations. Offer a separate explicit `Apply to reviewed history` action only if a future product requirement demands it.

### Precedence

Highest priority wins:

1. manual split or manual categorization;
2. active household merchant rule;
3. reliable merchant history suggestion;
4. provider category mapping;
5. Unsorted.

Manual work must survive later syncs.

### UI disclosure

Display a restrained source indicator when helpful:

- `Remembered` for merchant-rule allocation;
- `Suggested` for history/provider suggestion;
- no badge for confirmed manual categorization;
- `Uncategorized` when no useful allocation exists.

Do not turn source labels into large status pills on every row.

## Pending-to-posted reconciliation

When a posted transaction replaces pending:

Preserve:

- display name;
- note;
- allocations and their source;
- review status and reviewer;
- transfer/exclusion state;
- recurring state;
- expected-income match;
- user tags and audit relationship.

If the amount changes, reconcile a single allocation to the posted total. For a split transaction, require explicit review if the difference cannot be distributed without changing household intent.

If the merchant identity changes enough to select a different remembered rule, preserve manual work. For an untouched unreviewed suggestion, re-evaluate the rule and indicate the change.

The superseded pending row must disappear from normal Activity and category totals.

## Shared transaction row

Use one component and one row contract everywhere.

Required content:

- merchant display name;
- category and relevant state;
- signed amount;
- pending/reviewed indicator;
- stable merchant/category visual marker;
- accessible overflow action.

Context options may hide a redundant date or add an income-match status. They must not change the core typography or gesture direction.

## Swipe contract

| Gesture | Action | Notes |
| --- | --- | --- |
| Swipe right | Review | Disabled or becomes Undo review when already reviewed |
| Swipe left | Move/category | Opens compact category picker |
| Tap | Detail | Full-screen on phone, inspector on desktop |
| Overflow | All available actions | Required fallback for touch, keyboard, and desktop |

Use horizontal-axis locking so vertical scrolling is not captured. Commit only after distance/velocity thresholds. Animate back when cancelled.

After a successful move:

- update all visible aggregates optimistically;
- remove the row from the old category context;
- insert/update it in the destination when visible;
- show `Moved to {category} · Undo`;
- roll back on API failure.

For split transactions, swipe Move opens detail rather than reassigning silently.

## Review actions

Support:

- review one;
- review a day group;
- categorize and review;
- undo immediately;
- undo review from detail/menu.

Bulk review must not review Uncategorized items without an explicit confirmation. If a day contains unresolved splits, duplicate candidates, or suspicious transfers, report and skip them.

## Required API behavior

Transaction updates must be atomic for:

- allocation replacement;
- review transition;
- merchant-rule creation/update;
- retroactive unreviewed matches;
- audit events.

Return the updated transaction and affected aggregate deltas. Avoid requiring `window.location.reload()` for correctness.

Use optimistic concurrency or `updated_at` conflict checks so two household members do not silently overwrite each other.

## Minimum schema additions or confirmation

Confirm or add:

- review state fields and indexes;
- allocation source values for provider suggestions if used;
- rule application timestamps/version where useful for diagnostics;
- expected-income match identifier on the transaction or match table;
- audit metadata for rule-created, rule-applied, reviewed, moved, and undone events.

## Test matrix

Automate at minimum:

1. remembered rule categorizes a new pending transaction but leaves it unreviewed;
2. remembered rule categorizes a new posted transaction but leaves it unreviewed;
3. creating a rule updates eligible existing unreviewed matches;
4. rule creation does not rewrite reviewed history;
5. rule creation does not overwrite a manual split;
6. pending-to-posted preserves remembered allocation and review state;
7. pending amount change reopens review when required;
8. moving from category detail updates both category totals;
9. undo restores the transaction and totals;
10. duplicate/superseded pending rows do not enter Review;
11. excluded and confirmed-transfer transactions do not enter Review;
12. two-member update conflicts are surfaced rather than lost.

