import { supabase } from '../lib/supabase'

export const DEFAULT_TEMPERATURE_RULES = {
  enforceSchema: true,
  enforceRange: true,
  minValue: -40,
  maxValue: 250,
  decimalPlaces: 1,
  requireEmployeeName: true,
  requireLogDate: true,
}

export const DEFAULT_ADMIN_SETTINGS = {
  allowStoreRemoval: false,
  temperatureRules: DEFAULT_TEMPERATURE_RULES,
}

export async function getAdminSetting(key, fallback) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error || !data) {
    return fallback
  }

  return data.value ?? fallback
}

export async function saveAdminSetting(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  return error
}

export function normalizeTemperatureRules(value) {
  return {
    ...DEFAULT_TEMPERATURE_RULES,
    ...(value || {}),
    minValue: Number(value?.minValue ?? DEFAULT_TEMPERATURE_RULES.minValue),
    maxValue: Number(value?.maxValue ?? DEFAULT_TEMPERATURE_RULES.maxValue),
    decimalPlaces: Number(value?.decimalPlaces ?? DEFAULT_TEMPERATURE_RULES.decimalPlaces),
  }
}
