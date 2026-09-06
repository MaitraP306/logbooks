-- Logbooks admin configuration and checklist option support.
-- Run this migration in the Supabase SQL editor before using the new admin controls.

alter table public.checklist_items
  add column if not exists options jsonb not null default '["Yes", "No", "N/A"]'::jsonb;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values
  ('allow_store_removal', 'false'::jsonb),
  ('temperature_rules', '{"enforceSchema":true,"enforceRange":true,"minValue":-40,"maxValue":250,"decimalPlaces":1,"requireEmployeeName":true,"requireLogDate":true}'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Authenticated admins can manage these settings. If your project later adds
-- role-based authorization, tighten this policy to the admin role.
drop policy if exists "authenticated can read app settings" on public.app_settings;
drop policy if exists "authenticated can write app settings" on public.app_settings;

create policy "authenticated can read app settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "authenticated can write app settings"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

-- Operational pages are currently public in Logbooks. Allow them to read only
-- the temperature validation configuration without exposing write access.
drop policy if exists "public can read temperature rules" on public.app_settings;
create policy "public can read temperature rules"
  on public.app_settings for select
  to anon
  using (key = 'temperature_rules');
