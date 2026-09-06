import { useEffect, useMemo, useState } from 'react'

const DEFAULT_OPTIONS = ['Yes', 'No', 'N/A']

function normalizeOptions(options) {
  if (!Array.isArray(options)) return DEFAULT_OPTIONS
  const clean = options.map(value => String(value).trim()).filter(Boolean)
  return clean.length ? [...new Set(clean)] : DEFAULT_OPTIONS
}

function AdminChecklistQuestion({ item, index, onSave, onDelete }) {
  const [name, setName] = useState(item.name || '')
  const [description, setDescription] = useState(item.description || '')
  const [required, setRequired] = useState(item.required !== false)
  const [options, setOptions] = useState(normalizeOptions(item.options))
  const [newOption, setNewOption] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(item.name || '')
    setDescription(item.description || '')
    setRequired(item.required !== false)
    setOptions(normalizeOptions(item.options))
  }, [item])

  const optionPreview = useMemo(() => options.join(' · '), [options])

  function addOption(event) {
    event.preventDefault()
    const value = newOption.trim()
    if (!value || options.includes(value)) return
    setOptions(prev => [...prev, value])
    setNewOption('')
  }

  function removeOption(option) {
    if (options.length <= 1) return
    setOptions(prev => prev.filter(value => value !== option))
  }

  function moveOption(indexToMove, direction) {
    const target = indexToMove + direction
    if (target < 0 || target >= options.length) return
    setOptions(prev => {
      const next = [...prev]
      ;[next[indexToMove], next[target]] = [next[target], next[indexToMove]]
      return next
    })
  }

  async function save() {
    if (!name.trim() || options.length === 0) return
    setSaving(true)
    await onSave(item, {
      name: name.trim(),
      description: description.trim() || null,
      required,
      options,
    })
    setSaving(false)
  }

  return (
    <article className="question-admin-card">
      <div className="question-admin-topline">
        <div className="question-admin-number">{String(index + 1).padStart(2, '0')}</div>
        <div className="question-admin-title">
          <strong>{name || 'Untitled question'}</strong>
          <span>{required ? 'Required' : 'Optional'} · {options.length} options</span>
        </div>
        <div className="question-admin-actions">
          <button type="button" className="small-button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="delete-button" onClick={() => onDelete(item)}>Remove</button>
        </div>
      </div>

      <div className="question-admin-fields">
        <div className="form-section full-width-field">
          <label>Question</label>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Is the prep area clean?" />
        </div>

        <div className="form-section">
          <label>Description / instructions</label>
          <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional guidance for the manager" rows="2" />
        </div>

        <label className="settings-toggle question-required-toggle">
          <input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />
          Response required
        </label>
      </div>

      <div className="question-options-editor">
        <div className="question-options-header">
          <div>
            <h4>Response options</h4>
            <p>Define exactly what the employee can select for this question.</p>
          </div>
          <code>{optionPreview}</code>
        </div>

        <div className="question-options-list">
          {options.map((option, optionIndex) => (
            <div className="question-option-row" key={`${option}-${optionIndex}`}>
              <span className="question-option-index">{optionIndex + 1}</span>
              <input value={option} onChange={event => setOptions(prev => prev.map((value, i) => i === optionIndex ? event.target.value : value))} />
              <button type="button" className="icon-button" onClick={() => moveOption(optionIndex, -1)} disabled={optionIndex === 0} aria-label="Move option up">↑</button>
              <button type="button" className="icon-button" onClick={() => moveOption(optionIndex, 1)} disabled={optionIndex === options.length - 1} aria-label="Move option down">↓</button>
              <button type="button" className="icon-button danger-icon" onClick={() => removeOption(option)} disabled={options.length <= 1} aria-label={`Remove ${option}`}>×</button>
            </div>
          ))}
        </div>

        <form className="add-option-row" onSubmit={addOption}>
          <input value={newOption} onChange={event => setNewOption(event.target.value)} placeholder="Add an option…" />
          <button type="submit" className="small-button">+ Add option</button>
        </form>
      </div>
    </article>
  )
}

export default AdminChecklistQuestion
