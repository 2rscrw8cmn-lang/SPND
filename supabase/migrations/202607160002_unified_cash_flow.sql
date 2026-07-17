alter table public.expected_income_sources
  add column if not exists normalized_merchant text,
  add column if not exists auto_match_enabled boolean not null default true,
  add column if not exists legacy_recurring_item_id uuid references public.recurring_items on delete set null,
  add column if not exists legacy_planned_item_id uuid references public.planned_items on delete set null;

alter table public.planned_items
  add column if not exists expected_income_source_id uuid references public.expected_income_sources on delete set null,
  add column if not exists match_method text check (match_method is null or match_method in ('automatic', 'manual', 'legacy'));

create unique index if not exists expected_income_sources_legacy_recurring_idx
  on public.expected_income_sources (legacy_recurring_item_id)
  where legacy_recurring_item_id is not null;

create unique index if not exists expected_income_sources_legacy_planned_idx
  on public.expected_income_sources (legacy_planned_item_id)
  where legacy_planned_item_id is not null;

-- Reuse an existing source when a legacy planned deposit is an exact occurrence.
with candidates as (
  select
    item.id as planned_item_id,
    source.id as source_id,
    row_number() over (
      partition by source.id, item.date
      order by item.created_at, item.id
    ) as source_date_rank,
    row_number() over (
      partition by item.id
      order by source.created_at, source.id
    ) as item_rank
  from public.planned_items item
  join public.expected_income_sources source
    on source.household_id = item.household_id
   and lower(source.name) = lower(item.name)
   and source.expected_amount_cents = abs(item.amount_cents)
   and (source.next_expected_date = item.date or item.date = any(source.explicit_dates))
  where item.type = 'income'
    and item.expected_income_source_id is null
)
update public.planned_items item
set expected_income_source_id = candidates.source_id,
    match_method = case when item.matched_transaction_id is null then item.match_method else 'legacy' end
from candidates
where item.id = candidates.planned_item_id
  and candidates.source_date_rank = 1
  and candidates.item_rank = 1;

-- Every unmatched legacy planned deposit becomes a one-time canonical source.
insert into public.expected_income_sources (
  household_id,
  name,
  expected_amount_cents,
  cadence,
  explicit_dates,
  next_expected_date,
  active,
  acceptable_variance_cents,
  source_type,
  auto_match_enabled,
  legacy_planned_item_id,
  created_at,
  updated_at
)
select
  item.household_id,
  item.name,
  abs(item.amount_cents),
  null,
  array[item.date],
  item.date,
  item.state not in ('skipped', 'inactive', 'dismissed'),
  null,
  'one_time',
  false,
  item.id,
  item.created_at,
  item.updated_at
from public.planned_items item
where item.type = 'income'
  and item.expected_income_source_id is null
  and item.amount_cents <> 0
on conflict (legacy_planned_item_id) where legacy_planned_item_id is not null do nothing;

update public.planned_items item
set expected_income_source_id = source.id,
    match_method = case when item.matched_transaction_id is null then item.match_method else 'legacy' end
from public.expected_income_sources source
where source.legacy_planned_item_id = item.id
  and item.expected_income_source_id is null;

insert into public.audit_events (household_id, entity_type, entity_id, action, metadata)
select
  item.household_id,
  'planned_item',
  item.id,
  'migrated_to_income_source',
  jsonb_build_object('expectedIncomeSourceId', item.expected_income_source_id)
from public.planned_items item
where item.type = 'income'
  and item.expected_income_source_id is not null
  and not exists (
    select 1 from public.audit_events event
    where event.entity_type = 'planned_item'
      and event.entity_id = item.id
      and event.action = 'migrated_to_income_source'
  );

-- Learn merchant identity from exact legacy recurring-income matches first.
update public.expected_income_sources source
set normalized_merchant = recurring.merchant_pattern,
    auto_match_enabled = true,
    legacy_recurring_item_id = recurring.id,
    updated_at = greatest(source.updated_at, recurring.updated_at)
from public.recurring_items recurring
where recurring.type = 'income'
  and source.household_id = recurring.household_id
  and lower(source.name) = lower(recurring.name)
  and source.expected_amount_cents = abs(recurring.amount_cents)
  and source.cadence = recurring.cadence
  and source.next_expected_date = recurring.next_due_date
  and source.legacy_recurring_item_id is null;

insert into public.expected_income_sources (
  household_id,
  name,
  expected_amount_cents,
  cadence,
  explicit_dates,
  next_expected_date,
  active,
  acceptable_variance_cents,
  source_type,
  normalized_merchant,
  auto_match_enabled,
  legacy_recurring_item_id,
  created_at,
  updated_at
)
select
  recurring.household_id,
  recurring.name,
  abs(recurring.amount_cents),
  recurring.cadence,
  '{}'::date[],
  recurring.next_due_date,
  recurring.active,
  null,
  'recurring',
  recurring.merchant_pattern,
  true,
  recurring.id,
  recurring.created_at,
  recurring.updated_at
from public.recurring_items recurring
where recurring.type = 'income'
  and recurring.amount_cents <> 0
  and not exists (
    select 1 from public.expected_income_sources source
    where source.legacy_recurring_item_id = recurring.id
  )
on conflict (legacy_recurring_item_id) where legacy_recurring_item_id is not null do nothing;

insert into public.audit_events (household_id, entity_type, entity_id, action, metadata)
select
  recurring.household_id,
  'recurring_item',
  recurring.id,
  'migrated_to_income_source',
  jsonb_build_object('expectedIncomeSourceId', source.id)
from public.recurring_items recurring
join public.expected_income_sources source on source.legacy_recurring_item_id = recurring.id
where recurring.type = 'income'
  and not exists (
    select 1 from public.audit_events event
    where event.entity_type = 'recurring_item'
      and event.entity_id = recurring.id
      and event.action = 'migrated_to_income_source'
  );

update public.recurring_items
set active = false,
    is_confirmed = false,
    state = 'inactive',
    updated_at = now()
where type = 'income'
  and (state <> 'inactive' or active or is_confirmed);

create unique index if not exists planned_income_source_occurrence_idx
  on public.planned_items (household_id, expected_income_source_id, date);

create index if not exists expected_income_sources_merchant_idx
  on public.expected_income_sources (household_id, normalized_merchant)
  where active and normalized_merchant is not null;

create index if not exists planned_income_open_occurrence_idx
  on public.planned_items (household_id, date, amount_cents)
  where type = 'income' and state = 'confirmed' and matched_transaction_id is null;
