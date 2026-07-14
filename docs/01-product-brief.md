# SPND — Product Brief

## One-line definition

SPND is a private shared-household budgeting app that turns connected accounts into one clear answer: **what is safe to spend before the next planned income date?**

## Users

- **Zack and Stephanie:** equal household members with full visibility into the shared budget.
- This is a two-person private app, not a public consumer product or a multi-tenant SaaS launch.

## Version 1 outcome

At any time, either user can open SPND on an iPhone and quickly see:

1. Safe to SPND until the next pay date.
2. Remaining amount in each fixed monthly budget category.
3. Recent transactions, with an appropriate suggested category.
4. Upcoming recurring bills and their effect on cash flow.

## In scope

- Email/password or magic-link authentication for two approved users.
- SimpleFIN Bridge account connection and secure background sync.
- Accounts, balances, transaction feed, duplicate prevention, and sync status.
- Fixed monthly budgets by category.
- Category suggestions based on merchant rules and prior user corrections.
- One-tap transaction categorization, split transactions, notes, and exclusion from budget.
- Recurring transaction detection with user confirmation for bills and income.
- Cash-flow forecast and Safe to SPND calculation.
- Mobile-first dark-only UI.

## Explicitly out of scope for V1

- Moving money, payments, transfers, or bill pay.
- Credit score, investment advice, tax advice, or subscription cancellation.
- Public onboarding, billing, teams, or additional households.
- Native iOS app and App Store release.
- Complex envelope rollover, debt payoff methods, and investment holdings analytics.

## Core definitions

| Term | Meaning |
|---|---|
| Available cash | Sum of included cash/checking/savings account balances. Credit cards are tracked separately and do not inflate available cash. |
| Budget month | Calendar month using the household timezone, America/New_York. |
| Category remaining | Fixed category budget minus posted, included expense transactions allocated to the category. |
| Planned obligations | Confirmed recurring bills and scheduled manual items due before the next income date. |
| Safe to SPND | Available cash minus reserved obligations, minimum cash buffer, and remaining required budget funding; never show a negative amount as spendable. |

## Safe to SPND behavior

The number must be explainable. Tapping it opens a breakdown:

`available cash - bills due - required category reserves - minimum buffer = safe to SPND`

V1 uses conservative, user-configurable inputs. If inputs are incomplete, SPND displays a visible "Needs review" state instead of pretending the figure is exact.

## Success criteria

- Both users can complete a daily check in under 10 seconds.
- A new transaction can be categorized or corrected in two taps or fewer.
- Syncs are reliable, visible, and never expose banking credentials.
- The budget does not require a spreadsheet to understand.
