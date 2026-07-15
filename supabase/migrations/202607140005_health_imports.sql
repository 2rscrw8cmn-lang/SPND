create or replace view public.connection_health with (security_barrier = true) as
select
  connection.id,
  connection.household_id,
  connection.provider,
  connection.status,
  connection.last_synced_at,
  connection.last_error,
  connection.created_at,
  connection.updated_at,
  latest.started_at as last_attempted_at,
  latest.status as last_sync_status,
  latest.finished_at as last_finished_at,
  latest.summary as last_sync_summary,
  latest.sanitized_error,
  (select count(*)::integer from public.accounts account where account.connection_id = connection.id) as account_count,
  coalesce((latest.summary ->> 'transactionCount')::integer, 0) as last_transaction_count
from public.financial_connections connection
left join lateral (
  select run.started_at, run.finished_at, run.status, run.summary, run.sanitized_error
  from public.sync_runs run
  where run.connection_id = connection.id
  order by run.started_at desc
  limit 1
) latest on true
where public.is_household_member(connection.household_id);

grant select on public.connection_health to authenticated;
revoke all on public.financial_connections from anon, authenticated;

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid references auth.users on delete set null,
  import_type text not null check (import_type in ('bank_transactions', 'credit_card_transactions', 'budget_template', 'income', 'recurring_bills', 'planned_expenses')),
  status text not null default 'review' check (status in ('parsing', 'review', 'ready', 'applied', 'rejected', 'error')),
  file_name text not null,
  file_checksum text not null,
  account_id uuid references public.accounts on delete set null,
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  review_rows integer not null default 0 check (review_rows >= 0),
  applied_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, import_type, file_checksum)
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  import_id uuid not null unique references public.imports on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  import_id uuid not null references public.imports on delete cascade,
  row_number integer not null check (row_number > 0),
  status text not null default 'accepted' check (status in ('accepted', 'duplicate', 'review', 'applied', 'rejected')),
  fingerprint text not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  applied_entity_type text,
  applied_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, row_number)
);

create table public.import_errors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  import_id uuid not null references public.imports on delete cascade,
  import_row_id uuid references public.import_rows on delete cascade,
  row_number integer,
  field text,
  code text not null,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index imports_household_created_idx on public.imports (household_id, created_at desc);
create index import_rows_import_status_idx on public.import_rows (import_id, status, row_number);
create index import_rows_household_fingerprint_idx on public.import_rows (household_id, fingerprint);
create index import_errors_import_open_idx on public.import_errors (import_id, resolved_at) where resolved_at is null;

alter table public.imports enable row level security;
alter table public.source_documents enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_errors enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['imports','source_documents','import_rows','import_errors']
  loop
    execute format('create policy "members read %1$s" on public.%1$I for select using (public.is_household_member(household_id))', table_name);
    execute format('create policy "members insert %1$s" on public.%1$I for insert with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "members update %1$s" on public.%1$I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "members delete %1$s" on public.%1$I for delete using (public.is_household_member(household_id))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('source-documents', 'source-documents', false, 10485760, array['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
