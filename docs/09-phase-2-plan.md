# SPND — Phase Two Product and Build Plan

Phase Two turns the current prototype into a compact, usable budgeting application modeled after the strongest parts of the Copilot references.

Reference behaviors to preserve:

- Compact category rows with icons, colors, spent, budget, and remaining.
- A real monthly budget view.
- A reviewable transaction feed.
- A dedicated transaction detail experience.
- Clear connection health and sync feedback.

## Current problems to fix

1. The mobile UI is too large and requires too much scrolling.
2. Budget is a single edit form, not a complete monthly workspace.
3. Transaction rows are only partially interactive.
4. Category icons are mostly fallback icons because stored database icons are ignored.
5. Category taxonomy is too large and has no useful grouping or management.
6. The home budget ring and some summary values are hard-coded.
7. SimpleFIN can sync, but the UI does not show whether it is healthy.
8. There is no document-import review pipeline.

## Phase Two sequence

### P2.1 — Compact mobile interface

Reduce visual scale without reducing the importance of the Safe to SPND number.

- Page titles: approximately 24–28px on mobile.
- Header: approximately 68px.
- Budget rows: approximately 68–76px.
- Transaction rows: approximately 64–72px.
- Card padding: approximately 14–18px.
- Keep 52–64px typography only for the Safe to SPND value.
- Show more budget categories and transactions above the fold.
- Replace hard-coded home values with calculated values.
- Keep dark-only mode permanently.
- Preserve the 390px mobile viewport as the primary QA target.

Acceptance: Home, Budget, Activity, and Plan feel information-dense but remain easy to scan on an iPhone.

### P2.2 — Real monthly Budget workspace

Make /budget the main monthly planning tool.

Required UI:

- Month selector with previous/next month controls.
- Budgeted, posted spend, pending, and remaining totals.
- Budget health summary.
- Grouped category rows.
- Spent, budgeted, remaining, and progress for every active category.
- Tap a category to view its transactions.
- Edit the monthly amount inline or in a category sheet.
- Add, rename, archive, and restore categories.
- Category settings for icon, color, group, and monthly amount.
- Unsorted shown as a review queue, not a normal budget category.

Recommended groups:

**Essentials:** Housing, Utilities, Groceries, Transportation, Insurance, Health.

**Lifestyle:** Dining, Family & Kids, Shopping, Entertainment, Travel.

**Goals:** Savings, Debt.

**Excluded:** Business, Reimbursements, Transfers.

Add category metadata:

- category_group
- is_active
- is_excluded
- show_in_budget

Budget rollover remains off in Version 1. Do not add complex rollover logic during Phase Two.

Acceptance: Zack and Stephanie can manage the entire month from /budget without using a spreadsheet.

### P2.3 — Category icons and management

Use the icon stored in the database. Do not derive icons only from category names.

Create a complete Lucide icon registry with safe fallback handling:

- Housing: House
- Utilities: Zap
- Groceries: ShoppingCart
- Dining: Utensils
- Transportation: Car
- Insurance: ShieldCheck
- Health: HeartPulse
- Family & Kids: Users
- Shopping: ShoppingBag
- Entertainment: Clapperboard
- Travel: Plane
- Savings: PiggyBank
- Debt: CreditCard
- Business: Briefcase

Add an icon picker, color picker, category archive action, and category group selector.

Acceptance: every category displays a distinct intentional icon and color; invalid icon names never break rendering.

### P2.4 — Transaction detail and review workflow

Build a mobile transaction detail sheet or route.

Details and actions:

- Merchant
- Date
- Amount
- Pending/posted state
- Category
- Account/card
- Raw description
- Note
- Split transaction
- Mark transfer
- Mark recurring
- Exclude from budget
- Create merchant rule
- Mark reviewed
- Undo

Add review fields:

- reviewed_at
- reviewed_by
- review_status

Review filters:

- Needs review
- Pending
- Income
- Expenses
- Excluded
- Transfers
- Category
- Account
- Date
- Search

Important API behavior:

- Explicitly support clearing a category back to Unsorted.
- Validate split allocations equal the transaction total.
- Match a posted transaction to its pending transaction without double counting.
- Preserve imported source data and store user edits separately where possible.
- Create audit events for edits, rules, splits, exclusions, and review actions.

Acceptance: a transaction can be fully corrected from its detail view, and the correction affects future suggestions.

### P2.5 — SimpleFIN connection health

Add a visible connection-health card under Settings.

Display:

- Connection status: Active, Needs attention, Disconnected.
- Last successful sync.
- Last attempted sync.
- Number of accounts imported.
- Number of transactions imported.
- Last sync result.
- Sanitized provider error.
- Sync now action.
- Retry/reconnect action.
- Disconnect action.

The UI should read from the connection_health view, financial_connections, and sync_runs.

Fix these current limitations:

- Show status after initial claim.
- Allow retry when a connection is in error state.
- Make manual sync return account and transaction counts.
- Show the latest sync run and sanitized error.
- Keep the last-known data visible if the provider is temporarily unavailable.
- Do not show access URLs, Setup Tokens, or raw provider credentials.

Acceptance: a user can tell within five seconds whether SimpleFIN is connected and when it last worked.

### P2.6 — Document import foundation

Build an import inbox with review before applying changes.

Flow:

Upload document → identify type → parse → preview → resolve errors → approve → apply → retain history.

Initial supported types:

1. Bank transaction CSV.
2. Credit-card transaction CSV.
3. Budget template CSV/XLSX.
4. Income/paycheck document.
5. Recurring bill document.
6. Manual planned-expense list.

Create:

- imports
- source_documents
- import_rows
- import_errors

Every import should show:

- File name.
- Import type.
- Upload date.
- Accepted rows.
- Duplicate rows.
- Rows needing review.
- Apply and reject actions.
- Import history.

Do not automatically apply arbitrary PDF data to the budget. PDF extraction must produce a reviewable preview first.

Acceptance: a document can be uploaded, inspected, corrected, and applied without silently changing the budget.

### P2.7 — Reconciliation and QA

Before relying on SPND daily:

- Reconcile account balances to SimpleFIN.
- Reconcile transaction counts.
- Verify pending transactions are subtracted from Safe to SPND but excluded from posted spending.
- Verify posted transactions replace pending transactions.
- Verify excluded accounts do not affect Safe to SPND.
- Verify category totals equal transaction allocations.
- Verify no dashboard number is hard-coded.
- Test both household members and unauthenticated requests under RLS.
- Test empty, loading, error, and disconnected states.

## Recommended implementation order

1. Compact UI.
2. Category icon registry and category data model.
3. Real monthly Budget workspace.
4. Transaction detail and review workflow.
5. SimpleFIN health/status.
6. Document import inbox.
7. Reconciliation and production QA.

## Codex kickoff prompt

~~~
Read README.md, docs/02-agent-build-plan.md, docs/05-design-guide.md, docs/07-data-model.md, and docs/09-phase-2-plan.md before editing.

Implement Phase Two in milestones. Start with P2.1 only unless explicitly instructed otherwise.

Current problems to solve:
- The mobile layout is too large.
- Budget is not a real monthly workspace.
- Transactions need a full detail/edit experience.
- Categories need fewer groups, real icons, and editable settings.
- SimpleFIN needs visible health and sync status.
- Documents need an upload/preview/review/apply pipeline.

Rules:
- Preserve dark-only SPND.
- Use SimpleFIN Bridge; do not add Plaid or Teller.
- Keep all money values in integer cents.
- Never expose Setup Tokens, access URLs, service-role keys, or raw provider credentials.
- Preserve imported transaction data and make sync/import idempotent.
- Add migrations for schema changes.
- Before editing, report the files you will change.
- After editing, run lint, typecheck, tests, and report results.
- Validate at 390px mobile width.
~~~
