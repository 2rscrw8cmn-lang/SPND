alter table public.categories
  drop constraint if exists categories_category_group_check;

create table if not exists public.category_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (name = trim(name) and char_length(name) between 1 and 40 and lower(name) <> 'all'),
  sort_order integer not null default 100,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create unique index if not exists category_groups_household_name_ci_idx
  on public.category_groups (household_id, lower(trim(name)));

insert into public.category_groups (household_id, name, sort_order, is_system)
select household.id, defaults.name, defaults.sort_order, true
from public.households household
cross join (values ('Income', 5), ('Essentials', 10), ('Lifestyle', 20), ('Goals', 30), ('Excluded', 90)) as defaults(name, sort_order)
on conflict (household_id, name) do nothing;

insert into public.categories (
  household_id, name, color, icon, sort_order, is_system,
  category_group, is_active, is_excluded, show_in_budget
)
select household.id, 'Paycheck', '#63D9A2', 'Banknote', 5, true,
  'Income', true, false, false
from public.households household
on conflict (household_id, name) do nothing;

insert into public.category_groups (household_id, name, sort_order, is_system)
select distinct category.household_id, category.category_group, 50, false
from public.categories category
where not exists (
  select 1 from public.category_groups existing
  where existing.household_id = category.household_id
    and lower(existing.name) = lower(category.category_group)
)
on conflict do nothing;

alter table public.categories
  drop constraint if exists categories_category_group_fk;
alter table public.categories
  add constraint categories_category_group_fk
  foreign key (household_id, category_group)
  references public.category_groups (household_id, name)
  on update cascade
  on delete restrict;

alter table public.category_groups enable row level security;

drop policy if exists "members read category_groups" on public.category_groups;
create policy "members read category_groups" on public.category_groups for select
  using (public.is_household_member(household_id));

drop policy if exists "members insert category_groups" on public.category_groups;
create policy "members insert category_groups" on public.category_groups for insert
  with check (public.is_household_member(household_id) and is_system = false);

drop policy if exists "members update category_groups" on public.category_groups;
create policy "members update category_groups" on public.category_groups for update
  using (public.is_household_member(household_id) and is_system = false)
  with check (public.is_household_member(household_id) and is_system = false);

drop policy if exists "members delete category_groups" on public.category_groups;
create policy "members delete category_groups" on public.category_groups for delete
  using (public.is_household_member(household_id) and is_system = false);

create or replace function public.protect_category_group_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.is_system then
    raise exception 'Built-in category groups cannot be deleted.';
  end if;
  if exists (
    select 1 from public.categories
    where household_id = old.household_id and category_group = old.name
  ) then
    raise exception 'Move categories before deleting this group.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_category_group_delete on public.category_groups;
create trigger protect_category_group_delete
  before delete on public.category_groups
  for each row execute procedure public.protect_category_group_delete();

create or replace function public.rename_category_group(p_household_id uuid, p_group_id uuid, p_name text)
returns void language plpgsql set search_path = '' as $$
declare
  old_name text;
begin
  select name into old_name
  from public.category_groups
  where id = p_group_id and household_id = p_household_id and is_system = false
  for update;

  if old_name is null then
    raise exception 'Category group not found or protected.';
  end if;

  update public.category_groups
  set name = trim(p_name), updated_at = now()
  where id = p_group_id and household_id = p_household_id;
end;
$$;

create or replace function public.seed_household_category_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.category_groups (household_id, name, sort_order, is_system) values
    (new.id, 'Income', 5, true),
    (new.id, 'Essentials', 10, true),
    (new.id, 'Lifestyle', 20, true),
    (new.id, 'Goals', 30, true),
    (new.id, 'Excluded', 90, true);
  insert into public.categories (
    household_id, name, color, icon, sort_order, is_system,
    category_group, is_active, is_excluded, show_in_budget
  ) values (new.id, 'Paycheck', '#63D9A2', 'Banknote', 5, true, 'Income', true, false, false);
  return new;
end;
$$;

drop trigger if exists seed_household_category_groups on public.households;
create trigger seed_household_category_groups
  after insert on public.households
  for each row execute procedure public.seed_household_category_groups();
