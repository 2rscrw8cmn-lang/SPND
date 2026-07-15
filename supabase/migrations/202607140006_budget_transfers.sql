create or replace function public.move_budget_money(
  p_household_id uuid,
  p_month date,
  p_from_category_id uuid,
  p_to_category_id uuid,
  p_amount_cents bigint
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  from_amount bigint;
begin
  if p_amount_cents <= 0 or p_from_category_id = p_to_category_id or not public.is_household_member(p_household_id) then
    raise exception 'Invalid budget transfer';
  end if;
  if not exists (select 1 from public.categories where id = p_from_category_id and household_id = p_household_id)
    or not exists (select 1 from public.categories where id = p_to_category_id and household_id = p_household_id) then
    raise exception 'Category not found';
  end if;
  select budgeted_cents into from_amount from public.monthly_budgets
    where household_id = p_household_id and month = p_month and category_id = p_from_category_id for update;
  if coalesce(from_amount, 0) < p_amount_cents then raise exception 'Not enough assigned money'; end if;
  update public.monthly_budgets set budgeted_cents = budgeted_cents - p_amount_cents, updated_at = now()
    where household_id = p_household_id and month = p_month and category_id = p_from_category_id;
  insert into public.monthly_budgets (household_id, month, category_id, budgeted_cents)
    values (p_household_id, p_month, p_to_category_id, p_amount_cents)
    on conflict (household_id, month, category_id) do update set budgeted_cents = monthly_budgets.budgeted_cents + excluded.budgeted_cents, updated_at = now();
  insert into public.audit_events (household_id, actor_user_id, entity_type, entity_id, action, metadata)
    values (p_household_id, auth.uid(), 'monthly_budget', p_from_category_id, 'money_moved', jsonb_build_object('month', p_month, 'fromCategoryId', p_from_category_id, 'toCategoryId', p_to_category_id, 'amountCents', p_amount_cents));
end;
$$;

revoke all on function public.move_budget_money(uuid,date,uuid,uuid,bigint) from public, anon;
grant execute on function public.move_budget_money(uuid,date,uuid,uuid,bigint) to authenticated;
