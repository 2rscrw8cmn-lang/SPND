create table public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  budgeted_cents bigint not null check (budgeted_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id)
);

create table public.expected_income_matches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  source_id uuid not null references public.expected_income_sources on delete cascade,
  transaction_id uuid not null unique references public.transactions on delete cascade,
  expected_date date not null,
  expected_amount_cents bigint not null check (expected_amount_cents > 0),
  confirmed_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

alter table public.budget_templates enable row level security;
alter table public.expected_income_matches enable row level security;

do $$
declare target text;
begin
  foreach target in array array['budget_templates','expected_income_matches'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select using (public.is_household_member(household_id))', target);
    execute format('create policy "members insert %1$s" on public.%1$I for insert with check (public.is_household_member(household_id))', target);
    execute format('create policy "members update %1$s" on public.%1$I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', target);
    execute format('create policy "members delete %1$s" on public.%1$I for delete using (public.is_household_member(household_id))', target);
  end loop;
end $$;

create index expected_income_matches_household_date_idx on public.expected_income_matches (household_id, expected_date);
