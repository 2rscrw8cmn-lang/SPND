alter table public.categories
  add column if not exists category_group text not null default 'Lifestyle',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_excluded boolean not null default false,
  add column if not exists show_in_budget boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.categories
  drop constraint if exists categories_category_group_check;

alter table public.categories
  add constraint categories_category_group_check
  check (category_group in ('Essentials', 'Lifestyle', 'Goals', 'Excluded'));

update public.categories set
  category_group = case
    when name in ('Housing', 'Utilities', 'Groceries', 'Transportation', 'Insurance', 'Health') then 'Essentials'
    when name in ('Savings', 'Debt') then 'Goals'
    when name in ('Business', 'Reimbursements', 'Transfers') then 'Excluded'
    else 'Lifestyle'
  end,
  is_excluded = name in ('Business', 'Reimbursements', 'Transfers'),
  show_in_budget = name not in ('Business', 'Reimbursements', 'Transfers', 'Unsorted')
where true;

create index if not exists categories_household_budget_order_idx
  on public.categories (household_id, is_active desc, category_group, sort_order);
