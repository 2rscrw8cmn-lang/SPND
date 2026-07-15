create type public.account_role as enum ('cash', 'credit_card', 'investment', 'other_liability', 'excluded');
create type public.balance_basis_state as enum ('needs_review', 'current', 'available');
create type public.category_behavior as enum ('spending', 'obligation', 'goal', 'income', 'excluded');
create type public.plan_item_state as enum ('suggested', 'confirmed', 'matched', 'skipped', 'dismissed', 'inactive');
create type public.income_source_type as enum ('recurring', 'one_time');

alter table public.accounts
  add column account_role public.account_role not null default 'excluded',
  add column credit_card_pay_in_full boolean not null default false,
  add column liability_balance_sign smallint check (liability_balance_sign in (-1, 1)),
  add column balance_basis_state public.balance_basis_state not null default 'needs_review',
  add column pending_transactions_in_balance boolean,
  add column credit_card_due_date date;

update public.accounts
set account_role = case cash_flow_mode
  when 'cash' then 'cash'::public.account_role
  when 'excluded' then 'excluded'::public.account_role
  else 'excluded'::public.account_role
end;

alter table public.categories
  add column behavior_type public.category_behavior not null default 'spending';

update public.categories
set behavior_type = case
  when is_excluded or category_group = 'Excluded' or name in ('Transfers', 'Reimbursements', 'Business', 'Unsorted') then 'excluded'::public.category_behavior
  when category_group = 'Income' or name in ('Paycheck', 'Income', 'Bonus') then 'income'::public.category_behavior
  when category_group = 'Goals' or name in ('Savings', 'Debt') then 'goal'::public.category_behavior
  when name in ('Housing', 'Utilities', 'Insurance', 'Subscriptions', 'Childcare') then 'obligation'::public.category_behavior
  else 'spending'::public.category_behavior
end;

alter table public.planned_items
  add column state public.plan_item_state not null default 'confirmed',
  add column matched_transaction_id uuid references public.transactions on delete set null,
  add column updated_at timestamptz not null default now();

alter table public.recurring_items
  add column state public.plan_item_state not null default 'suggested',
  add column matched_transaction_id uuid references public.transactions on delete set null;

update public.recurring_items
set state = case
  when is_confirmed and active then 'confirmed'::public.plan_item_state
  when not active then 'inactive'::public.plan_item_state
  else 'suggested'::public.plan_item_state
end;

create table public.expected_income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  expected_amount_cents bigint not null check (expected_amount_cents > 0),
  cadence text,
  explicit_dates date[] not null default '{}',
  next_expected_date date,
  active boolean not null default true,
  acceptable_variance_cents bigint check (acceptable_variance_cents is null or acceptable_variance_cents >= 0),
  source_type public.income_source_type not null default 'recurring',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_expected_date is not null or cardinality(explicit_dates) > 0)
);

create index expected_income_household_date_idx
  on public.expected_income_sources (household_id, active, next_expected_date);

alter table public.expected_income_sources enable row level security;
create policy "members read expected income" on public.expected_income_sources for select
  using (public.is_household_member(household_id));
create policy "members insert expected income" on public.expected_income_sources for insert
  with check (public.is_household_member(household_id));
create policy "members update expected income" on public.expected_income_sources for update
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members delete expected income" on public.expected_income_sources for delete
  using (public.is_household_member(household_id));

create index accounts_household_role_idx on public.accounts (household_id, account_role);
create index categories_household_behavior_idx on public.categories (household_id, behavior_type);
create index planned_items_household_state_date_idx on public.planned_items (household_id, state, date);
