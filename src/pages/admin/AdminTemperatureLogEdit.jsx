import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { defaultTemperatureRule, getTemperatureFieldRules, rulesByKey, validateTemperatureMetadata, validateTemperatureValue } from '../../utils/temperatureRules'

function AdminTemperatureLogEdit() {

  const { logId } = useParams()

  const navigate = useNavigate()
  const location = useLocation()
  const isNewLog = !logId || logId === 'new' || logId === 'undefined' || logId === 'null'

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

  function getNewLogContext() {
    const params = new URLSearchParams(location.search)
    const queryStoreId = params.get('storeId')
    const queryTaskTypeId = params.get('taskTypeId') || params.get('task_type_id')
    const queryDate = params.get('date') || ''

    return {
      storeId: queryStoreId && queryStoreId !== 'undefined' ? queryStoreId : store?.id,
      taskTypeId: queryTaskTypeId && queryTaskTypeId !== 'undefined' ? queryTaskTypeId : task?.id,
      date: queryDate || logDate,
    }
  }

  function isValidUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }


  useEffect(() => {
    loadLog()
    // loadLog is intentionally keyed by the log route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId, location.search])


  async function loadLog() {
    setLoading(true)
    setError('')

    if (isNewLog) {
      const { storeId, taskTypeId, date: requestedDate } = getNewLogContext()

      if (!isValidUuid(storeId) || !isValidUuid(taskTypeId) || !requestedDate) {
        setError('This incomplete temperature log is missing a valid store, temperature period, or date. Return to Edit Temperature Logs and select Enter Log again.')
        setLoading(false)
        return
      }

      const [storeResult, taskResult, itemsResult, rulesResult] = await Promise.all([
        supabase.from('stores').select('*').eq('id', storeId).maybeSingle(),
        supabase.from('task_types').select('*').eq('id', taskTypeId).maybeSingle(),
        supabase.from('temperature_items').select('*').eq('store_id', storeId).order('category').order('sort_order').order('name'),
        getTemperatureFieldRules(storeId),
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
      if (itemsResult.error) {
        setError(itemsResult.error.message)
        setLoading(false)
        return
      }
      if (rulesResult.error && !rulesResult.error.message?.includes('does not exist')) {
        setError(rulesResult.error.message)
        setLoading(false)
        return
      }
      if (!storeResult.data || !taskResult.data) {
        setError('The selected store or temperature period could not be found.')
        setLoading(false)
        return
      }

      const itemList = itemsResult.data || []
      const ruleMap = rulesByKey(rulesResult.data || [])
      itemList.forEach(item => {
        const fallback = defaultTemperatureRule(item)
        if (!ruleMap[fallback.fieldKey]) ruleMap[fallback.fieldKey] = fallback
      })

      setStore(storeResult.data)
      setTask(taskResult.data)
      setLogDate(requestedDate)
      setEmployeeName('')
      setNotes('')
      setTemperatureItems(itemList)
      setTemperatureRules(ruleMap)
      setReadings(itemList.map((item, index) => ({
        id: `new-${item.id}-${index}`,
        item_name: item.name,
        temperature: '',
        unit: item.unit === '°F' || item.unit === 'F' ? 'F' : 'C',
        min_temp_at_time: item.min_temp,
        max_temp_at_time: item.max_temp,
        acceptable: true,
        corrective_action: '',
        notes: '',
      })))
      setLoading(false)
      return
    }

    const logResult = await supabase
      .from('temperature_logs')
      .select('*')
      .eq('id', logId)
      .maybeSingle()

    if (logResult.error) {
      // A stale/missing log id should never be treated as an existing row.
      // If the route contains create context, fall back to the new-log flow.
      if ((logId === 'undefined' || logId === 'null') && location.search) {
        const params = new URLSearchParams(location.search)
        navigate(`/admin/temperature/new?${params.toString()}`, { replace: true })
        return
      }
      setError(logResult.error.message)
      setLoading(false)
      return
    }
    if (!logResult.data) {
      const { storeId, taskTypeId, date } = getNewLogContext()
      if (isValidUuid(storeId) && isValidUuid(taskTypeId) && date) {
        const params = new URLSearchParams(location.search)
        navigate(`/admin/temperature/new?${params.toString()}`, { replace: true })
        return
      }
      setError('Temperature log not found, and there is not enough information to create the missing log. Return to Edit Temperature Logs and select Enter Log again.')
      setLoading(false)
      return
    }

    const currentLog = logResult.data
    setLogDate(currentLog.log_date)
    setEmployeeName(currentLog.submitted_by_name || '')
    setNotes(currentLog.notes || '')

    const [storeResult, taskResult, readingsResult] = await Promise.all([
      supabase.from('stores').select('*').eq('id', currentLog.store_id).maybeSingle(),
      supabase.from('task_types').select('*').eq('id', currentLog.task_type_id).maybeSingle(),
      supabase.from('temperature_readings').select('*').eq('temperature_log_id', logId).order('created_at'),
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
    setStore(storeResult.data)
    setTask(taskResult.data)
    setReadings(readingsResult.data || [])
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

    const payloadReadings = []

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
        const minTemp = Number(item.min_temp)
        const maxTemp = Number(item.max_temp)
        const acceptable = temperature >= minTemp && temperature <= maxTemp
        const correctiveAction = (reading?.corrective_action || '').trim()

        if (!acceptable && !correctiveAction) {
          setError(`Corrective action is required for ${item.name} because the temperature is outside the operating range.`)
          return
        }

        payloadReadings.push({
          item_name: item.name,
          temperature,
          unit: item.unit === '°F' || item.unit === 'F' ? 'F' : 'C',
          min_temp_at_time: minTemp,
          max_temp_at_time: maxTemp,
          acceptable,
          corrective_action: correctiveAction || null,
          notes: reading?.notes || null,
        })
      }
    }


    if (payloadReadings.length === 0) {
      setError('Enter at least one temperature reading before saving the log.')
      return
    }

    setSaving(true)

    if (isNewLog) {
      const { storeId, taskTypeId } = getNewLogContext()

      if (!isValidUuid(storeId) || !isValidUuid(taskTypeId)) {
        setError('This temperature log cannot be saved because the store or temperature period is missing or invalid. No data was written. Return to Edit Temperature Logs and select Enter Log again.')
        setSaving(false)
        return
      }

      const { data: newLogId, error: submitError } = await supabase.rpc(
        'submit_temperature_log',
        {
          p_store_id: storeId,
          p_task_type_id: taskTypeId,
          p_log_date: logDate,
          p_submitted_by_name: employeeName.trim(),
          p_notes: notes.trim() || null,
          p_readings: payloadReadings,
        }
      )

      if (submitError) {
        if (submitError.code === '23505') {
          setError('A temperature log already exists for this store, period, and date. Refresh the list and edit the existing log instead.')
        } else if (submitError.code === '23514') {
          setError((submitError.message || 'The temperature log could not be saved.').replace(/^.*?ERROR:\s*/i, '').trim())
        } else {
          setError(submitError.message || 'The temperature log could not be saved. No data was written.')
        }
        setSaving(false)
        return
      }

      if (!newLogId) {
        setError('The temperature log could not be saved. No data was written.')
        setSaving(false)
        return
      }

      setSaving(false)
      navigate(`/admin/temperature/${newLogId}`)
      return
    }


    // Never update a placeholder/missing row. If the requested log no longer exists,
    // use the same atomic create path as an incomplete log instead.
    if (!isValidUuid(logId)) {
      setError('This temperature log does not have a valid record ID. Return to Edit Temperature Logs and select Enter Log again.')
      setSaving(false)
      return
    }

    const { data: existingLog, error: existingLogError } = await supabase
      .from('temperature_logs')
      .select('id')
      .eq('id', logId)
      .maybeSingle()

    if (existingLogError) {
      setError(existingLogError.message)
      setSaving(false)
      return
    }

    if (!existingLog) {
      const fallbackStoreId = store?.id
      const fallbackTaskTypeId = task?.id

      if (!isValidUuid(fallbackStoreId) || !isValidUuid(fallbackTaskTypeId)) {
        setError('This temperature log no longer exists and its store or temperature period could not be identified. Return to Edit Temperature Logs and select Enter Log again.')
        setSaving(false)
        return
      }

      const { data: newLogId, error: createError } = await supabase.rpc(
        'submit_temperature_log',
        {
          p_store_id: fallbackStoreId,
          p_task_type_id: fallbackTaskTypeId,
          p_log_date: logDate,
          p_submitted_by_name: employeeName.trim(),
          p_notes: notes.trim() || null,
          p_readings: payloadReadings,
        }
      )

      if (createError) {
        if (createError.code === '23505') {
          setError('A temperature log already exists for this store, period, and date. Refresh the list and edit the existing log instead.')
        } else {
          setError(createError.message || 'The missing temperature log could not be created. No data was written.')
        }
        setSaving(false)
        return
      }

      if (!newLogId) {
        setError('The missing temperature log could not be created. No data was written.')
        setSaving(false)
        return
      }

      setSaving(false)
      navigate(`/admin/temperature/${newLogId}`)
      return
    }

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
            {isNewLog ? 'Enter Temperature Log' : 'Edit Temperature Log'}
          </h1>

          <p className="subtitle">
            {store?.name} ·{' '}
            {task?.time_period}
            {isNewLog && ' · Not completed'}
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
