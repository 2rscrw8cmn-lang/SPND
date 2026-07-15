alter table public.accounts
  add column if not exists provider_connection_id text not null default '';

update public.accounts set provider_connection_id = '' where provider_connection_id is null;
alter table public.accounts alter column provider_connection_id set not null;

drop index if exists public.accounts_household_provider_account_unique;
alter table public.accounts
  drop constraint if exists accounts_household_id_provider_account_id_key;

create unique index if not exists accounts_household_provider_connection_account_unique
  on public.accounts (household_id, provider_connection_id, provider_account_id);

create index if not exists accounts_provider_connection_idx
  on public.accounts (household_id, provider_connection_id);
