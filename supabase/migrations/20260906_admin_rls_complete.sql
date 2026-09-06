-- Complete authenticated data access required by the Logbooks admin UI.
-- Run this after the earlier Logbooks admin migrations.
--
-- NOTE: The current application protects /admin with Supabase Auth. These policies
-- therefore authorize authenticated users. When role-based admin authorization is
-- introduced, replace the USING/WITH CHECK expressions with an admin-role check.

-- The admin UI needs to read and mutate configuration and historical records.
grant select, insert, update, delete on public.stores to authenticated;
grant select, insert, update, delete on public.task_types to authenticated;
grant select, insert, update, delete on public.temperature_items to authenticated;
grant select, insert, update, delete on public.temperature_log_field_rules to authenticated;
grant select, insert, update, delete on public.temperature_logs to authenticated;
grant select, insert, update, delete on public.temperature_readings to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;
grant select, insert, update, delete on public.checklist_submissions to authenticated;
grant select, insert, update, delete on public.checklist_answers to authenticated;
grant select, insert, update, delete on public.task_completions to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;

-- Idempotently enable RLS and add a single authenticated-admin access policy.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stores',
    'task_types',
    'temperature_items',
    'temperature_log_field_rules',
    'temperature_logs',
    'temperature_readings',
    'checklist_items',
    'checklist_submissions',
    'checklist_answers',
    'task_completions',
    'app_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "authenticated admin access" on public.%I', table_name);
    execute format(
      'create policy "authenticated admin access" on public.%I for all to authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end;
$$;
