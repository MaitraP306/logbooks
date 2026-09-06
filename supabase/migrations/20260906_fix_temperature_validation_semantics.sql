-- Fix temperature validation semantics.
-- Operating ranges are alert thresholds: out-of-range readings must be recordable
-- when corrective action is supplied. Configured input ranges remain optional
-- schema constraints controlled by Settings.

-- Existing seeded rules previously copied the operating range into the
-- enforce_range fields. Disable that default so an employee can record readings
-- outside the operating range. Preserve any administrator-customized ranges.
update public.temperature_log_field_rules r
set enforce_range = false,
    updated_at = now()
where r.field_key like 'temperature:%'
  and exists (
    select 1
    from public.temperature_items ti
    where ti.id = r.temperature_item_id
      and r.min_value is not distinct from ti.min_temp
      and r.max_value is not distinct from ti.max_temp
  );

-- Numeric values can contain insignificant trailing zeroes (for example 4.00).
-- Treat 4.00 as zero meaningful decimal places when a field allows one decimal
-- place. This matches what the HTML number input displays to the employee.
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
  v_fraction text;
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
      where ti.store_id = v_store_id
        and ti.name = new.item_name
      order by ti.active desc, ti.created_at desc nulls last
      limit 1
    );

  if r.id is not null then
    if coalesce(r.required, false) and new.temperature is null then
      raise exception 'Temperature is required for %.', new.item_name
        using errcode = '23514';
    end if;

    -- enforce_range is a schema/input-range rule, not the operating-range alert.
    -- When enabled by an administrator, it is still authoritative.
    if new.temperature is not null and coalesce(r.enforce_range, false) then
      if r.min_value is not null and new.temperature < r.min_value then
        raise exception '% must be at least %.', new.item_name, r.min_value
          using errcode = '23514';
      end if;
      if r.max_value is not null and new.temperature > r.max_value then
        raise exception '% must be at most %.', new.item_name, r.max_value
          using errcode = '23514';
      end if;
    end if;

    if new.temperature is not null
       and r.field_type = 'integer'
       and new.temperature <> trunc(new.temperature) then
      raise exception '% must be a whole number.', new.item_name
        using errcode = '23514';
    end if;

    if new.temperature is not null and r.decimal_places is not null then
      v_text := trim(new.temperature::text);
      if position('.' in v_text) > 0 then
        v_fraction := trim(trailing '0' from split_part(v_text, '.', 2));
        if char_length(v_fraction) > r.decimal_places then
          raise exception '% allows at most % decimal place(s). Enter a value such as 4 or 4.5.',
            new.item_name, r.decimal_places
            using errcode = '23514';
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
