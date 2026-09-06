import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSetting } from '../../utils/adminSettings'
import { buildRulePayload, DEFAULT_FIELD_RULES, defaultTemperatureRule, getTemperatureFieldRules, rulesByKey } from '../../utils/temperatureRules'

const emptyItem = {
  name: '',
  category: 'equipment',
  unit: '°C',
  min_temp: '',
  max_temp: '',
  required: true,
  sort_order: 10,
}

function StoreSetup() {
  const [stores, setStores] = useState([])
  const [name, setName] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [items, setItems] = useState([])
  const [itemForm, setItemForm] = useState(emptyItem)
  const [editingItemId, setEditingItemId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [allowRemoval, setAllowRemoval] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selectedStoreId) loadTemperatureItems(selectedStoreId)
    else setItems([])
  }, [selectedStoreId])

  async function load() {
    setLoading(true)
    setError('')
    const [storesResult, setting] = await Promise.all([
      supabase.from('stores').select('*').order('active', { ascending: false }).order('name'),
      getAdminSetting('allow_store_removal', false),
    ])

    if (storesResult.error) setError(storesResult.error.message)
    else {
      const nextStores = storesResult.data || []
      setStores(nextStores)
      setSelectedStoreId(current => current || nextStores.find(store => store.active)?.id || nextStores[0]?.id || '')
    }
    setAllowRemoval(setting === true)
    setLoading(false)
  }

  async function loadTemperatureItems(storeId) {
    setLoadingItems(true)
    setError('')

    const { data, error: itemsError } = await supabase
      .from('temperature_items')
      .select('*')
      .eq('store_id', storeId)
      .order('category')
      .order('sort_order')
      .order('name')

    if (itemsError) setError(itemsError.message)
    else setItems(data || [])
    setLoadingItems(false)
  }

  async function createStore(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a store name.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { data, error: insertError } = await supabase
      .from('stores')
      .insert({ name: trimmed, active: true })
      .select()
      .single()

    if (insertError) setError(insertError.message)
    else {
      const defaultRules = Object.values(DEFAULT_FIELD_RULES).map(rule => buildRulePayload(data.id, rule))
      const { error: rulesError } = await supabase
        .from('temperature_log_field_rules')
        .upsert(defaultRules, { onConflict: 'store_id,field_key' })

      if (rulesError && !rulesError.message?.includes('does not exist')) {
        setError(rulesError.message)
        setSaving(false)
        return
      }

      setStores(prev => [...prev, data].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || a.name.localeCompare(b.name)))
      setSelectedStoreId(data.id)
      setName('')
      setMessage(`${trimmed} was added. Default log-field rules were created.`)
    }
    setSaving(false)
  }

  async function removeStore(store) {
    if (!allowRemoval) return
    if (!window.confirm(`Remove "${store.name}"? Existing logs will be preserved.`)) return

    setError('')
    const { error: updateError } = await supabase
      .from('stores')
      .update({ active: false })
      .eq('id', store.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setStores(prev => prev.map(item => item.id === store.id ? { ...item, active: false } : item))
  }

  function resetItemForm() {
    const nextSort = items.length ? Math.max(...items.map(item => Number(item.sort_order) || 0)) + 10 : 10
    setEditingItemId(null)
    setItemForm({ ...emptyItem, sort_order: nextSort })
  }

  function editItem(item) {
    setEditingItemId(item.id)
    setItemForm({
      name: item.name || '',
      category: item.category || 'equipment',
      unit: item.unit || '°C',
      min_temp: item.min_temp ?? '',
      max_temp: item.max_temp ?? '',
      required: item.required !== false,
      sort_order: item.sort_order ?? 10,
    })
    setError('')
    setMessage('')
  }

  async function saveTemperatureItem(event) {
    event.preventDefault()
    if (!selectedStoreId) {
      setError('Select a store before configuring temperature fields.')
      return
    }

    const trimmedName = itemForm.name.trim()
    if (!trimmedName) {
      setError('Enter a temperature item name.')
      return
    }

    if (itemForm.min_temp === '' || itemForm.max_temp === '') {
      setError('Enter both the minimum and maximum operating temperatures.')
      return
    }

    const minTemp = Number(itemForm.min_temp)
    const maxTemp = Number(itemForm.max_temp)
    if (!Number.isFinite(minTemp) || !Number.isFinite(maxTemp)) {
      setError('Operating temperatures must be valid numbers.')
      return
    }
    if (minTemp > maxTemp) {
      setError('Minimum operating temperature cannot be greater than the maximum.')
      return
    }

    setSavingItem(true)
    setError('')
    setMessage('')

    const payload = {
      store_id: selectedStoreId,
      name: trimmedName,
      category: itemForm.category,
      unit: itemForm.unit,
      min_temp: minTemp,
      max_temp: maxTemp,
      required: Boolean(itemForm.required),
      sort_order: Number(itemForm.sort_order) || 10,
      active: true,
    }

    let savedItem
    let itemError

    if (editingItemId) {
      const result = await supabase
        .from('temperature_items')
        .update(payload)
        .eq('id', editingItemId)
        .select()
        .single()
      savedItem = result.data
      itemError = result.error
    } else {
      const result = await supabase
        .from('temperature_items')
        .insert(payload)
        .select()
        .single()
      savedItem = result.data
      itemError = result.error
    }

    if (itemError) {
      setError(itemError.message)
      setSavingItem(false)
      return
    }

    const existingRulesResult = await getTemperatureFieldRules(selectedStoreId)
    const existingRules = rulesByKey(existingRulesResult.data || [])
    const rule = existingRules[`temperature:${savedItem.id}`] || defaultTemperatureRule(savedItem)
    const { error: ruleError } = await supabase
      .from('temperature_log_field_rules')
      .upsert(buildRulePayload(selectedStoreId, {
        ...rule,
        fieldLabel: savedItem.name,
        fieldType: rule.fieldType || 'number',
        required: savedItem.required !== false,
        minValue: rule.minValue,
        maxValue: rule.maxValue,
        temperatureItemId: savedItem.id,
      }), { onConflict: 'store_id,field_key' })

    if (ruleError && !ruleError.message?.includes('does not exist')) {
      setError(ruleError.message)
      setSavingItem(false)
      return
    }

    await loadTemperatureItems(selectedStoreId)
    setMessage(editingItemId ? `${savedItem.name} was updated.` : `${savedItem.name} was added to this store's temperature log.`)
    resetItemForm()
    setSavingItem(false)
  }

  async function deactivateTemperatureItem(item) {
    if (!window.confirm(`Remove "${item.name}" from this store's temperature log? Existing historical readings will be preserved.`)) return

    setError('')
    const { error: updateError } = await supabase
      .from('temperature_items')
      .update({ active: false })
      .eq('id', item.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setItems(prev => prev.map(current => current.id === item.id ? { ...current, active: false } : current))
    setMessage(`${item.name} was removed from future temperature logs. Historical readings were preserved.`)
  }

  const selectedStore = useMemo(() => stores.find(store => store.id === selectedStoreId), [stores, selectedStoreId])
  const activeItems = items.filter(item => item.active !== false)
  const inactiveItems = items.filter(item => item.active === false)

  return (
    <div className="admin-panel-stack admin-store-setup">
      <div className="admin-section-header">
        <div>
          <h2>Store Setup</h2>
          <p>Create locations and configure the temperature fields used by each store.</p>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {message && <div className="success-box compact-success" role="status">{message}</div>}

      <form className="admin-add-form store-create-form" onSubmit={createStore}>
        <div className="form-section">
          <label htmlFor="store-name">Store name</label>
          <input id="store-name" value={name} onChange={event => setName(event.target.value)} placeholder="Downtown Calgary" />
        </div>
        <div className="store-create-action">
          <button className="submit-button" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Store'}
          </button>
        </div>
      </form>

      <section className="admin-subsection">
        <div className="admin-section-header">
          <div>
            <h3>Stores</h3>
            <p>{allowRemoval ? 'Store removal is enabled in Settings.' : 'Store removal is currently blocked in Settings.'}</p>
          </div>
        </div>

        {loading ? <p>Loading stores...</p> : (
          <div className="store-management-list">
            {stores.map(store => (
              <div className={`store-management-row ${store.active ? '' : 'inactive'} ${selectedStoreId === store.id ? 'selected-store-row' : ''}`} key={store.id}>
                <button type="button" className="store-select-button" onClick={() => setSelectedStoreId(store.id)}>
                  <strong>{store.name}</strong>
                  <span>{store.active ? 'Active' : 'Inactive'}</span>
                </button>
                {store.active && (
                  <button type="button" className="delete-button" disabled={!allowRemoval} onClick={() => removeStore(store)}>
                    {allowRemoval ? 'Remove Store' : 'Removal Blocked'}
                  </button>
                )}
              </div>
            ))}
            {stores.length === 0 && <div className="empty-state">No stores configured.</div>}
          </div>
        )}
      </section>

      {selectedStore && (
        <section className="admin-subsection temperature-store-config">
          <div className="admin-section-header">
            <div>
              <div className="eyebrow">{selectedStore.name}</div>
              <h3>Temperature Log Setup</h3>
              <p>Add or edit the temperature fields that staff will see for this store.</p>
            </div>
            {editingItemId && (
              <button type="button" className="small-button" onClick={resetItemForm}>Cancel Edit</button>
            )}
          </div>

          <form className="temperature-item-form" onSubmit={saveTemperatureItem}>
            <div className="form-section">
              <label htmlFor="temperature-item-name">Item name</label>
              <input id="temperature-item-name" value={itemForm.name} onChange={event => setItemForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Walk-in Freezer" />
            </div>
            <div className="form-section">
              <label htmlFor="temperature-item-category">Category</label>
              <select id="temperature-item-category" value={itemForm.category} onChange={event => setItemForm(prev => ({ ...prev, category: event.target.value }))}>
                <option value="equipment">Equipment</option>
                <option value="product">Product</option>
              </select>
            </div>
            <div className="form-section">
              <label htmlFor="temperature-item-unit">Unit</label>
              <select id="temperature-item-unit" value={itemForm.unit} onChange={event => setItemForm(prev => ({ ...prev, unit: event.target.value }))}>
                <option value="°C">°C</option>
                <option value="°F">°F</option>
              </select>
            </div>
            <div className="form-section">
              <label htmlFor="temperature-item-sort">Sort order</label>
              <input id="temperature-item-sort" type="number" value={itemForm.sort_order} onChange={event => setItemForm(prev => ({ ...prev, sort_order: event.target.value }))} />
            </div>
            <div className="form-section">
              <label htmlFor="temperature-item-min">Normal minimum</label>
              <input id="temperature-item-min" type="number" step="0.1" value={itemForm.min_temp} onChange={event => setItemForm(prev => ({ ...prev, min_temp: event.target.value }))} placeholder="-10" />
            </div>
            <div className="form-section">
              <label htmlFor="temperature-item-max">Normal maximum</label>
              <input id="temperature-item-max" type="number" step="0.1" value={itemForm.max_temp} onChange={event => setItemForm(prev => ({ ...prev, max_temp: event.target.value }))} placeholder="0" />
            </div>
            <label className="settings-toggle temperature-required-toggle">
              <input type="checkbox" checked={itemForm.required} onChange={event => setItemForm(prev => ({ ...prev, required: event.target.checked }))} />
              Temperature is required
            </label>
            <div className="temperature-item-form-actions">
              <button type="submit" className="submit-button" disabled={savingItem}>
                {savingItem ? 'Saving...' : editingItemId ? 'Save Changes' : 'Add Temperature Field'}
              </button>
            </div>
          </form>

          {loadingItems ? <p>Loading temperature fields...</p> : (
            <>
              <div className="temperature-config-list">
                {activeItems.map(item => (
                  <div className="temperature-config-row" key={item.id}>
                    <div className="temperature-config-main">
                      <strong>{item.name}</strong>
                      <span>{item.category === 'product' ? 'Product' : 'Equipment'} · Normal range {item.min_temp} – {item.max_temp} {item.unit} · {item.required !== false ? 'Required' : 'Optional'}</span>
                    </div>
                    <div className="admin-item-actions">
                      <button type="button" className="small-button" onClick={() => editItem(item)}>Edit</button>
                      <button type="button" className="delete-button" onClick={() => deactivateTemperatureItem(item)}>Remove</button>
                    </div>
                  </div>
                ))}
                {activeItems.length === 0 && <div className="empty-state">No temperature fields configured for this store. Add the first one above.</div>}
              </div>

              {inactiveItems.length > 0 && (
                <details className="inactive-temperature-items">
                  <summary>{inactiveItems.length} removed temperature field{inactiveItems.length === 1 ? '' : 's'}</summary>
                  {inactiveItems.map(item => (
                    <div className="temperature-config-row inactive" key={item.id}>
                      <div className="temperature-config-main">
                        <strong>{item.name}</strong>
                        <span>Removed from future logs; historical readings remain available.</span>
                      </div>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default StoreSetup
