alter table public.categories
  add column if not exists palette_key text not null default 'slate';

update public.categories set palette_key = case lower(name)
  when 'housing' then 'violet-indigo'
  when 'utilities' then 'yellow-orange'
  when 'groceries' then 'cyan-teal'
  when 'dining' then 'orange-amber'
  when 'transportation' then 'lime-green'
  when 'insurance' then 'blue-indigo'
  when 'healthcare' then 'coral-red'
  when 'health' then 'coral-red'
  when 'family & kids' then 'pink-violet'
  when 'shopping' then 'purple-pink'
  when 'entertainment' then 'magenta-violet'
  when 'travel' then 'sky-blue'
  when 'savings' then 'teal-emerald'
  when 'debt' then 'amber-orange'
  when 'income' then 'lime-emerald'
  when 'paycheck' then 'lime-emerald'
  else palette_key end
where palette_key = 'slate';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_palette_key_nonempty'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_palette_key_nonempty check (length(trim(palette_key)) > 0);
  end if;
end
$$;
