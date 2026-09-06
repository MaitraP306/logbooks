import { supabase } from '../lib/supabase'

export const DEFAULT_FIELD_RULES = {
  submitted_by_name: {
    fieldKey: 'submitted_by_name',
    fieldLabel: 'Completed by',
    fieldType: 'text',
    required: true,
    minLength: 1,
    maxLength: 120,
  },
  log_date: {
    fieldKey: 'log_date',
    fieldLabel: 'Log date',
    fieldType: 'date',
    required: true,
  },
  notes: {
    fieldKey: 'notes',
    fieldLabel: 'Notes',
    fieldType: 'text',
    required: false,
    minLength: 0,
    maxLength: 2000,
  },
}

function normalizeRule(row) {
  return {
    id: row.id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label,
    fieldType: row.field_type || 'number',
    required: row.required === true,
    enforceRange: row.enforce_range === true,
    minValue: row.min_value === null || row.min_value === undefined ? '' : Number(row.min_value),
    maxValue: row.max_value === null || row.max_value === undefined ? '' : Number(row.max_value),
    decimalPlaces: row.decimal_places === null || row.decimal_places === undefined ? 1 : Number(row.decimal_places),
    minLength: row.min_length === null || row.min_length === undefined ? '' : Number(row.min_length),
    maxLength: row.max_length === null || row.max_length === undefined ? '' : Number(row.max_length),
    minDate: row.min_date || '',
    maxDate: row.max_date || '',
    temperatureItemId: row.temperature_item_id || null,
  }
}

export async function getTemperatureFieldRules(storeId) {
  const { data, error } = await supabase
    .from('temperature_log_field_rules')
    .select('*')
    .eq('store_id', storeId)
    .order('field_label')

  if (error) return { data: [], error }

  return {
    data: (data || []).map(normalizeRule),
    error: null,
  }
}

export function rulesByKey(rules) {
  return Object.fromEntries((rules || []).map(rule => [rule.fieldKey, rule]))
}

export function defaultTemperatureRule(item) {
  return {
    fieldKey: `temperature:${item.id}`,
    fieldLabel: item.name,
    fieldType: 'number',
    required: item.required !== false,
    enforceRange: false,
    minValue: Number(item.min_temp ?? -40),
    maxValue: Number(item.max_temp ?? 250),
    decimalPlaces: 1,
    temperatureItemId: item.id,
  }
}

export function buildRulePayload(storeId, rule) {
  return {
    store_id: storeId,
    field_key: rule.fieldKey,
    field_label: rule.fieldLabel,
    field_type: rule.fieldType,
    required: Boolean(rule.required),
    enforce_range: Boolean(rule.enforceRange),
    min_value: rule.minValue === '' ? null : Number(rule.minValue),
    max_value: rule.maxValue === '' ? null : Number(rule.maxValue),
    decimal_places: rule.decimalPlaces === '' ? null : Number(rule.decimalPlaces),
    min_length: rule.minLength === '' ? null : Number(rule.minLength),
    max_length: rule.maxLength === '' ? null : Number(rule.maxLength),
    min_date: rule.minDate || null,
    max_date: rule.maxDate || null,
    temperature_item_id: rule.temperatureItemId || null,
    updated_at: new Date().toISOString(),
  }
}

export function validateTemperatureValue(rawValue, rule, label) {
  if (rawValue === undefined || rawValue === '') {
    return rule.required ? `${label} is required.` : null
  }

  if (rule.fieldType === 'number' || rule.fieldType === 'integer') {
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return `${label} must be a valid number.`
    if (rule.fieldType === 'integer' && !Number.isInteger(value)) return `${label} must be a whole number.`

    if (rule.decimalPlaces !== '' && rule.decimalPlaces !== undefined) {
      const text = String(rawValue).trim()
      const fraction = text.includes('.') ? text.split('.')[1].replace(/0+$/, '') : ''
      const decimals = fraction.length
      if (decimals > Number(rule.decimalPlaces)) {
        return `${label} allows at most ${rule.decimalPlaces} decimal place(s). Enter a value such as 4 or 4.5.`
      }
    }

    if (rule.enforceRange) {
      if (rule.minValue !== '' && value < Number(rule.minValue)) return `${label} must be at least ${rule.minValue}.`
      if (rule.maxValue !== '' && value > Number(rule.maxValue)) return `${label} must be at most ${rule.maxValue}.`
    }
  }

  return null
}

export function validateTemperatureMetadata({ employeeName, logDate, notes }, rules) {
  const errors = []
  const nameRule = rules.submitted_by_name || DEFAULT_FIELD_RULES.submitted_by_name
  const dateRule = rules.log_date || DEFAULT_FIELD_RULES.log_date
  const notesRule = rules.notes || DEFAULT_FIELD_RULES.notes

  const name = employeeName?.trim() || ''
  const noteText = notes?.trim() || ''

  if (nameRule.required && !name) errors.push('Completed by is required.')
  if (name && nameRule.minLength !== '' && name.length < Number(nameRule.minLength)) errors.push(`Completed by must contain at least ${nameRule.minLength} characters.`)
  if (name && nameRule.maxLength !== '' && name.length > Number(nameRule.maxLength)) errors.push(`Completed by must contain at most ${nameRule.maxLength} characters.`)

  if (dateRule.required && !logDate) errors.push('Log date is required.')
  if (logDate && dateRule.minDate && logDate < dateRule.minDate) errors.push(`Log date cannot be before ${dateRule.minDate}.`)
  if (logDate && dateRule.maxDate && logDate > dateRule.maxDate) errors.push(`Log date cannot be after ${dateRule.maxDate}.`)

  if (notesRule.required && !noteText) errors.push('Notes are required.')
  if (noteText && notesRule.minLength !== '' && noteText.length < Number(notesRule.minLength)) errors.push(`Notes must contain at least ${notesRule.minLength} characters.`)
  if (noteText && notesRule.maxLength !== '' && noteText.length > Number(notesRule.maxLength)) errors.push(`Notes must contain at most ${notesRule.maxLength} characters.`)

  return errors
}
