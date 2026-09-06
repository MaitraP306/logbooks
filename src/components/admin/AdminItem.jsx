import { useEffect, useState } from 'react'

function AdminItem({
  item,
  onSave,
  onDelete
}) {

  const [name, setName] =
    useState(item.name || '')

  const [minTemp, setMinTemp] =
    useState(item.min_temp ?? '')

  const [maxTemp, setMaxTemp] =
    useState(item.max_temp ?? '')

  const [required, setRequired] =
    useState(
      item.required !== false
    )

  const [saving, setSaving] =
    useState(false)


  useEffect(() => {
    setName(item.name || '')
    setMinTemp(item.min_temp ?? '')
    setMaxTemp(item.max_temp ?? '')
    setRequired(item.required !== false)
  }, [item])


  async function save() {

    if (!name.trim()) {
      return
    }

    if (
      minTemp === '' ||
      maxTemp === ''
    ) {
      return
    }

    setSaving(true)

    await onSave(
      item,
      {
        name: name.trim(),
        min_temp: Number(minTemp),
        max_temp: Number(maxTemp),
        required
      }
    )

    setSaving(false)
  }


  return (
    <div className="admin-item">

      <div className="admin-item-main">

        <input
          className="admin-item-name"
          value={name}
          onChange={event =>
            setName(event.target.value)
          }
        />


        <div className="admin-range">

          <input
            type="number"
            step="0.1"
            value={minTemp}
            onChange={event =>
              setMinTemp(
                event.target.value
              )
            }
          />

          <span>
            –
          </span>

          <input
            type="number"
            step="0.1"
            value={maxTemp}
            onChange={event =>
              setMaxTemp(
                event.target.value
              )
            }
          />

        </div>


        <span className="admin-unit">
          {item.unit}
        </span>


        <label className="inline-checkbox">

          <input
            type="checkbox"
            checked={required}
            onChange={event =>
              setRequired(
                event.target.checked
              )
            }
          />

          Required

        </label>

      </div>


      <div className="admin-item-actions">

        <button
          className="small-button"
          onClick={save}
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : 'Save'}
        </button>


        <button
          className="delete-button"
          onClick={() =>
            onDelete(item)
          }
        >
          Remove
        </button>

      </div>

    </div>
  )
}

export default AdminItem
