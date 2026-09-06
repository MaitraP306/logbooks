import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import TemperatureRow from '../components/TemperatureRow'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../utils/date'
import { isMissingTableError } from '../utils/errors'
import { defaultTemperatureRule, getTemperatureFieldRules, rulesByKey, validateTemperatureMetadata, validateTemperatureValue } from '../utils/temperatureRules'

function TaskPage() {

  const {
    id,
    taskType,
    timePeriod,
    mode
  } = useParams()

  const navigate = useNavigate()


  const [store, setStore] = useState(null)
  const [task, setTask] = useState(null)

  const [items, setItems] = useState([])

  const [existingLog, setExistingLog] =
    useState(null)

  const [existingReadings, setExistingReadings] =
    useState([])

  const [existingSubmission, setExistingSubmission] =
    useState(null)

  const [checklistItems, setChecklistItems] =
    useState([])

  const [checklistAnswers, setChecklistAnswers] =
    useState({})

  const [employeeName, setEmployeeName] =
    useState('')

  const [temperatures, setTemperatures] =
    useState({})

  const [correctiveActions, setCorrectiveActions] =
    useState({})

  const [notes, setNotes] =
    useState('')

  const [logDate, setLogDate] =
    useState(getLocalDate())

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [saved, setSaved] =
    useState(false)

  const [error, setError] =
    useState('')

  const [temperatureRules, setTemperatureRules] = useState({})


  useEffect(() => {
    loadForm()
    // loadForm is intentionally keyed by the task route parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    taskType,
    timePeriod,
    mode
  ])


  async function loadForm() {

    setLoading(true)
    setError('')

    setExistingLog(null)
    setExistingSubmission(null)
    setExistingReadings([])
    setChecklistItems([])


    const storeResult =
      await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single()

    if (storeResult.error) {
      setError(storeResult.error.message)
      setLoading(false)
      return
    }

    setStore(storeResult.data)


    const taskResult =
      await supabase
        .from('task_types')
        .select('*')
        .eq('task_type', taskType)
        .eq('time_period', timePeriod)
        .eq('active', true)
        .maybeSingle()


    if (taskResult.error) {
      setError(taskResult.error.message)
      setLoading(false)
      return
    }


    if (!taskResult.data) {
      setError('The requested task could not be found.')
      setLoading(false)
      return
    }


    setTask(taskResult.data)


    /* =====================================================
       TEMPERATURE
    ===================================================== */

    if (taskType === 'temperature') {

      const itemResult =
        await supabase
          .from('temperature_items')
          .select('*')
          .eq('store_id', id)
          .eq('active', true)
          .order('category')
          .order('sort_order')
          .order('name')


      if (itemResult.error) {
        setError(itemResult.error.message)
        setLoading(false)
        return
      }


      const temperatureItems = itemResult.data || []
      setItems(temperatureItems)

      const rulesResult = await getTemperatureFieldRules(id)
      const ruleMap = rulesByKey(rulesResult.data || [])
      temperatureItems.forEach(item => {
        const fallback = defaultTemperatureRule(item)
        if (!ruleMap[fallback.fieldKey]) ruleMap[fallback.fieldKey] = fallback
      })
      if (rulesResult.error && !isMissingTableError(rulesResult.error)) {
        setError(rulesResult.error.message)
        setLoading(false)
        return
      }
      setTemperatureRules(ruleMap)


      /*
        COMPLETE MODE
        We start a new log.
      */

      if (mode === 'complete') {

        setLogDate(getLocalDate())
        setEmployeeName('')
        setTemperatures({})
        setCorrectiveActions({})
        setNotes('')

        setLoading(false)
        return
      }


      /*
        VIEW MODE

        IMPORTANT:
        Do NOT use .single() here.

        Existing logs can have zero or multiple rows.
        maybeSingle() prevents the blank-page problem.
      */

      const logResult =
        await supabase
          .from('temperature_logs')
          .select('*')
          .eq('store_id', id)
          .eq('task_type_id', taskResult.data.id)
          .order('log_date', {
            ascending: false
          })
          .order('submitted_at', {
            ascending: false
          })
          .limit(1)
          .maybeSingle()


      if (logResult.error) {
        setError(logResult.error.message)
        setLoading(false)
        return
      }


      if (!logResult.data) {
        setError(
          'No temperature log was found for this task.'
        )
        setLoading(false)
        return
      }


      setExistingLog(logResult.data)
      setLogDate(logResult.data.log_date)
      setEmployeeName(
        logResult.data.submitted_by_name || ''
      )
      setNotes(logResult.data.notes || '')


      const readingsResult =
        await supabase
          .from('temperature_readings')
          .select('*')
          .eq(
            'temperature_log_id',
            logResult.data.id
          )
          .order('created_at')


      if (readingsResult.error) {
        setError(readingsResult.error.message)
        setLoading(false)
        return
      }


      const readings =
        readingsResult.data || []

      setExistingReadings(readings)


      const tempValues = {}
      const actions = {}

      for (const reading of readings) {

        const item =
          (itemResult.data || []).find(
            current =>
              current.name ===
              reading.item_name
          )

        if (item) {
          tempValues[item.id] =
            reading.temperature
        }

        actions[reading.item_name] =
          reading.corrective_action || ''
      }


      setTemperatures(tempValues)
      setCorrectiveActions(actions)

      setLoading(false)
      return
    }


    /* =====================================================
       CHECKLIST / MANAGER WALKTHROUGH
    ===================================================== */

    const checklistResult =
      await supabase
        .from('checklist_items')
        .select('*')
        .eq('task_type_id', taskResult.data.id)
        .eq('active', true)
        .order('sort_order')
        .order('created_at')


    if (
      checklistResult.error &&
      !isMissingTableError(checklistResult.error)
    ) {
      setError(checklistResult.error.message)
      setLoading(false)
      return
    }


    setChecklistItems(
      checklistResult.data || []
    )


    if (mode === 'complete') {

      setLogDate(getLocalDate())
      setEmployeeName('')
      setChecklistAnswers({})
      setNotes('')

      setLoading(false)
      return
    }


    /*
      Find most recent submission.
    */

    const submissionResult =
      await supabase
        .from('checklist_submissions')
        .select('*')
        .eq('store_id', id)
        .eq('task_type_id', taskResult.data.id)
        .order('log_date', {
          ascending: false
        })
        .order('submitted_at', {
          ascending: false
        })
        .limit(1)
        .maybeSingle()


    if (
      submissionResult.error &&
      !isMissingTableError(submissionResult.error)
    ) {
      setError(submissionResult.error.message)
      setLoading(false)
      return
    }


    if (!submissionResult.data) {
      setError(
        'No checklist submission was found.'
      )
      setLoading(false)
      return
    }


    setExistingSubmission(
      submissionResult.data
    )

    setLogDate(
      submissionResult.data.log_date
    )

    setEmployeeName(
      submissionResult.data.submitted_by_name || ''
    )

    setNotes(
      submissionResult.data.notes || ''
    )


    const answersResult =
      await supabase
        .from('checklist_answers')
        .select('*')
        .eq(
          'submission_id',
          submissionResult.data.id
        )
        .order('created_at')


    if (
      answersResult.error &&
      !isMissingTableError(answersResult.error)
    ) {
      setError(answersResult.error.message)
      setLoading(false)
      return
    }


    const answerMap = {}

    for (const answer of answersResult.data || []) {

      answerMap[answer.checklist_item_id] = {
        answer: answer.answer || '',
        notes: answer.notes || ''
      }
    }


    setChecklistAnswers(answerMap)

    setLoading(false)
  }


  function updateTemperature(itemId, value) {

    setTemperatures(prev => ({
      ...prev,
      [itemId]: value
    }))
  }


  function updateCorrectiveAction(
    itemId,
    value
  ) {

    const item =
      items.find(current =>
        current.id === itemId
      )

    const key =
      item?.name || itemId

    setCorrectiveActions(prev => ({
      ...prev,
      [key]: value
    }))
  }


  function updateChecklistAnswer(
    itemId,
    answer
  ) {

    setChecklistAnswers(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        answer
      }
    }))
  }


  function updateChecklistNotes(
    itemId,
    value
  ) {

    setChecklistAnswers(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        notes: value
      }
    }))
  }


  /* =====================================================
     TEMPERATURE SUBMIT
  ===================================================== */

  async function submitTemperatureLog(event) {

    event.preventDefault()

    setError('')


    const metadataErrors = validateTemperatureMetadata(
      { employeeName, logDate, notes },
      temperatureRules
    )
    if (metadataErrors.length > 0) {
      setError(metadataErrors[0])
      return
    }

    for (const item of items) {
      const rule = temperatureRules[`temperature:${item.id}`] || defaultTemperatureRule(item)
      const rawValue = temperatures[item.id]
      const missing = rawValue === undefined || rawValue === ''
      if (missing && rule.required) {
        setError(`${item.name} is required.`)
        return
      }
      if (!missing) {
        const validationError = validateTemperatureValue(rawValue, rule, item.name)
        if (validationError) {
          setError(validationError)
          return
        }
      }
    }


    setSaving(true)


    /*
      COMPLETE = insert.
      ADMIN EDIT = update.
    */

    if (
      mode === 'edit' &&
      existingLog
    ) {

      const {
        error: logUpdateError
      } = await supabase
        .from('temperature_logs')
        .update({
          log_date: logDate,
          submitted_by_name:
            employeeName.trim(),
          notes:
            notes.trim() || null
        })
        .eq('id', existingLog.id)


      if (logUpdateError) {
        setError(logUpdateError.message)
        setSaving(false)
        return
      }


      /*
        Update each existing reading.

        This preserves:
        min_temp_at_time
        max_temp_at_time

        unless the admin is changing the actual
        reading record.
      */

      for (const item of items) {

        const value =
          temperatures[item.id]

        if (
          value === undefined ||
          value === ''
        ) {
          continue
        }


        const temperature =
          Number(value)

        const minTemp =
          Number(item.min_temp)

        const maxTemp =
          Number(item.max_temp)

        const acceptable =
          temperature >= minTemp &&
          temperature <= maxTemp

        const existingReading =
          existingReadings.find(
            reading =>
              reading.item_name === item.name
          )


        const payload = {
          item_name: item.name,
          temperature,
          unit:
            item.unit === '°F' ||
            item.unit === 'F'
              ? 'F'
              : 'C',
          acceptable,
          min_temp_at_time:
            Number(
              existingReading?.min_temp_at_time ??
              minTemp
            ),
          max_temp_at_time:
            Number(
              existingReading?.max_temp_at_time ??
              maxTemp
            ),
          corrective_action:
            correctiveActions[item.name] ||
            null
        }


        if (existingReading) {

          const { error } =
            await supabase
              .from('temperature_readings')
              .update(payload)
              .eq('id', existingReading.id)


          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }

        } else {

          const { error } =
            await supabase
              .from('temperature_readings')
              .insert({
                temperature_log_id:
                  existingLog.id,
                ...payload
              })


          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }
        }
      }


      setSaved(true)
      setSaving(false)
      return
    }


    /*
      Normal new submission.
    */

    const taskResult =
      task


    const existingResult =
      await supabase
        .from('temperature_logs')
        .select('id')
        .eq('store_id', id)
        .eq(
          'task_type_id',
          taskResult.id
        )
        .eq('log_date', logDate)
        .limit(1)
        .maybeSingle()


    if (existingResult.error) {
      setError(existingResult.error.message)
      setSaving(false)
      return
    }


    if (existingResult.data) {
      setError(
        'A temperature log already exists for this store, task, and date.'
      )
      setSaving(false)
      return
    }


    const {
      data: log,
      error: logError
    } = await supabase
      .from('temperature_logs')
      .insert({
        store_id: id,
        task_type_id: taskResult.id,
        log_date: logDate,
        submitted_by_name:
          employeeName.trim(),
        notes:
          notes.trim() || null
      })
      .select()
      .single()


    if (logError) {
      setError(logError.message)
      setSaving(false)
      return
    }


    const readings =
      items
        .filter(item =>
          temperatures[item.id] !== undefined &&
          temperatures[item.id] !== ''
        )
        .map(item => {

          const temperature =
            Number(
              temperatures[item.id]
            )

          const minTemp =
            Number(item.min_temp)

          const maxTemp =
            Number(item.max_temp)

          return {
            temperature_log_id: log.id,
            item_name: item.name,
            temperature,
            unit:
              item.unit === '°F' ||
              item.unit === 'F'
                ? 'F'
                : 'C',
            min_temp_at_time: minTemp,
            max_temp_at_time: maxTemp,
            acceptable:
              temperature >= minTemp &&
              temperature <= maxTemp,
            corrective_action:
              correctiveActions[item.name] ||
              null,
            notes: null
          }
        })


    if (readings.length > 0) {

      const {
        error: readingsError
      } = await supabase
        .from('temperature_readings')
        .insert(readings)


      if (readingsError) {
        setError(readingsError.message)
        setSaving(false)
        return
      }
    }


    setSaved(true)
    setSaving(false)
  }


  /* =====================================================
     CHECKLIST SUBMIT
  ===================================================== */

  async function submitChecklist(event) {

    event.preventDefault()

    setError('')


    if (!employeeName.trim()) {
      setError('Please enter your name.')
      return
    }


    if (!logDate) {
      setError('Please select a date.')
      return
    }


    for (const item of checklistItems) {

      if (
        item.required &&
        !checklistAnswers[item.id]?.answer
      ) {

        setError(
          `Please answer: ${item.name}`
        )

        return
      }
    }


    setSaving(true)


    /*
      Admin edit of existing checklist submission.
    */

    if (
      mode === 'edit' &&
      existingSubmission
    ) {

      const {
        error: submissionError
      } = await supabase
        .from('checklist_submissions')
        .update({
          log_date: logDate,
          submitted_by_name:
            employeeName.trim(),
          notes:
            notes.trim() || null
        })
        .eq(
          'id',
          existingSubmission.id
        )


      if (submissionError) {
        setError(submissionError.message)
        setSaving(false)
        return
      }


      for (const item of checklistItems) {

        const answer =
          checklistAnswers[item.id]?.answer ||
          ''

        const answerNotes =
          checklistAnswers[item.id]?.notes ||
          ''


        const existingAnswer =
          await supabase
            .from('checklist_answers')
            .select('id')
            .eq(
              'submission_id',
              existingSubmission.id
            )
            .eq(
              'checklist_item_id',
              item.id
            )
            .maybeSingle()


        if (
          existingAnswer.error &&
          !isMissingTableError(
            existingAnswer.error
          )
        ) {
          setError(
            existingAnswer.error.message
          )
          setSaving(false)
          return
        }


        if (existingAnswer.data) {

          const { error } =
            await supabase
              .from('checklist_answers')
              .update({
                answer,
                notes:
                  answerNotes || null
              })
              .eq(
                'id',
                existingAnswer.data.id
              )


          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }

        } else {

          const { error } =
            await supabase
              .from('checklist_answers')
              .insert({
                submission_id:
                  existingSubmission.id,
                checklist_item_id:
                  item.id,
                answer,
                notes:
                  answerNotes || null
              })


          if (error) {
            setError(error.message)
            setSaving(false)
            return
          }
        }
      }


      setSaved(true)
      setSaving(false)
      return
    }


    /*
      Prevent duplicate checklist submissions.
    */

    const duplicateResult =
      await supabase
        .from('checklist_submissions')
        .select('id')
        .eq('store_id', id)
        .eq(
          'task_type_id',
          task.id
        )
        .eq('log_date', logDate)
        .limit(1)
        .maybeSingle()


    if (duplicateResult.error) {
      setError(duplicateResult.error.message)
      setSaving(false)
      return
    }


    if (duplicateResult.data) {
      setError(
        'This checklist has already been completed for this store and date.'
      )
      setSaving(false)
      return
    }


    const {
      data: submission,
      error: submissionError
    } = await supabase
      .from('checklist_submissions')
      .insert({
        store_id: id,
        task_type_id: task.id,
        log_date: logDate,
        submitted_by_name:
          employeeName.trim(),
        notes:
          notes.trim() || null
      })
      .select()
      .single()


    if (submissionError) {
      setError(submissionError.message)
      setSaving(false)
      return
    }


    const answers =
      checklistItems.map(item => ({
        submission_id:
          submission.id,
        checklist_item_id:
          item.id,
        answer:
          checklistAnswers[item.id]?.answer ||
          '',
        notes:
          checklistAnswers[item.id]?.notes ||
          null
      }))


    if (answers.length > 0) {

      const {
        error: answerError
      } = await supabase
        .from('checklist_answers')
        .insert(answers)


      if (answerError) {
        setError(answerError.message)
        setSaving(false)
        return
      }
    }


    setSaved(true)
    setSaving(false)
  }


  if (loading) {

    return (
      <main className="content">
        <p>Loading...</p>
      </main>
    )
  }


  if (!store || !task) {

    return (
      <main className="content">

        <h1>
          Task not found
        </h1>

        <Link to="/">
          ← Back to stores
        </Link>

      </main>
    )
  }


  /* =====================================================
     SUCCESS
  ===================================================== */

  if (saved) {

    return (
      <main className="content">

        <div className="success-box">

          <div className="success-icon">
            ✓
          </div>

          <h1>
            {taskType === 'temperature'
              ? 'Temperature Log Saved'
              : 'Checklist Completed'}
          </h1>

          <p>

            <strong>
              {task.name}
            </strong>

            {' '}for{' '}

            <strong>
              {store.name}
            </strong>

            {' '}has been saved for{' '}

            <strong>
              {logDate}
            </strong>.

          </p>


          <button
            className="complete-button"
            onClick={() =>
              navigate(`/store/${id}`)
            }
          >
            Back to Today's Tasks
          </button>

        </div>

      </main>
    )
  }


  /* =====================================================
     TEMPERATURE VIEW / EDIT
  ===================================================== */

  if (taskType === 'temperature') {


    /*
      View mode uses the actual saved readings.

      Edit mode uses the editable form.
    */

    if (
      mode === 'view' &&
      existingLog
    ) {

      return (
        <main className="content">

          <Link
            to={`/store/${id}`}
            className="back-link"
          >
            ← Back to Today's Tasks
          </Link>


          <div className="form-header">

            <div>

              <h1 className="page-title">
                {timePeriod} Temperature Log
              </h1>

              <p className="subtitle">
                {store.name}
              </p>

            </div>

          </div>


          <div className="submitted-by-box">

            <strong>
              Completed By:
            </strong>

            {' '}

            {existingLog.submitted_by_name ||
              'Not specified'}

          </div>


          <div className="form-section">

            <label>
              Log Date
            </label>

            <div className="submitted-value">
              {existingLog.log_date}
            </div>

          </div>


          {[
            {
              title: 'Equipment Temperatures',
              category: 'equipment'
            },
            {
              title: 'Product Temperatures',
              category: 'product'
            }
          ].map(section => {

            const readings =
              existingReadings.filter(reading => {

                const item =
                  items.find(
                    current =>
                      current.name ===
                      reading.item_name
                  )

                return (
                  item?.category ===
                  section.category
                )
              })


            return (

              <div
                key={section.category}
              >

                <div className="temperature-section-title">
                  {section.title}
                </div>


                <div className="temperature-table">

                  <div className="temperature-header">

                    <div>
                      Item
                    </div>

                    <div>
                      Normal Range
                    </div>

                    <div>
                      Reading
                    </div>

                  </div>


                  {readings.map(reading => (

                    <div
                      className="temperature-row"
                      key={reading.id}
                    >

                      <div className="temperature-name">

                        <strong>
                          {reading.item_name}
                        </strong>

                      </div>


                      <div className="temperature-range">

                        {reading.min_temp_at_time}
                        {' – '}
                        {reading.max_temp_at_time}
                        {' '}
                        °{reading.unit}

                      </div>


                      <div className="temperature-input">

                        <strong>
                          {reading.temperature}
                          °{reading.unit}
                        </strong>

                        <span
                          className={
                            reading.acceptable
                              ? 'reading-good'
                              : 'reading-warning'
                          }
                        >
                          {reading.acceptable
                            ? '✓ OK'
                            : '⚠ OUT OF RANGE'}
                        </span>


                        {reading.corrective_action && (

                          <div className="saved-corrective-action">

                            <strong>
                              Corrective Action:
                            </strong>

                            {' '}

                            {reading.corrective_action}

                          </div>

                        )}

                      </div>

                    </div>

                  ))}


                  {readings.length === 0 && (

                    <div className="empty-state">
                      No readings recorded.
                    </div>

                  )}

                </div>

              </div>

            )
          })}


          {existingLog.notes && (

            <div className="form-section">

              <label>
                Notes
              </label>

              <div className="submitted-notes">
                {existingLog.notes}
              </div>

            </div>

          )}

        </main>
      )
    }


    /*
      Complete or Admin Edit.
    */

    return (
      <main className="content">

        <Link
          to={`/store/${id}`}
          className="back-link"
        >
          ← Back to Today's Tasks
        </Link>


        <div className="form-header">

          <div>

            <h1 className="page-title">
              {timePeriod} Temperature Log
            </h1>

            <p className="subtitle">
              {store.name}
            </p>

          </div>

        </div>


        {error && (
          <div className="error-box">
            {error}
          </div>
        )}


        <form
          onSubmit={submitTemperatureLog}
          className="temperature-form"
        >

          <div className="form-section">

            <label>
              Log Date
            </label>

            <input
              type="date"
              value={logDate}
              onChange={e =>
                setLogDate(
                  e.target.value
                )
              }
            />

            <p className="form-help">
              You can select a previous date if
              entering or correcting a missing log.
            </p>

          </div>


          <div className="form-section">

            <label>
              Completed By
            </label>

            <input
              type="text"
              value={employeeName}
              onChange={e =>
                setEmployeeName(
                  e.target.value
                )
              }
              placeholder="Enter name"
            />

          </div>


          {[
            {
              title: 'Equipment Temperatures',
              category: 'equipment'
            },
            {
              title: 'Product Temperatures',
              category: 'product'
            }
          ].map(section => {

            const sectionItems =
              items.filter(
                item =>
                  item.category ===
                  section.category
              )


            return (

              <div key={section.category}>

                <div className="temperature-section-title">
                  {section.title}
                </div>


                <div className="temperature-table">

                  <div className="temperature-header">

                    <div>
                      Item
                    </div>

                    <div>
                      Normal Range
                    </div>

                    <div>
                      Temperature
                    </div>

                  </div>


                  {sectionItems.map(item => (

                    <TemperatureRow
                      key={item.id}
                      item={item}
                      value={
                        temperatures[item.id]
                      }
                      onChange={
                        updateTemperature
                      }
                      correctiveAction={
                        correctiveActions[item.name]
                      }
                      onCorrectiveActionChange={
                        updateCorrectiveAction
                      }
                      temperatureRules={temperatureRules}
                    />

                  ))}


                  {sectionItems.length === 0 && (

                    <div className="empty-state">
                      No items configured.
                    </div>

                  )}

                </div>

              </div>

            )
          })}


          <div className="form-section">

            <label>
              Notes
            </label>

            <textarea
              value={notes}
              onChange={e =>
                setNotes(e.target.value)
              }
              placeholder="Optional notes"
              rows="4"
            />

          </div>


          <button
            type="submit"
            className="submit-button"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : mode === 'edit'
                ? 'Save Temperature Changes'
                : 'Complete Temperature Log'}
          </button>

        </form>

      </main>
    )
  }


  /* =====================================================
     CHECKLIST VIEW
  ===================================================== */

  if (
    mode === 'view' &&
    existingSubmission
  ) {

    return (
      <main className="content">

        <Link
          to={`/store/${id}`}
          className="back-link"
        >
          ← Back to Today's Tasks
        </Link>


        <div className="form-header">

          <div>

            <h1 className="page-title">
              {task.name}
            </h1>

            <p className="subtitle">
              {store.name} · {timePeriod}
            </p>

          </div>

        </div>


        <div className="submitted-by-box">

          <strong>
            Completed By:
          </strong>

          {' '}

          {existingSubmission.submitted_by_name ||
            'Not specified'}

        </div>


        <div className="form-section">

          <label>
            Log Date
          </label>

          <div className="submitted-value">
            {existingSubmission.log_date}
          </div>

        </div>


        <div className="checklist-view">

          {checklistItems.map(item => {

            const answer =
              checklistAnswers[item.id]

            return (

              <div
                className="checklist-view-item"
                key={item.id}
              >

                <div>

                  <strong>
                    {item.name}
                  </strong>

                  {item.description && (
                    <p>
                      {item.description}
                    </p>
                  )}

                </div>


                <div className="checklist-answer">

                  {answer?.answer || 'No answer'}

                </div>


                {answer?.notes && (

                  <div className="checklist-answer-notes">
                    {answer.notes}
                  </div>

                )}

              </div>

            )
          })}

        </div>


        {existingSubmission.notes && (

          <div className="form-section">

            <label>
              Notes
            </label>

            <div className="submitted-notes">
              {existingSubmission.notes}
            </div>

          </div>

        )}

      </main>
    )
  }


  /* =====================================================
     CHECKLIST FORM
  ===================================================== */

  return (
    <main className="content">

      <Link
        to={`/store/${id}`}
        className="back-link"
      >
        ← Back to Today's Tasks
      </Link>


      <div className="form-header">

        <div>

          <h1 className="page-title">
            {task.name}
          </h1>

          <p className="subtitle">
            {store.name} · {timePeriod}
          </p>

        </div>

      </div>


      {error && (
        <div className="error-box">
          {error}
        </div>
      )}


      {checklistItems.length === 0 ? (

        <div className="coming-soon">

          <h2>
            Checklist Not Configured
          </h2>

          <p>
            An administrator needs to add
            checklist questions before this
            checklist can be completed.
          </p>

        </div>

      ) : (

        <form
          onSubmit={submitChecklist}
          className="checklist-form"
        >

          <div className="form-section">

            <label>
              Date
            </label>

            <input
              type="date"
              value={logDate}
              onChange={e =>
                setLogDate(
                  e.target.value
                )
              }
            />

          </div>


          <div className="form-section">

            <label>
              Completed By
            </label>

            <input
              type="text"
              value={employeeName}
              onChange={e =>
                setEmployeeName(
                  e.target.value
                )
              }
              placeholder="Enter your name"
            />

          </div>


          <div className="checklist-card">

            {checklistItems.map(
              (item, index) => (

                <div
                  className="checklist-question"
                  key={item.id}
                >

                  <div className="question-number">
                    {index + 1}
                  </div>


                  <div className="question-body">

                    <div className="question-title">

                      {item.name}

                      {item.required && (
                        <span className="required-star">
                          *
                        </span>
                      )}

                    </div>


                    {item.description && (

                      <div className="question-description">
                        {item.description}
                      </div>

                    )}


                    <div className="answer-buttons">

                      {(Array.isArray(item.options) && item.options.length > 0
                        ? item.options
                        : ['Yes', 'No', 'N/A']
                      ).map(answer => (

                        <button
                          type="button"
                          key={answer}
                          className={
                            checklistAnswers[item.id]?.answer === answer
                              ? 'answer-button selected'
                              : 'answer-button'
                          }
                          onClick={() =>
                            updateChecklistAnswer(
                              item.id,
                              answer
                            )
                          }
                        >
                          {answer}
                        </button>

                      ))}

                    </div>


                    <textarea
                      value={
                        checklistAnswers[item.id]?.notes ||
                        ''
                      }
                      onChange={e =>
                        updateChecklistNotes(
                          item.id,
                          e.target.value
                        )
                      }
                      placeholder="Optional notes"
                      rows="2"
                    />

                  </div>

                </div>

              )
            )}

          </div>


          <div className="form-section">

            <label>
              Overall Notes
            </label>

            <textarea
              value={notes}
              onChange={e =>
                setNotes(e.target.value)
              }
              placeholder="Optional notes"
              rows="4"
            />

          </div>


          <button
            type="submit"
            className="submit-button"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : mode === 'edit'
                ? 'Save Checklist Changes'
                : 'Complete Checklist'}
          </button>

        </form>

      )}

    </main>
  )
}

export default TaskPage
