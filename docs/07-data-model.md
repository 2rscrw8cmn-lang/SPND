# SPND — Data Model

## Core tables

| Table | Purpose | Key fields |
|---|---|---|
| `households` | Private shared budget | `id`, `name`, `timezone`, `minimum_cash_buffer_cents` |
| `household_members` | Authorized users | `household_id`, `user_id`, `role` |
| `financial_connections` | Encrypted SimpleFIN access material | `household_id`, `provider`, `encrypted_access_url`, `status`, `last_synced_at` |
| `accounts` | Imported financial accounts | `connection_id`, `provider_account_id`, `name`, `type`, `current_balance_cents`, `cash_flow_mode` |
| `transactions` | Normalized source transactions | `account_id`, `provider_transaction_id`, `posted_at`, `amount_cents`, `merchant`, `raw_description`, `status` |
| `categories` | Household category taxonomy | `household_id`, `name`, `color`, `icon`, `sort_order`, `is_system` |
| `transaction_allocations` | Categories and splits | `transaction_id`, `category_id`, `amount_cents`, `source` |
| `merchant_rules` | Future category suggestions | `household_id`, `merchant_pattern`, `category_id`, `priority`, `active` |
| `monthly_budgets` | Fixed monthly targets | `household_id`, `month`, `category_id`, `budgeted_cents`, `rollover_enabled` |
| `recurring_items` | Confirmed bills/income | `household_id`, `type`, `merchant_pattern`, `amount_cents`, `cadence`, `next_due_date`, `is_confirmed` |
| `planned_items` | One-time future cash-flow items | `household_id`, `date`, `amount_cents`, `type`, `category_id` |
| `sync_runs` | Connection health/audit | `connection_id`, `started_at`, `finished_at`, `status`, `summary`, `sanitized_error` |
| `audit_events` | User actions requiring traceability | `household_id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `metadata` |

## Rules

- Store currency as signed integer cents. Expenses are negative; income is positive.
- Preserve imported source values; keep user edits in separate fields/tables where possible.
- A transaction can have one or more allocations. Allocation total must equal the transaction amount for included expenses.
- Uniqueness: `(account_id, provider_transaction_id)` when a provider ID exists; otherwise `(account_id, source_fingerprint)`.
- Every household-scoped table requires RLS through membership in `household_members`.
- Access URL ciphertext must never be included in `SELECT` responses exposed to the client.

## Suggested starter categories

Housing, Utilities, Groceries, Dining, Transportation, Insurance, Health, Kids & Family, Shopping, Entertainment, Travel, Gifts, Personal, Savings, Debt, Business, and Unsorted.
