alter table public.transactions add column if not exists display_name text;

comment on column public.transactions.display_name is 'Household-authored merchant display name; imported merchant remains immutable.';
