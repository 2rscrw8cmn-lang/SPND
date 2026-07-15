update public.transactions
set review_status = 'reviewed',
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
where excluded = true and review_status <> 'reviewed';

create or replace function public.review_excluded_transaction()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.excluded then
    new.review_status := 'reviewed';
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists review_excluded_transaction on public.transactions;
create trigger review_excluded_transaction
  before insert or update of excluded on public.transactions
  for each row execute procedure public.review_excluded_transaction();
