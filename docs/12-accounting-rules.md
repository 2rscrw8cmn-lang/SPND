# SPND — Authoritative Accounting Rules

> Status: approved product decision. These rules supersede conflicting assumptions in earlier planning documents.

SPND is a cash-flow budgeting application for one shared household. It should answer what Zack and Stephanie can safely spend while still paying every expected obligation and paying credit cards in full.

## Confirmed household decisions

1. Credit cards are paid in full each month.
2. Monthly Budget uses expected income, entered and maintained by the household.
3. Zack and Stephanie have the same full editing permissions.
4. SimpleFIN is the source for bank, credit-card, and investment account transactions and balances whenever supported.
5. General document imports are hidden for now. Existing import code is retained behind a disabled feature flag.
6. If an investment account cannot be connected, the future fallback is a manual account/balance snapshot—not a general document-import workflow.

## Account roles

Every account needs an explicit role. Account role controls calculations; institution/account names never determine behavior.

| Role | Included in Safe to SPND | Included in net worth | Treatment |
| --- | --- | --- | --- |
| Cash | Yes | Yes | Checking, savings used for household cash, and other spendable deposit accounts |
| Credit card paid in full | As a liability reserve | Yes | Reserve the full normalized amount owed before presenting spendable cash |
| Investment | No | Yes | Balance affects net worth only |
| Other liability | Through confirmed payment obligations | Yes | Mortgage, auto, student, or other debt |
| Excluded | No | No | Duplicate, closed, business, or irrelevant accounts |

Account Settings must show the account role, current balance, available balance when supplied, last balance timestamp, and how the account affects Safe to SPND. A credit-card account must show a normalized positive Amount owed regardless of the provider’s balance sign.

## Expected income

Expected income is a plan input, not inferred only from deposits already received.

Create expected income sources with:

- name;
- expected amount in integer cents;
- cadence or explicit dates;
- next expected date;
- active/inactive state;
- optional acceptable variance;
- source type: recurring income or one-time income.

Monthly Budget uses expected income scheduled within that month.

Display these separately:

- Expected income
- Income received
- Expected income remaining
- Assigned
- Left to assign

The primary Budget formula is:

    left_to_assign = expected_income_for_month - total_assigned_budget

Posted positive transactions do not automatically become expected income. Refunds, reimbursements, transfers, and sales must not inflate expected monthly income.

When a deposit arrives, SPND may suggest matching it to an expected income item. The household confirms ambiguous matches.

## Category behavior types

Category groups remain presentation and organization. Accounting behavior comes from an explicit category type.

| Category type | Examples | Budget behavior |
| --- | --- | --- |
| Spending | Groceries, Dining, Shopping, Entertainment | Posted purchases count as spent; pending purchases reserve money |
| Obligation | Housing, Utilities, Insurance, childcare | The confirmed amount/date is reserved as a bill; do not also reserve the same dollars through discretionary pacing |
| Goal | Emergency savings, travel savings, extra loan principal | A planned contribution reserves cash; an account transfer can fulfill it without becoming ordinary spending |
| Income | Paycheck, bonus | Used to classify/match income; does not appear in spending budgets |
| Excluded | Transfers, reimbursements, business | Does not affect spending budgets or Safe to SPND unless explicitly converted to another type |

Default recommendation:

- Housing, recurring utilities, insurance, subscriptions, minimum debt payments: Obligation.
- Groceries, dining, transportation fuel, shopping, entertainment, family spending: Spending.
- Savings contributions and extra debt payoff: Goal.
- Paychecks and other expected deposits: Income.

Savings and debt must not be modeled as ordinary expense categories merely to make their progress bars move.

## Credit-card paid-in-full treatment

Credit-card purchases reduce spending-category availability when they are categorized. Because those purchases have not yet reduced cash-account balances, the amount owed on paid-in-full cards must also be reserved from cash.

Conceptually:

    card_reserve = posted_card_liability + pending_card_purchases_not_already_reflected

Implementation requirements:

- Normalize each credit-card balance to a positive liability amount.
- Show the user the amount SPND believes is owed.
- Prefer a provider-supplied available/current balance relationship only after its behavior is verified for that account.
- Never subtract a pending purchase twice.
- When a card payment posts, match the cash-account payment and card-account payment as one transfer and exclude both transaction legs from spending.
- A card payment must reduce the card reserve; it must not create new category spending.
- Provide reconciliation diagnostics when card liability, pending purchases, or a matched payment cannot be explained.

Until an account’s balance convention is verified, Safe to SPND should display Needs review rather than silently guessing.

## Cash balance basis

For each Cash account:

1. Prefer provider available balance when present and recent.
2. Otherwise use current balance adjusted by unmatched pending cash-account transactions.
3. Do not separately subtract pending transactions already reflected in the chosen balance.
4. Mark stale balances when their timestamp exceeds the accepted freshness window.
5. Exclude Investment, Other liability, and Excluded accounts from spendable cash.

Store or calculate the balance basis used for each account so the Safe-to-SPND breakdown can explain it.

## Safe to SPND formula

The calculation must be explainable and must not reserve the same dollar twice.

    effective_cash
    - paid_in_full_credit_card_reserve
    - confirmed_obligations_due_before_next_income
    - planned_goal_contributions_due_before_next_income
    - expected_variable_spending_before_next_income
    - minimum_cash_buffer
    = raw_safe_to_spnd

Displayed Safe to SPND is the greater of zero and raw Safe to SPND. If raw is negative, show the shortfall separately.

Definitions:

- Effective cash: sum of included Cash account balances using the verified balance basis.
- Card reserve: normalized unpaid liability for cards configured Paid in full.
- Confirmed obligations: bills due before the next expected income that have not already been fulfilled by a matched transaction.
- Goal contributions: confirmed savings/debt contributions due before next income.
- Expected variable spending: prorated reserve for Spending categories only.
- Minimum cash buffer: household-controlled reserve editable in Settings.

Pending transactions affect exactly one component. A pending card purchase belongs in the card reserve or balance basis; a pending cash purchase belongs in the cash balance basis or variable-spending usage. It must never be subtracted globally a second time.

## Variable spending reserve

For Spending categories only:

    remaining_monthly_budget = max(0, monthly_budget - posted_spending - applicable_pending)
    prorated_need = expected_daily_category_spend × days_until_next_income
    reserve = min(remaining_monthly_budget, prorated_need)

Expected daily spend may initially be monthly budget divided by days in the budget month. Later, historical pacing can improve the estimate, but it must remain explainable.

Obligation and Goal categories are excluded from this prorated reserve because their confirmed dated amounts are reserved separately.

## Monthly Budget

Budget must support:

- expected income for the selected month;
- income received;
- assigned amount;
- left to assign;
- posted spending;
- pending spending;
- available category balances;
- copy previous month;
- save current month as the default template;
- edit exceptions after copying;
- zero-based warning when assigned exceeds expected income;
- clear distinction between unassigned income and category money remaining.

Budget category remaining:

    spending_category_remaining = assigned - posted_spending - applicable_pending

Do not label category money remaining as household Available to SPND. They answer different questions.

## Plan behavior

Every planned or recurring item must be editable, dismissible, and traceable.

Required states:

- Suggested
- Confirmed
- Matched/fulfilled
- Skipped
- Dismissed
- Inactive

A sync may update the observed amount/date of a suggestion, but it must never reset Confirmed, Dismissed, or Inactive decisions.

When a matching transaction arrives:

- suggest a match;
- preserve the planned item for history;
- stop reserving it as a future obligation once fulfilled;
- do not count the transaction and plan item twice.

## Transfers, refunds, and reimbursements

- Transfers between household accounts are excluded from spending and income.
- Credit-card payments are paired transfers.
- Refunds reduce the original spending category when confidently matched; they are not income.
- Reimbursements should either reduce the original category or use an explicit reimbursement treatment; they are not expected income by default.
- Unmatched positive transactions enter review rather than automatically inflating monthly income.

## Investment and net-worth treatment

Investment accounts affect net worth only. Investment transactions do not affect Budget or Safe to SPND.

For a future manual fallback, store append-only balance snapshots:

- account name;
- balance in integer cents;
- as-of date;
- optional note;
- actor and created timestamp.

Do not reactivate general PDF/document imports solely for investment balances. A simple manual balance form is safer and easier.

## Household permissions

Zack and Stephanie have the same product permissions:

- view and edit transactions;
- review and categorize;
- edit budgets and expected income;
- edit Plan items;
- manage categories and rules;
- manage account treatment and household buffer;
- view connection health and initiate sync.

Provider secrets, service-role credentials, and encrypted access URLs remain server-only for both users. Every financial edit records the acting household member.

## Required reconciliation invariants

1. Cash + investments − liabilities reconciles to displayed net worth.
2. Credit-card purchases affect their category once and card liability once.
3. Credit-card payment transfers do not affect spending or income.
4. Pending transactions affect Safe to SPND exactly once.
5. Expected income does not equal all positive transactions.
6. Refunds and transfers do not inflate expected income.
7. Confirmed obligations are not also included in variable category reserves.
8. Matched Plan items stop reserving future cash.
9. Month boundaries use the household timezone.
10. Budget, Activity, category detail, and exports use the same posted/transacted date policy.
