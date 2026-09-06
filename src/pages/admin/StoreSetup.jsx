import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSetting } from '../../utils/adminSettings'
import { buildRulePayload, DEFAULT_FIELD_RULES } from '../../utils/temperatureRules'

function StoreSetup() {
  const [stores, setStores] = useState([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [allowRemoval, setAllowRemoval] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    const [storesResult, setting] = await Promise.all([
      supabase.from('stores').select('*').order('active', { ascending: false }).order('name'),
      getAdminSetting('allow_store_removal', false),
    ])

    if (storesResult.error) setError(storesResult.error.message)
    else setStores(storesResult.data || [])
    setAllowRemoval(setting === true)
    setLoading(false)
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

      setStores(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
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

  return (
    <div className="admin-panel-stack admin-store-setup">
      <div className="admin-section-header">
        <div>
          <h2>Store Setup</h2>
          <p>Create locations and manage their active status.</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box compact-success">{message}</div>}

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
              <div className={`store-management-row ${store.active ? '' : 'inactive'}`} key={store.id}>
                <div>
                  <strong>{store.name}</strong>
                  <span>{store.active ? 'Active' : 'Inactive'}</span>
                </div>
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
    </div>
  )
}

export default StoreSetup
