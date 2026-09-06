-- Temperature operating ranges are alert thresholds, not hard input limits.
-- Out-of-range readings are valid and require a corrective action.
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
  v_min numeric;
  v_max numeric;
  v_acceptable boolean;
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

  select ti.min_temp, ti.max_temp
    into v_min, v_max
  from public.temperature_items ti
  where ti.store_id = v_store_id and ti.name = new.item_name
  order by ti.active desc, ti.created_at desc nulls last
  limit 1;

  if r.id is not null then
    if coalesce(r.required, false) and new.temperature is null then
      raise exception 'Temperature is required for %.' , new.item_name using errcode = '23514';
    end if;

    -- Do NOT reject an operating-range violation. It is an expected exception
    -- workflow and must be saved so corrective action can be recorded.
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

  if new.temperature is not null and v_min is not null and v_max is not null then
    v_acceptable := new.temperature >= v_min and new.temperature <= v_max;
    if not v_acceptable and nullif(trim(coalesce(new.corrective_action, '')), '') is null then
      raise exception 'Corrective action is required for out-of-range temperature %.', new.item_name using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS enforce_temperature_reading_rules ON public.temperature_readings;
CREATE TRIGGER enforce_temperature_reading_rules
BEFORE INSERT OR UPDATE ON public.temperature_readings
FOR EACH ROW EXECUTE FUNCTION public.enforce_temperature_reading_rules();
