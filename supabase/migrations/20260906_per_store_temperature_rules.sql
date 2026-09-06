-- Per-store, per-field validation for temperature logs + admin mutation policies.
-- Run once in Supabase SQL Editor.

alter table public.checklist_items
  add column if not exists options jsonb not null default '["Yes", "No", "N/A"]'::jsonb;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('allow_store_removal', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.temperature_log_field_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  field_key text not null,
  field_label text not null,
  field_type text not null default 'number'
    check (field_type in ('number', 'integer', 'text', 'date')),
  required boolean not null default false,
  enforce_range boolean not null default false,
  min_value numeric,
  max_value numeric,
  decimal_places integer,
  min_length integer,
  max_length integer,
  min_date date,
  max_date date,
  temperature_item_id uuid references public.temperature_items(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (store_id, field_key)
);

create index if not exists temperature_log_field_rules_store_idx
  on public.temperature_log_field_rules(store_id);

create index if not exists temperature_log_field_rules_item_idx
  on public.temperature_log_field_rules(temperature_item_id);

-- Seed metadata fields for every existing store.
insert into public.temperature_log_field_rules
  (store_id, field_key, field_label, field_type, required, min_length, max_length)
select id, 'submitted_by_name', 'Completed by', 'text', true, 1, 120
from public.stores
on conflict (store_id, field_key) do nothing;

insert into public.temperature_log_field_rules
  (store_id, field_key, field_label, field_type, required)
select id, 'log_date', 'Log date', 'date', true
from public.stores
on conflict (store_id, field_key) do nothing;

insert into public.temperature_log_field_rules
  (store_id, field_key, field_label, field_type, required, min_length, max_length)
select id, 'notes', 'Notes', 'text', false, 0, 2000
from public.stores
on conflict (store_id, field_key) do nothing;

-- Seed one numeric rule for every existing temperature field.
insert into public.temperature_log_field_rules
  (store_id, field_key, field_label, field_type, required,
   enforce_range, min_value, max_value, decimal_places, temperature_item_id)
select
  ti.store_id,
  'temperature:' || ti.id::text,
  ti.name,
  'number',
  coalesce(ti.required, true),
  true,
  coalesce(ti.min_temp, -40),
  coalesce(ti.max_temp, 250),
  1,
  ti.id
from public.temperature_items ti
on conflict (store_id, field_key) do nothing;

alter table public.temperature_log_field_rules enable row level security;
alter table public.app_settings enable row level security;

grant select on public.temperature_log_field_rules to anon, authenticated;
grant insert, update, delete on public.temperature_log_field_rules to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant select, insert, update on public.stores to authenticated;
grant select, insert, update, delete on public.task_types to authenticated;
grant select, insert, update, delete on public.temperature_items to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;

-- The employee-facing app needs to read rules; only authenticated users can modify them.
drop policy if exists "temperature rules readable by everyone" on public.temperature_log_field_rules;
create policy "temperature rules readable by everyone"
  on public.temperature_log_field_rules for select
  to anon, authenticated
  using (true);

drop policy if exists "authenticated can manage temperature rules" on public.temperature_log_field_rules;
create policy "authenticated can manage temperature rules"
  on public.temperature_log_field_rules for all
  to authenticated
  using (true)
  with check (true);

-- Admin settings are private to authenticated users, except store-removal state is read by the admin UI only.
drop policy if exists "authenticated can read app settings" on public.app_settings;
create policy "authenticated can read app settings"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "authenticated can write app settings" on public.app_settings;
create policy "authenticated can write app settings"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

-- The existing employee UI is public, but admin configuration mutations require authentication.
drop policy if exists "authenticated can manage stores" on public.stores;
create policy "authenticated can manage stores"
  on public.stores for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can manage task types" on public.task_types;
create policy "authenticated can manage task types"
  on public.task_types for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can manage temperature items" on public.temperature_items;
create policy "authenticated can manage temperature items"
  on public.temperature_items for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated can manage checklist items" on public.checklist_items;
create policy "authenticated can manage checklist items"
  on public.checklist_items for all
  to authenticated
  using (true)
  with check (true);

-- Trigger-based enforcement makes the configured rules authoritative even if the frontend is bypassed.
create or replace function public.enforce_temperature_log_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.temperature_log_field_rules%rowtype;
  v_len integer;
begin
  select * into r
  from public.temperature_log_field_rules
  where store_id = new.store_id and field_key = 'submitted_by_name';

  if coalesce(r.required, false) and nullif(trim(new.submitted_by_name), '') is null then
    raise exception 'Completed by name is required for this store.' using errcode = '23514';
  end if;
  if new.submitted_by_name is not null then
    v_len := char_length(new.submitted_by_name);
    if r.min_length is not null and v_len < r.min_length then
      raise exception 'Completed by name is shorter than the configured minimum.' using errcode = '23514';
    end if;
    if r.max_length is not null and v_len > r.max_length then
      raise exception 'Completed by name exceeds the configured maximum length.' using errcode = '23514';
    end if;
  end if;

  select * into r
  from public.temperature_log_field_rules
  where store_id = new.store_id and field_key = 'log_date';

  if coalesce(r.required, false) and new.log_date is null then
    raise exception 'Log date is required for this store.' using errcode = '23514';
  end if;
  if new.log_date is not null then
    if r.min_date is not null and new.log_date < r.min_date then
      raise exception 'Log date is earlier than the configured minimum.' using errcode = '23514';
    end if;
    if r.max_date is not null and new.log_date > r.max_date then
      raise exception 'Log date is later than the configured maximum.' using errcode = '23514';
    end if;
  end if;

  select * into r
  from public.temperature_log_field_rules
  where store_id = new.store_id and field_key = 'notes';

  if coalesce(r.required, false) and nullif(trim(new.notes), '') is null then
    raise exception 'Notes are required for this store.' using errcode = '23514';
  end if;
  if new.notes is not null then
    v_len := char_length(new.notes);
    if r.min_length is not null and v_len < r.min_length then
      raise exception 'Notes are shorter than the configured minimum.' using errcode = '23514';
    end if;
    if r.max_length is not null and v_len > r.max_length then
      raise exception 'Notes exceed the configured maximum length.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_temperature_log_rules on public.temperature_logs;
create trigger enforce_temperature_log_rules
before insert or update on public.temperature_logs
for each row execute function public.enforce_temperature_log_rules();

create or replace function public.enforce_temperature_reading_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  r public.temperature_log_field_rules%rowtype;
  v_text text;
  v_decimals integer;
begin
  select store_id into v_store_id
  from public.temperature_logs
  where id = new.temperature_log_id;

  select * into r
  from public.temperature_log_field_rules
  where store_id = v_store_id
    and field_key = (
      select 'temperature:' || ti.id::text
      from public.temperature_items ti
      where ti.store_id = v_store_id and ti.name = new.item_name
      order by ti.active desc, ti.created_at desc nulls last
      limit 1
    );

  if r.id is not null then
    if coalesce(r.required, false) and new.temperature is null then
      raise exception 'Temperature is required for %.' , new.item_name using errcode = '23514';
    end if;
    if new.temperature is not null and coalesce(r.enforce_range, false) then
      if r.min_value is not null and new.temperature < r.min_value then
        raise exception '% must be at least %.', new.item_name, r.min_value using errcode = '23514';
      end if;
      if r.max_value is not null and new.temperature > r.max_value then
        raise exception '% must be at most %.', new.item_name, r.max_value using errcode = '23514';
      end if;
    end if;
    if new.temperature is not null and r.field_type = 'integer' and new.temperature <> trunc(new.temperature) then
      raise exception '% must be an integer.', new.item_name using errcode = '23514';
    end if;
    if new.temperature is not null and r.decimal_places is not null then
      v_text := trim(new.temperature::text);
      if position('.' in v_text) > 0 then
        v_decimals := char_length(split_part(v_text, '.', 2));
        if v_decimals > r.decimal_places then
          raise exception '% allows at most % decimal place(s).', new.item_name, r.decimal_places using errcode = '23514';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_temperature_reading_rules on public.temperature_readings;
create trigger enforce_temperature_reading_rules
before insert or update on public.temperature_readings
for each row execute function public.enforce_temperature_reading_rules();
