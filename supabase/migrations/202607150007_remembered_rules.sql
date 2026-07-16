alter type public.allocation_source add value if not exists 'provider' after 'merchant_history';

alter table public.merchant_rules
  add column if not exists version integer not null default 1,
  add column if not exists last_applied_at timestamptz;

create or replace function public.update_transaction_with_allocations(
  p_household_id uuid,
  p_transaction_id uuid,
  p_updates jsonb,
  p_allocations jsonb default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  current_updated_at timestamptz;
  allocation_source public.allocation_source := coalesce((p_updates->>'allocation_source')::public.allocation_source, 'manual'::public.allocation_source);
begin
  if not public.is_household_member(p_household_id) then raise exception 'Unauthorized'; end if;

  select updated_at into current_updated_at from public.transactions
  where id = p_transaction_id and household_id = p_household_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if p_updates ? 'expected_updated_at' and current_updated_at <> (p_updates->>'expected_updated_at')::timestamptz then
    raise exception using errcode = '40001', message = 'Transaction changed since it was opened';
  end if;

  update public.transactions set
    display_name = case when p_updates ? 'display_name' then nullif(p_updates->>'display_name','') else display_name end,
    note = case when p_updates ? 'note' then coalesce(p_updates->>'note','') else note end,
    excluded = case when p_updates ? 'excluded' then (p_updates->>'excluded')::boolean else excluded end,
    is_transfer = case when p_updates ? 'is_transfer' then (p_updates->>'is_transfer')::boolean else is_transfer end,
    is_recurring = case when p_updates ? 'is_recurring' then (p_updates->>'is_recurring')::boolean else is_recurring end,
    review_status = case when p_updates ? 'review_status' then p_updates->>'review_status' else review_status end,
    reviewed_at = case when p_updates ? 'review_status' then case when p_updates->>'review_status' = 'reviewed' then now() else null end else reviewed_at end,
    reviewed_by = case when p_updates ? 'review_status' then case when p_updates->>'review_status' = 'reviewed' then auth.uid() else null end else reviewed_by end,
    updated_at = now()
  where id = p_transaction_id and household_id = p_household_id;

  if p_allocations is not null then
    if exists (select 1 from jsonb_to_recordset(p_allocations) as item(category_id uuid, amount_cents bigint) left join public.categories category on category.id = item.category_id and category.household_id = p_household_id where category.id is null) then raise exception 'Invalid category'; end if;
    delete from public.transaction_allocations where transaction_id = p_transaction_id and household_id = p_household_id;
    insert into public.transaction_allocations (household_id,transaction_id,category_id,amount_cents,source)
      select p_household_id,p_transaction_id,item.category_id,item.amount_cents,allocation_source from jsonb_to_recordset(p_allocations) as item(category_id uuid,amount_cents bigint);
  end if;

  if p_updates ? 'remember_normalized_merchant' and p_updates ? 'remember_category_id' then
    execute 'select public.apply_remembered_rule($1,$2,$3,$4)'
      using p_household_id, p_updates->>'remember_normalized_merchant', (p_updates->>'remember_category_id')::uuid, auth.uid();
  end if;
end $$;

create or replace function public.apply_remembered_rule(
  p_household_id uuid,
  p_normalized_merchant text,
  p_category_id uuid,
  p_actor_user_id uuid
) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  affected_count integer := 0;
  transaction_record record;
begin
  if not public.is_household_member(p_household_id) or p_actor_user_id <> auth.uid() then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and household_id = p_household_id) then raise exception 'Invalid category'; end if;

  insert into public.merchant_rules (household_id,merchant_pattern,normalized_merchant,category_id,priority,active,created_by,version,last_applied_at,updated_at)
  values (p_household_id,p_normalized_merchant,p_normalized_merchant,p_category_id,1000,true,p_actor_user_id,1,now(),now())
  on conflict (household_id,normalized_merchant) do update set
    category_id = excluded.category_id, active = true, version = public.merchant_rules.version + 1,
    last_applied_at = now(), updated_at = now();

  for transaction_record in
    select candidate.id, candidate.amount_cents
    from public.transactions candidate
    where candidate.household_id = p_household_id
      and candidate.normalized_merchant = p_normalized_merchant
      and candidate.review_status = 'needs_review'
      and not candidate.excluded and not candidate.is_transfer
      and candidate.superseded_by_transaction_id is null
      and not exists (
        select 1 from public.transaction_allocations allocation
        where allocation.transaction_id = candidate.id
        group by allocation.transaction_id
        having count(*) > 1 or bool_or(allocation.source = 'manual')
      )
  loop
    delete from public.transaction_allocations where transaction_id = transaction_record.id and household_id = p_household_id;
    insert into public.transaction_allocations (household_id,transaction_id,category_id,amount_cents,source)
    values (p_household_id,transaction_record.id,p_category_id,transaction_record.amount_cents,'merchant_rule');
    insert into public.audit_events (household_id,actor_user_id,entity_type,entity_id,action,metadata)
    values (p_household_id,p_actor_user_id,'transaction',transaction_record.id,'merchant_rule_applied',jsonb_build_object('normalizedMerchant',p_normalized_merchant,'categoryId',p_category_id));
    affected_count := affected_count + 1;
  end loop;

  insert into public.audit_events (household_id,actor_user_id,entity_type,action,metadata)
  values (p_household_id,p_actor_user_id,'merchant_rule','merchant_rule_saved',jsonb_build_object('normalizedMerchant',p_normalized_merchant,'categoryId',p_category_id,'affectedCount',affected_count));
  return affected_count;
end $$;

revoke all on function public.apply_remembered_rule(uuid,text,uuid,uuid) from public,anon;
grant execute on function public.apply_remembered_rule(uuid,text,uuid,uuid) to authenticated;
