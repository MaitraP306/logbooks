-- Atomically create a temperature log and all of its readings.
-- If either the log insert or any reading fails, PostgreSQL rolls the whole
-- transaction back. This prevents empty/partial logs from being created.

create or replace function public.submit_temperature_log(
  p_store_id uuid,
  p_task_type_id uuid,
  p_log_date date,
  p_submitted_by_name text,
  p_notes text,
  p_readings jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_reading jsonb;
  v_item_name text;
  v_temperature numeric;
  v_unit text;
  v_min numeric;
  v_max numeric;
  v_acceptable boolean;
  v_corrective_action text;
  v_notes text;
begin
  if exists (
    select 1
    from public.temperature_logs
    where store_id = p_store_id
      and task_type_id = p_task_type_id
      and log_date = p_log_date
  ) then
    raise exception 'A temperature log already exists for this store, task, and date.'
      using errcode = '23505';
  end if;

  insert into public.temperature_logs (
    store_id,
    task_type_id,
    log_date,
    submitted_by_name,
    notes
  ) values (
    p_store_id,
    p_task_type_id,
    p_log_date,
    p_submitted_by_name,
    p_notes
  )
  returning id into v_log_id;

  for v_reading in
    select value from jsonb_array_elements(coalesce(p_readings, '[]'::jsonb))
  loop
    v_item_name := nullif(trim(v_reading->>'item_name'), '');
    v_temperature := nullif(v_reading->>'temperature', '')::numeric;
    v_unit := coalesce(v_reading->>'unit', 'C');
    v_min := nullif(v_reading->>'min_temp_at_time', '')::numeric;
    v_max := nullif(v_reading->>'max_temp_at_time', '')::numeric;
    v_acceptable := coalesce((v_reading->>'acceptable')::boolean, true);
    v_corrective_action := nullif(trim(v_reading->>'corrective_action'), '');
    v_notes := nullif(v_reading->>'notes', '');

    if v_item_name is null then
      raise exception 'A temperature reading is missing its item name.' using errcode = '23514';
    end if;

    if v_temperature is null then
      raise exception '% must have a temperature value.', v_item_name using errcode = '23514';
    end if;

    -- Operating range is an alert threshold, not an input restriction.
    -- Out-of-range values are deliberately accepted when corrective action exists.
    if v_min is not null and v_max is not null then
      v_acceptable := v_temperature >= v_min and v_temperature <= v_max;
      if not v_acceptable and v_corrective_action is null then
        raise exception 'Corrective action is required for % because % is outside the operating range.',
          v_item_name, v_item_name using errcode = '23514';
      end if;
    end if;

    insert into public.temperature_readings (
      temperature_log_id,
      item_name,
      temperature,
      unit,
      min_temp_at_time,
      max_temp_at_time,
      acceptable,
      corrective_action,
      notes
    ) values (
      v_log_id,
      v_item_name,
      v_temperature,
      v_unit,
      v_min,
      v_max,
      v_acceptable,
      v_corrective_action,
      v_notes
    );
  end loop;

  return v_log_id;
end;
$$;

grant execute on function public.submit_temperature_log(uuid, uuid, date, text, text, jsonb)
to anon, authenticated;
