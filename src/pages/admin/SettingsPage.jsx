import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSetting, saveAdminSetting } from '../../utils/adminSettings'
import {
  buildRulePayload,
  defaultTemperatureRule,
  getTemperatureFieldRules,
  rulesByKey,
  DEFAULT_FIELD_RULES,
} from '../../utils/temperatureRules'

const metadataOrder = ['submitted_by_name', 'log_date', 'notes']

const metadataDefaults = {
  submitted_by_name: DEFAULT_FIELD_RULES.submitted_by_name,
  log_date: DEFAULT_FIELD_RULES.log_date,
  notes: DEFAULT_FIELD_RULES.notes,
}

function SettingsPage() {
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [items, setItems] = useState([])
  const [rules, setRules] = useState({})
  const [allowStoreRemoval, setAllowStoreRemoval] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingRules, setLoadingRules] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    if (selectedStoreId) loadStoreRules(selectedStoreId)
  }, [selectedStoreId])

  async function loadStores() {
    setLoading(true)
    setError('')

    const [storesResult, removalSetting] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      getAdminSetting('allow_store_removal', false),
    ])

    if (storesResult.error) {
      setError(storesResult.error.message)
      setLoading(false)
      return
    }

    const nextStores = storesResult.data || []
    setStores(nextStores)
    setAllowStoreRemoval(removalSetting === true)

    if (nextStores.length > 0) {
      setSelectedStoreId(current => current || nextStores[0].id)
    }

    setLoading(false)
  }

  async function loadStoreRules(storeId) {
    setLoadingRules(true)
    setError('')

    const [{ data: temperatureItems, error: itemsError }, { data: existingRules, error: rulesError }] = await Promise.all([
      supabase
        .from('temperature_items')
        .select('*')
        .eq('store_id', storeId)
        .order('category')
        .order('sort_order')
        .order('name'),
      getTemperatureFieldRules(storeId),
    ])

    if (itemsError) {
      setError(itemsError.message)
      setLoadingRules(false)
      return
    }
    if (rulesError) {
      setError(rulesError.message)
      setLoadingRules(false)
      return
    }

    const itemList = temperatureItems || []
    setItems(itemList)

    const byKey = rulesByKey(existingRules)
    const nextRules = {}

    metadataOrder.forEach(key => {
      nextRules[key] = byKey[key] || metadataDefaults[key]
    })

    itemList.forEach(item => {
      const fallback = defaultTemperatureRule(item)
      nextRules[fallback.fieldKey] = byKey[fallback.fieldKey] || fallback
    })

    setRules(nextRules)
    setLoadingRules(false)
  }

  function updateRule(fieldKey, changes) {
    setRules(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], ...changes },
    }))
  }

  async function saveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const validationError = validateRules(rules)
    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }

    const storeId = selectedStoreId
    const rulePayloads = Object.values(rules)
      .filter(rule => rule.fieldKey)
      .map(rule => buildRulePayload(storeId, rule))

    const [removalError, rulesResult] = await Promise.all([
      saveAdminSetting('allow_store_removal', allowStoreRemoval),
      supabase
        .from('temperature_log_field_rules')
        .upsert(rulePayloads, { onConflict: 'store_id,field_key' }),
    ])

    if (removalError || rulesResult.error) {
      setError((removalError || rulesResult.error).message)
      setSaving(false)
      return
    }

    setMessage('Settings saved for the selected store.')
    setSaving(false)
  }

  const selectedStore = useMemo(
    () => stores.find(store => store.id === selectedStoreId),
    [stores, selectedStoreId],
  )

  if (loading) {
    return <div className="admin-settings"><p>Loading settings...</p></div>
  }

  return (
    <div className="admin-settings">
      <div className="admin-section-header">
        <div>
          <div className="eyebrow">Administration</div>
          <h2>Settings</h2>
          <p>Configure store-level permissions and the validation contract for every temperature-log field.</p>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {message && <div className="success-box compact-success" role="status">{message}</div>}

      <section className="settings-card settings-permission-card">
        <div className="settings-card-copy">
          <div className="eyebrow">Store management</div>
          <h3>Allow store removal</h3>
          <p>When disabled, stores cannot be deactivated from Store Setup. Existing logs are never deleted.</p>
        </div>
        <label className="switch-control">
          <input type="checkbox" checked={allowStoreRemoval} onChange={event => setAllowStoreRemoval(event.target.checked)} />
          <span className="switch-track" aria-hidden="true"><span /></span>
          <span>{allowStoreRemoval ? 'Enabled' : 'Blocked'}</span>
        </label>
      </section>

      <section className="settings-card">
        <div className="settings-card-copy">
          <div className="eyebrow">Temperature log schema</div>
          <h3>Per-store field enforcement</h3>
          <p>Choose a store, then define the schema, required state, and permitted range independently for every user-entered field.</p>
        </div>

        <div className="settings-store-picker">
          <label htmlFor="settings-store">Store</label>
          <select id="settings-store" value={selectedStoreId} onChange={event => setSelectedStoreId(event.target.value)}>
            {stores.map(store => <option key={store.id} value={store.id}>{store.name}{store.active ? '' : ' (Inactive)'}</option>)}
          </select>
        </div>

        {loadingRules ? <div className="settings-loading">Loading fields for {selectedStore?.name || 'this store'}…</div> : (
          <form onSubmit={saveSettings}>
            <div className="settings-field-section">
              <div className="settings-section-heading">
                <div>
                  <h4>Log metadata</h4>
                  <p>Validation for fields shared by the entire temperature log.</p>
                </div>
              </div>

              <div className="field-rule-grid">
                {metadataOrder.map(key => (
                  <FieldRuleCard key={key} rule={rules[key]} onChange={changes => updateRule(key, changes)} />
                ))}
              </div>
            </div>

            <div className="settings-field-section">
              <div className="settings-section-heading">
                <div>
                  <h4>Temperature fields</h4>
                  <p>Each configured equipment/product temperature gets its own schema and value range.</p>
                </div>
                <span className="settings-count">{items.length} fields</span>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">No temperature fields are configured for this store yet.</div>
              ) : (
                <div className="temperature-rule-list">
                  {items.map(item => {
                    const key = `temperature:${item.id}`
                    return <FieldRuleCard key={key} rule={rules[key] || defaultTemperatureRule(item)} temperatureItem={item} onChange={changes => updateRule(key, changes)} />
                  })}
                </div>
              )}
            </div>

            <div className="settings-actions">
              <button className="submit-button" type="submit" disabled={saving || !selectedStoreId}>
                {saving ? 'Saving…' : 'Save Store Rules'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function FieldRuleCard({ rule, temperatureItem, onChange }) {
  const safeRule = rule || { fieldKey: '', fieldLabel: '', fieldType: 'text', required: false }
  const isNumeric = safeRule.fieldType === 'number' || safeRule.fieldType === 'integer'
  const isText = safeRule.fieldType === 'text'
  const isDate = safeRule.fieldType === 'date'

  return (
    <article className="field-rule-card">
      <div className="field-rule-header">
        <div>
          {temperatureItem && <span className="rule-category">{temperatureItem.category}</span>}
          <h5>{safeRule.fieldLabel}</h5>
          <code>{safeRule.fieldKey}</code>
        </div>
        <label className="switch-control compact-switch">
          <input type="checkbox" checked={Boolean(safeRule.required)} onChange={event => onChange({ required: event.target.checked })} />
          <span className="switch-track" aria-hidden="true"><span /></span>
          <span>{safeRule.required ? 'Required' : 'Optional'}</span>
        </label>
      </div>

      <div className="field-rule-controls">
        <div className="form-section">
          <label>Schema type</label>
          <select value={safeRule.fieldType} onChange={event => onChange({ fieldType: event.target.value })}>
            <option value="number">Decimal number</option>
            <option value="integer">Whole number</option>
            {!temperatureItem && <option value="text">Text</option>}
            {!temperatureItem && <option value="date">Date</option>}
          </select>
        </div>

        {isNumeric && (
          <>
            <label className="settings-toggle inline-toggle"><input type="checkbox" checked={Boolean(safeRule.enforceRange)} onChange={event => onChange({ enforceRange: event.target.checked })} /> Enforce value range</label>
            <div className="form-section"><label>Minimum value</label><input type="number" step="any" value={safeRule.minValue ?? ''} onChange={event => onChange({ minValue: event.target.value })} /></div>
            <div className="form-section"><label>Maximum value</label><input type="number" step="any" value={safeRule.maxValue ?? ''} onChange={event => onChange({ maxValue: event.target.value })} /></div>
            <div className="form-section"><label>Decimal places</label><input type="number" min="0" max="6" step="1" value={safeRule.decimalPlaces ?? 1} disabled={safeRule.fieldType === 'integer'} onChange={event => onChange({ decimalPlaces: event.target.value })} /></div>
          </>
        )}

        {isText && (
          <>
            <div className="form-section"><label>Minimum length</label><input type="number" min="0" step="1" value={safeRule.minLength ?? ''} onChange={event => onChange({ minLength: event.target.value })} /></div>
            <div className="form-section"><label>Maximum length</label><input type="number" min="0" step="1" value={safeRule.maxLength ?? ''} onChange={event => onChange({ maxLength: event.target.value })} /></div>
          </>
        )}

        {isDate && (
          <>
            <div className="form-section"><label>Earliest date</label><input type="date" value={safeRule.minDate || ''} onChange={event => onChange({ minDate: event.target.value })} /></div>
            <div className="form-section"><label>Latest date</label><input type="date" value={safeRule.maxDate || ''} onChange={event => onChange({ maxDate: event.target.value })} /></div>
          </>
        )}
      </div>

      <div className="rule-summary">
        <span>Effective schema</span>
        <code>{describeRule(safeRule)}</code>
      </div>
    </article>
  )
}

function describeRule(rule) {
  if (rule.fieldType === 'text') return `text | ${rule.minLength || 0}–${rule.maxLength || '∞'} chars`
  if (rule.fieldType === 'date') return `date | ${rule.minDate || 'any'} → ${rule.maxDate || 'any'}`
  if (rule.fieldType === 'integer') return `integer | ${rule.enforceRange ? `${rule.minValue} ≤ value ≤ ${rule.maxValue}` : 'any range'}`
  return `number | ${rule.enforceRange ? `${rule.minValue} ≤ value ≤ ${rule.maxValue}` : 'any range'} | max ${rule.decimalPlaces ?? 1} decimals`
}

function validateRules(rules) {
  for (const rule of Object.values(rules)) {
    if ((rule.fieldType === 'number' || rule.fieldType === 'integer') && rule.enforceRange) {
      if (rule.minValue === '' || rule.maxValue === '') return `${rule.fieldLabel}: enter both a minimum and maximum value.`
      if (Number(rule.minValue) >= Number(rule.maxValue)) return `${rule.fieldLabel}: minimum must be lower than maximum.`
    }
    if ((rule.fieldType === 'number' || rule.fieldType === 'integer') && rule.decimalPlaces !== '' && (Number(rule.decimalPlaces) < 0 || Number(rule.decimalPlaces) > 6)) return `${rule.fieldLabel}: decimal places must be between 0 and 6.`
    if (rule.fieldType === 'text' && rule.minLength !== '' && rule.maxLength !== '' && Number(rule.minLength) > Number(rule.maxLength)) return `${rule.fieldLabel}: minimum length cannot exceed maximum length.`
    if (rule.fieldType === 'date' && rule.minDate && rule.maxDate && rule.minDate > rule.maxDate) return `${rule.fieldLabel}: earliest date cannot be after latest date.`
  }
  return ''
}

export default SettingsPage
