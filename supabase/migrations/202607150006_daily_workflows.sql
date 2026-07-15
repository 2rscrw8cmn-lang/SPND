create or replace function public.update_transaction_with_allocations(
  p_household_id uuid,
  p_transaction_id uuid,
  p_updates jsonb,
  p_allocations jsonb default null
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_household_member(p_household_id) then raise exception 'Unauthorized'; end if;
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
  if not found then raise exception 'Transaction not found'; end if;

  if p_allocations is not null then
    if exists (select 1 from jsonb_to_recordset(p_allocations) as item(category_id uuid, amount_cents bigint) left join public.categories category on category.id = item.category_id and category.household_id = p_household_id where category.id is null) then raise exception 'Invalid category'; end if;
    delete from public.transaction_allocations where transaction_id = p_transaction_id and household_id = p_household_id;
    insert into public.transaction_allocations (household_id,transaction_id,category_id,amount_cents,source)
      select p_household_id,p_transaction_id,item.category_id,item.amount_cents,'manual'::public.allocation_source from jsonb_to_recordset(p_allocations) as item(category_id uuid,amount_cents bigint);
  end if;
end $$;

revoke all on function public.update_transaction_with_allocations(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.update_transaction_with_allocations(uuid,uuid,jsonb,jsonb) to authenticated;

alter table public.planned_items add column if not exists recurring_item_id uuid references public.recurring_items on delete set null;
create index if not exists planned_items_matched_transaction_idx on public.planned_items (matched_transaction_id) where matched_transaction_id is not null;
