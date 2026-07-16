-- PostgREST requires both PostgreSQL privileges and passing RLS policies.
-- Keep grants explicit for browser roles so RLS remains the row-level boundary.
grant usage on schema public to anon, authenticated, service_role;

-- The service role is used by trusted server processes and integration fixtures.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Anonymous callers may query households, but RLS prevents them from seeing rows.
grant select on table public.households to anon;

-- Household administration.
grant select, update on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select on table public.household_invites to authenticated;

-- Household-scoped application data. Existing RLS policies determine which rows
-- each authenticated user may read or change.
grant select, insert, update, delete on table
  public.accounts,
  public.transactions,
  public.categories,
  public.transaction_allocations,
  public.merchant_rules,
  public.monthly_budgets,
  public.recurring_items,
  public.planned_items,
  public.audit_events,
  public.imports,
  public.source_documents,
  public.import_rows,
  public.import_errors,
  public.category_groups,
  public.expected_income_sources,
  public.budget_templates,
  public.expected_income_matches
to authenticated;

grant select on table public.sync_runs to authenticated;
grant select on table public.connection_health to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Provider credentials must only be accessed through trusted server code.
revoke all privileges on table public.financial_connections from anon, authenticated;
grant all privileges on table public.financial_connections to service_role;
