create extension if not exists pgcrypto;

create type public.household_role as enum ('owner', 'member');
create type public.connection_status as enum ('active', 'error', 'disconnected');
create type public.cash_flow_mode as enum ('cash', 'net_worth', 'excluded');
create type public.transaction_status as enum ('pending', 'posted');
create type public.allocation_source as enum ('manual', 'merchant_rule', 'merchant_history', 'default', 'unsorted');
create type public.recurring_type as enum ('expense', 'income');
create type public.sync_status as enum ('running', 'success', 'partial', 'error');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  minimum_cash_buffer_cents bigint not null default 0 check (minimum_cash_buffer_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_invites (
  household_id uuid not null references public.households on delete cascade,
  email text not null,
  role public.household_role not null default 'member',
  accepted_at timestamptz,
  primary key (household_id, email)
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.financial_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  provider text not null check (provider = 'simplefin'),
  encrypted_access_url text,
  encryption_iv text,
  encryption_auth_tag text,
  status public.connection_status not null default 'active',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  connection_id uuid references public.financial_connections on delete set null,
  provider_account_id text not null,
  institution_name text,
  name text not null,
  type text,
  currency text not null default 'USD',
  current_balance_cents bigint not null default 0,
  available_balance_cents bigint,
  balance_as_of timestamptz,
  cash_flow_mode public.cash_flow_mode not null default 'excluded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider_account_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  provider_transaction_id text,
  source_fingerprint text not null,
  pending_match_key text,
  replaces_pending_transaction_id uuid references public.transactions on delete set null,
  posted_at timestamptz,
  transacted_at timestamptz not null,
  amount_cents bigint not null,
  merchant text not null,
  normalized_merchant text not null,
  raw_description text,
  status public.transaction_status not null,
  provider_category text,
  raw_payload jsonb not null default '{}'::jsonb,
  note text,
  excluded boolean not null default false,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, source_fingerprint)
);

create unique index transactions_provider_id_unique
  on public.transactions (account_id, provider_transaction_id)
  where provider_transaction_id is not null;
create index transactions_household_date_idx on public.transactions (household_id, transacted_at desc);
create index transactions_pending_match_idx on public.transactions (account_id, pending_match_key) where status = 'pending';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  transaction_id uuid not null references public.transactions on delete cascade,
  category_id uuid not null references public.categories on delete restrict,
  amount_cents bigint not null,
  source public.allocation_source not null default 'unsorted',
  created_at timestamptz not null default now()
);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  merchant_pattern text not null,
  normalized_merchant text not null,
  category_id uuid not null references public.categories on delete cascade,
  priority integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_merchant)
);

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  month date not null check (date_trunc('month', month)::date = month),
  category_id uuid not null references public.categories on delete cascade,
  budgeted_cents bigint not null check (budgeted_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month, category_id)
);

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  type public.recurring_type not null,
  name text not null,
  merchant_pattern text not null,
  amount_cents bigint not null,
  cadence text not null,
  next_due_date date not null,
  category_id uuid references public.categories on delete set null,
  is_confirmed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, type, merchant_pattern)
);

create table public.planned_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  type public.recurring_type not null,
  category_id uuid references public.categories on delete set null,
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  connection_id uuid not null references public.financial_connections on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_status not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  sanitized_error text
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  actor_user_id uuid references auth.users on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_members (household_id, user_id, role)
  select household_id, new.id, role
  from public.household_invites
  where lower(email) = lower(new.email)
  on conflict do nothing;
  update public.household_invites
  set accepted_at = now()
  where lower(email) = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.households enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_members enable row level security;
alter table public.financial_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.transaction_allocations enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.recurring_items enable row level security;
alter table public.planned_items enable row level security;
alter table public.sync_runs enable row level security;
alter table public.audit_events enable row level security;

create policy "members read household" on public.households for select using (public.is_household_member(id));
create policy "members update household" on public.households for update using (public.is_household_member(id));
create policy "members read memberships" on public.household_members for select using (public.is_household_member(household_id));
create policy "members read invites" on public.household_invites for select using (public.is_household_member(household_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['accounts','transactions','categories','transaction_allocations','merchant_rules','monthly_budgets','recurring_items','planned_items','audit_events']
  loop
    execute format('create policy "members read %1$s" on public.%1$I for select using (public.is_household_member(household_id))', table_name);
    execute format('create policy "members insert %1$s" on public.%1$I for insert with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "members update %1$s" on public.%1$I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "members delete %1$s" on public.%1$I for delete using (public.is_household_member(household_id))', table_name);
  end loop;
end $$;

create policy "members read sync health" on public.sync_runs for select using (public.is_household_member(household_id));

create view public.connection_health with (security_barrier = true) as
select id, household_id, provider, status, last_synced_at, last_error, created_at, updated_at
from public.financial_connections
where public.is_household_member(household_id);
grant select on public.connection_health to authenticated;
revoke all on public.financial_connections from anon, authenticated;

insert into public.households (id, name, timezone)
values ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Turco Household', 'America/New_York');

insert into public.household_invites (household_id, email, role) values
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'zack@turco.family', 'owner'),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'stephanie@turco.family', 'owner');

insert into public.categories (household_id, name, color, icon, sort_order, is_system) values
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Housing', '#9B6CFF', 'House', 10, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Utilities', '#FFD24A', 'Zap', 20, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Groceries', '#45D9E1', 'ShoppingCart', 30, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Dining', '#FF705B', 'Utensils', 40, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Transportation', '#58A6FF', 'Car', 50, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Insurance', '#A6ACB8', 'Shield', 60, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Health', '#FF5D6C', 'HeartPulse', 70, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Kids & Family', '#9B6CFF', 'Users', 80, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Shopping', '#F79AD3', 'ShoppingBag', 90, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Entertainment', '#C9FF4A', 'Clapperboard', 100, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Travel', '#45D9E1', 'Plane', 110, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Gifts', '#FF705B', 'Gift', 120, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Personal', '#FFD24A', 'Smile', 130, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Savings', '#C9FF4A', 'PiggyBank', 140, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Debt', '#FF5D6C', 'CreditCard', 150, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Business', '#A6ACB8', 'Briefcase', 160, true),
  ('7a427b15-a397-4a83-a54d-f199efe77a32', 'Unsorted', '#A6ACB8', 'CircleHelp', 999, true);

insert into public.household_members (household_id, user_id, role)
select invite.household_id, users.id, invite.role
from public.household_invites invite
join auth.users users on lower(users.email) = lower(invite.email)
on conflict do nothing;
