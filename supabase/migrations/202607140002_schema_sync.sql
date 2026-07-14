-- Forward-only additions for databases that received the first SPND schema
-- before normalized merchant matching and recurring candidate uniqueness were added.
alter table public.transactions
  add column if not exists normalized_merchant text;

update public.transactions
set normalized_merchant = lower(trim(regexp_replace(coalesce(merchant, ''), '[^a-zA-Z0-9\\s]', ' ', 'g')))
where normalized_merchant is null;

alter table public.transactions
  alter column normalized_merchant set not null;

create index if not exists transactions_household_normalized_merchant_idx
  on public.transactions (household_id, normalized_merchant);

create unique index if not exists accounts_household_provider_account_unique
  on public.accounts (household_id, provider_account_id);

create unique index if not exists merchant_rules_household_normalized_idx
  on public.merchant_rules (household_id, normalized_merchant);

create unique index if not exists recurring_items_candidate_unique
  on public.recurring_items (household_id, type, merchant_pattern)
  where merchant_pattern is not null;

