import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { defaultTemperatureRule, getTemperatureFieldRules, rulesByKey, validateTemperatureMetadata, validateTemperatureValue } from '../../utils/temperatureRules'

function AdminTemperatureLogEdit() {

  const { logId } = useParams()

  const navigate = useNavigate()

  const [store, setStore] =
    useState(null)

  const [task, setTask] =
    useState(null)

  const [readings, setReadings] =
    useState([])

  const [saving, setSaving] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [logDate, setLogDate] =
    useState('')

  const [employeeName, setEmployeeName] =
    useState('')

  const [notes, setNotes] =
    useState('')

  const [temperatureRules, setTemperatureRules] = useState({})
  const [temperatureItems, setTemperatureItems] = useState([])


  useEffect(() => {
    loadLog()
    // loadLog is intentionally keyed by the log route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId])


  async function loadLog() {

    setLoading(true)
    setError('')


    const logResult =
      await supabase
        .from('temperature_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle()


    if (logResult.error) {
      setError(logResult.error.message)
      setLoading(false)
      return
    }


    if (!logResult.data) {
      setError('Temperature log not found.')
      setLoading(false)
      return
    }


    const currentLog =
      logResult.data


    setLogDate(currentLog.log_date)
    setEmployeeName(
      currentLog.submitted_by_name || ''
    )
    setNotes(
      currentLog.notes || ''
    )


    const [
      storeResult,
      taskResult,
      readingsResult
    ] = await Promise.all([

      supabase
        .from('stores')
        .select('*')
        .eq('id', currentLog.store_id)
        .maybeSingle(),

      supabase
        .from('task_types')
        .select('*')
        .eq(
          'id',
          currentLog.task_type_id
        )
        .maybeSingle(),

      supabase
        .from('temperature_readings')
        .select('*')
        .eq(
          'temperature_log_id',
          logId
        )
        .order('created_at')

    ])


    if (storeResult.error) {
      setError(storeResult.error.message)
      setLoading(false)
      return
    }


    if (taskResult.error) {
      setError(taskResult.error.message)
      setLoading(false)
      return
    }


    if (readingsResult.error) {
      setError(readingsResult.error.message)
      setLoading(false)
      return
    }


    setStore(storeResult.data)
    setTask(taskResult.data)
    setReadings(readingsResult.data || [])

    const [itemsResult, rulesResult] = await Promise.all([
      supabase.from('temperature_items').select('*').eq('store_id', currentLog.store_id).order('category').order('sort_order').order('name'),
      getTemperatureFieldRules(currentLog.store_id),
    ])

    if (itemsResult.error) {
      setError(itemsResult.error.message)
      setLoading(false)
      return
    }

    const itemList = itemsResult.data || []
    const ruleMap = rulesByKey(rulesResult.data || [])
    itemList.forEach(item => {
      const fallback = defaultTemperatureRule(item)
      if (!ruleMap[fallback.fieldKey]) ruleMap[fallback.fieldKey] = fallback
    })
    if (rulesResult.error && !rulesResult.error.message?.includes('does not exist')) {
      setError(rulesResult.error.message)
      setLoading(false)
      return
    }
    setTemperatureItems(itemList)
    setTemperatureRules(ruleMap)

    setLoading(false)
  }


  function updateReading(
    readingId,
    field,
    value
  ) {

    setReadings(prev =>
      prev.map(reading =>
        reading.id === readingId
          ? {
              ...reading,
              [field]:
                field === 'temperature'
                  ? value
                  : value
            }
          : reading
      )
    )
  }


  async function save() {

    setError('')

    const metadataErrors = validateTemperatureMetadata(
      { employeeName, logDate, notes },
      temperatureRules
    )
    if (metadataErrors.length > 0) {
      setError(metadataErrors[0])
      return
    }

    for (const item of temperatureItems) {
      const rule = temperatureRules[`temperature:${item.id}`] || defaultTemperatureRule(item)
      const reading = readings.find(current => current.item_name === item.name)
      const rawValue = reading?.temperature
      if ((rawValue === undefined || rawValue === null || rawValue === '') && rule.required) {
        setError(`${item.name} is required.`)
        return
      }
      if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
        const validationError = validateTemperatureValue(rawValue, { ...rule, enforceRange: false }, item.name)
        if (validationError) {
          setError(validationError)
          return
        }
        const temperature = Number(rawValue)
        const acceptable = temperature >= Number(item.min_temp) && temperature <= Number(item.max_temp)
        if (!acceptable && !(reading?.corrective_action || '').trim()) {
          setError(`Please document corrective action for ${item.name} because the temperature is outside the operating range.`)
          return
        }
      }
    }


    setSaving(true)


    const {
      error: logError
    } = await supabase
      .from('temperature_logs')
      .update({
        log_date: logDate,
        submitted_by_name:
          employeeName.trim() || null,
        notes:
          notes.trim() || null
      })
      .eq('id', logId)


    if (logError) {
      setError(logError.message)
      setSaving(false)
      return
    }


    for (const reading of readings) {

      const temperature =
        Number(reading.temperature)

      const minTemp =
        Number(
          reading.min_temp_at_time
        )

      const maxTemp =
        Number(
          reading.max_temp_at_time
        )

      const acceptable =
        temperature >= minTemp &&
        temperature <= maxTemp


      const { error } =
        await supabase
          .from('temperature_readings')
          .update({
            temperature,
            acceptable,
            corrective_action:
              reading.corrective_action ||
              null,
            notes:
              reading.notes ||
              null
          })
          .eq(
            'id',
            reading.id
          )


      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }


    setSaving(false)
    navigate('/admin')
  }


  if (loading) {

    return (
      <main className="content">
        <p>Loading temperature log...</p>
      </main>
    )
  }


  if (error) {

    return (
      <main className="content">

        <Link
          to="/admin"
          className="back-link"
        >
          ← Back to Admin
        </Link>

        <div className="error-box">
          {error}
        </div>

      </main>
    )
  }


  return (
    <main className="content">

      <Link
        to="/admin"
        className="back-link"
      >
        ← Back to Admin
      </Link>


      <div className="admin-header">

        <div>

          <h1 className="page-title">
            Edit Temperature Log
          </h1>

          <p className="subtitle">
            {store?.name} ·{' '}
            {task?.time_period}
          </p>

        </div>

      </div>


      <div className="admin-edit-card">

        <div className="form-section">

          <label>
            Log Date
          </label>

          <input
            type="date"
            value={logDate}
            onChange={event =>
              setLogDate(
                event.target.value
              )
            }
          />

        </div>


        <div className="form-section">

          <label>
            Completed By
          </label>

          <input
            value={employeeName}
            onChange={event =>
              setEmployeeName(
                event.target.value
              )
            }
          />

        </div>


        <div className="temperature-section-title">
          Recorded Readings
        </div>


        <div className="admin-reading-list">

          {readings.map(reading => {

            const temperature =
              Number(reading.temperature)

            const min =
              Number(
                reading.min_temp_at_time
              )

            const max =
              Number(
                reading.max_temp_at_time
              )

            const acceptable =
              temperature >= min &&
              temperature <= max

            const matchedItem = temperatureItems.find(item => item.name === reading.item_name)
            const rule = matchedItem
              ? (temperatureRules[`temperature:${matchedItem.id}`] || defaultTemperatureRule(matchedItem))
              : { fieldType: 'number', enforceRange: true, minValue: min, maxValue: max, decimalPlaces: 1 }

            return (

              <div
                className={`admin-reading-row ${!acceptable ? 'admin-reading-row-out-of-range' : ''}`}
                key={reading.id}
              >

                <div>

                  <strong>
                    {reading.item_name}
                  </strong>

                  <span>
                    Range:{' '}
                    {reading.min_temp_at_time}
                    {' – '}
                    {reading.max_temp_at_time}
                    {' '}
                    °{reading.unit}
                  </span>

                </div>


                <input
                  type="number"
                  step={rule.fieldType === 'integer' ? '1' : 10 ** -Number(rule.decimalPlaces ?? 1)}
                  value={
                    reading.temperature
                  }
                  onChange={event =>
                    updateReading(
                      reading.id,
                      'temperature',
                      event.target.value
                    )
                  }
                />


                <span
                  className={
                    acceptable
                      ? 'reading-good'
                      : 'reading-warning'
                  }
                >
                  {acceptable
                    ? '✓ OK'
                    : '⚠ OUT OF RANGE'}
                </span>


                {!acceptable && (

                  <input
                    className="corrective-action-input"
                    value={
                      reading.corrective_action ||
                      ''
                    }
                    onChange={event =>
                      updateReading(
                        reading.id,
                        'corrective_action',
                        event.target.value
                      )
                    }
                    placeholder="Corrective action"
                  />

                )}

              </div>

            )
          })}

        </div>


        <div className="form-section">

          <label>
            Notes
          </label>

          <textarea
            value={notes}
            onChange={event =>
              setNotes(
                event.target.value
              )
            }
            rows="4"
          />

        </div>


        <div className="admin-edit-actions">

          <button
            className="action-button secondary"
            onClick={() =>
              navigate('/admin')
            }
          >
            Cancel
          </button>


          <button
            className="submit-button"
            onClick={save}
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save Temperature Log'}
          </button>

        </div>

      </div>

    </main>
  )
}

export default AdminTemperatureLogEdit
