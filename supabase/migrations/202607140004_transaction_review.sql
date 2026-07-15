alter table public.transactions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users on delete set null,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists is_transfer boolean not null default false,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists superseded_by_transaction_id uuid references public.transactions on delete set null;

alter table public.transactions
  drop constraint if exists transactions_review_status_check;

alter table public.transactions
  add constraint transactions_review_status_check
  check (review_status in ('needs_review', 'reviewed'));

update public.transactions
set review_status = case when reviewed_at is null then 'needs_review' else 'reviewed' end
where true;

create index if not exists transactions_household_review_idx
  on public.transactions (household_id, review_status, transacted_at desc);

create index if not exists transactions_household_transfer_idx
  on public.transactions (household_id, is_transfer, transacted_at desc);

create index if not exists transactions_pending_superseded_idx
  on public.transactions (account_id, status, superseded_by_transaction_id)
  where status = 'pending';

update public.categories set icon = 'ShieldCheck' where name = 'Insurance' and icon = 'Shield';
update public.categories old_category
set name = 'Family & Kids'
where old_category.name = 'Kids & Family'
  and not exists (
    select 1 from public.categories existing
    where existing.household_id = old_category.household_id and existing.name = 'Family & Kids'
  );
