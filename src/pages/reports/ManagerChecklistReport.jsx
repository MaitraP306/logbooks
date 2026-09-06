import { useEffect, useMemo, useState } from 'react'

import ReportFilter from '../../components/reports/ReportFilter'
import ReportStatus from '../../components/reports/ReportStatus'
import { supabase } from '../../lib/supabase'
import { dateRangeDefault, formatDate, getLocalDate } from '../../utils/date'
import { isMissingTableError } from '../../utils/errors'

function ManagerChecklistReport() {

  const [stores, setStores] =
    useState([])

  const [tasks, setTasks] =
    useState([])

  const [selectedStore, setSelectedStore] =
    useState('all')

  const [fromDate, setFromDate] =
    useState(dateRangeDefault())

  const [toDate, setToDate] =
    useState(getLocalDate())

  const [rows, setRows] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [initialLoading, setInitialLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [selectedSummary, setSelectedSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')


  useEffect(() => {
    loadFilters()
    // Initial report filters are loaded once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  async function loadFilters() {

    setInitialLoading(true)
    setError('')


    const [
      storesResult,
      tasksResult
    ] = await Promise.all([

      supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name'),

      supabase
        .from('task_types')
        .select('*')
        .eq('active', true)
        .neq(
          'task_type',
          'temperature'
        )
        .order('sort_order')

    ])


    if (storesResult.error) {
      setError(storesResult.error.message)
      setInitialLoading(false)
      return
    }


    if (tasksResult.error) {
      setError(tasksResult.error.message)
      setInitialLoading(false)
      return
    }


    const loadedStores =
      storesResult.data || []

    const loadedTasks =
      tasksResult.data || []


    setStores(loadedStores)
    setTasks(loadedTasks)

    setInitialLoading(false)


    loadReport(
      loadedStores,
      loadedTasks,
      'all',
      fromDate,
      toDate
    )
  }


  async function loadReport(
    loadedStores = stores,
    loadedTasks = tasks,
    storeFilter = selectedStore,
    from = fromDate,
    to = toDate
  ) {

    if (!from || !to) {
      setError(
        'Please select both dates.'
      )
      return
    }


    if (from > to) {
      setError(
        'From date cannot be after To date.'
      )
      return
    }


    setLoading(true)
    setError('')


    const selectedStoreIds =
      storeFilter === 'all'
        ? loadedStores.map(
            store => store.id
          )
        : [storeFilter]


    if (
      selectedStoreIds.length === 0
    ) {
      setRows([])
      setLoading(false)
      return
    }


    const [
      checklistResult,
      genericResult
    ] = await Promise.all([

      supabase
        .from('checklist_submissions')
        .select(
          'store_id, task_type_id, log_date'
        )
        .gte('log_date', from)
        .lte('log_date', to)
        .in(
          'store_id',
          selectedStoreIds
        ),

      supabase
        .from('task_completions')
        .select(
          'store_id, task_type_id, completion_date'
        )
        .gte(
          'completion_date',
          from
        )
        .lte(
          'completion_date',
          to
        )
        .in(
          'store_id',
          selectedStoreIds
        )

    ])


    if (
      checklistResult.error &&
      !isMissingTableError(
        checklistResult.error
      )
    ) {
      setError(
        checklistResult.error.message
      )
      setLoading(false)
      return
    }


    if (
      genericResult.error &&
      !isMissingTableError(
        genericResult.error
      )
    ) {
      setError(
        genericResult.error.message
      )
      setLoading(false)
      return
    }


    const completionSet =
      new Set()


    for (
      const row
      of checklistResult.data || []
    ) {

      completionSet.add(
        `${row.store_id}|${row.log_date}|${row.task_type_id}`
      )
    }


    for (
      const row
      of genericResult.data || []
    ) {

      completionSet.add(
        `${row.store_id}|${row.completion_date}|${row.task_type_id}`
      )
    }


    const dateRows = []


    let cursor =
      new Date(
        `${from}T00:00:00`
      )

    const end =
      new Date(
        `${to}T00:00:00`
      )


    while (cursor <= end) {

      const year =
        cursor.getFullYear()

      const month =
        String(
          cursor.getMonth() + 1
        ).padStart(2, '0')

      const day =
        String(
          cursor.getDate()
        ).padStart(2, '0')


      const dateString =
        `${year}-${month}-${day}`


      for (
        const storeId
        of selectedStoreIds
      ) {

        const store =
          loadedStores.find(
            current =>
              current.id === storeId
          )


        const periodValues = {}


        for (
          const period of [
            'AM',
            'PM',
            'EVENING'
          ]
        ) {

          const periodTasks =
            loadedTasks.filter(
              task =>
                task.time_period ===
                period
            )


          const complete =
            periodTasks.length > 0 &&
            periodTasks.every(task =>
              completionSet.has(
                `${storeId}|${dateString}|${task.id}`
              )
            )


          periodValues[period] =
            complete
              ? '✓'
              : 'NC'
        }


        dateRows.push({
          date: dateString,
          storeId,
          storeName:
            store?.name || '',
          ...periodValues
        })
      }


      cursor.setDate(
        cursor.getDate() + 1
      )
    }


    setRows(dateRows)
    setLoading(false)
  }


  const stats =
    useMemo(() => {

      const total =
        rows.length * 3

      const completed =
        rows.reduce(
          (count, row) =>
            count +
            (row.AM === '✓'
              ? 1
              : 0) +
            (row.PM === '✓'
              ? 1
              : 0) +
            (row.EVENING === '✓'
              ? 1
              : 0),
          0
        )


      return {
        total,
        completed,
        percentage:
          total === 0
            ? 0
            : Math.round(
                completed /
                total *
                100
              )
      }

    }, [rows])


  async function openSummary(row, period) {
    setSelectedSummary({ storeName: row.storeName, date: row.date, period, status: row[period], records: [] })
    setSummaryLoading(true)
    setSummaryError('')

    try {
      const periodTasks = tasks.filter(task => task.time_period === period)
      const records = await Promise.all(periodTasks.map(async task => {
        const submissionResult = await supabase.from('checklist_submissions').select('*').eq('store_id', row.storeId).eq('task_type_id', task.id).eq('log_date', row.date).order('submitted_at', { ascending: false }).limit(1).maybeSingle()
        if (submissionResult.error && !isMissingTableError(submissionResult.error)) throw submissionResult.error
        if (!submissionResult.data) {
          const completionResult = await supabase.from('task_completions').select('*').eq('store_id', row.storeId).eq('task_type_id', task.id).eq('completion_date', row.date).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (completionResult.error && !isMissingTableError(completionResult.error)) throw completionResult.error
          return { task, submission: null, answers: [], completion: completionResult.data || null }
        }
        const answersResult = await supabase.from('checklist_answers').select('*').eq('submission_id', submissionResult.data.id).order('created_at')
        if (answersResult.error && !isMissingTableError(answersResult.error)) throw answersResult.error
        const itemsResult = await supabase
          .from('checklist_items')
          .select('*')
          .eq('task_type_id', task.id)
          .eq('active', true)
          .order('sort_order')
          .order('created_at')
        if (itemsResult.error && !isMissingTableError(itemsResult.error)) throw itemsResult.error
        return { task, submission: submissionResult.data, answers: answersResult.data || [], items: itemsResult.data || [], completion: null }
      }))
      setSelectedSummary(prev => prev ? { ...prev, records } : prev)
    } catch (error) {
      setSummaryError(error.message || 'Unable to load the entered checklist data.')
    } finally {
      setSummaryLoading(false)
    }
  }


  return (
    <div>

      <div className="report-section-heading">

        <div>

          <h2>
            Manager Checklist Completion
          </h2>

          <p>
            Manager walkthroughs and other
            checklist tasks are reported here.
          </p>

        </div>

      </div>


      <ReportFilter
        stores={stores}
        selectedStore={selectedStore}
        setSelectedStore={
          setSelectedStore
        }
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        onApply={() =>
          loadReport()
        }
        loading={loading}
      />


      {error && (
        <div className="error-box">
          {error}
        </div>
      )}


      {!initialLoading && (

        <div className="completion-score">

          <div>

            <span>
              Completion Score
            </span>

            <strong>
              {stats.percentage}%
            </strong>

          </div>

          <div className="score-detail">
            {stats.completed}/
            {stats.total} slots
          </div>

        </div>

      )}


      <div className="report-card">

        <div className="report-table-wrapper">

          <table className="report-table">

            <thead>

              <tr>

                <th>
                  Date
                </th>

                <th>
                  AM
                </th>

                <th>
                  PM
                </th>

                <th>
                  Evening
                </th>

              </tr>

            </thead>


            <tbody>

              {rows.map(row => (

                <tr
                  key={
                    `${row.storeId}-${row.date}`
                  }
                >

                  <td>

                    <strong>
                      {formatDate(
                        row.date
                      )}
                    </strong>

                    {selectedStore ===
                      'all' && (

                      <small>
                        {row.storeName}
                      </small>

                    )}

                  </td>


                  <td>
                    <button
                      type="button"
                      className="report-status-button"
                      onClick={() => openSummary(row, 'AM')}
                      aria-label={`View AM summary for ${row.storeName || 'store'} on ${formatDate(row.date)}`}
                    >
                      <ReportStatus status={row.AM} />
                    </button>
                  </td>


                  <td>
                    <button
                      type="button"
                      className="report-status-button"
                      onClick={() => openSummary(row, 'PM')}
                      aria-label={`View PM summary for ${row.storeName || 'store'} on ${formatDate(row.date)}`}
                    >
                      <ReportStatus status={row.PM} />
                    </button>
                  </td>


                  <td>
                    <button
                      type="button"
                      className="report-status-button"
                      onClick={() => openSummary(row, 'EVENING')}
                      aria-label={`View EVENING summary for ${row.storeName || 'store'} on ${formatDate(row.date)}`}
                    >
                      <ReportStatus status={row.EVENING} />
                    </button>
                  </td>

                </tr>

              ))}


              {rows.length === 0 && (

                <tr>

                  <td
                    colSpan="4"
                    className="empty-table"
                  >
                    No manager checklist records
                    found.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>


      <div className="report-legend">

        <span className="legend-complete">
          ✓ Complete
        </span>

        <span className="legend-missing">
          NC = Not Complete
        </span>

      </div>


      {selectedSummary && (
        <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSummary(null) }}>
          <section className="report-modal report-modal-wide" role="dialog" aria-modal="true" aria-labelledby="report-summary-title">
            <div className="report-modal-header">
              <div><div className="eyebrow">Entered data</div><h2 id="report-summary-title">Manager Checklist Details</h2><p className="modal-subtitle">{selectedSummary.storeName} · {formatDate(selectedSummary.date)} · {selectedSummary.period}</p></div>
              <button type="button" className="modal-close" onClick={() => setSelectedSummary(null)} aria-label="Close summary">×</button>
            </div>
            <div className="report-summary-content">
              {summaryLoading && <div className="summary-loading">Loading entered checklist data…</div>}
              {summaryError && <div className="error-box">{summaryError}</div>}
              {!summaryLoading && !summaryError && selectedSummary.records.map(({ task, submission, answers, items, completion }) => (
                <div className="summary-record" key={task.id}>
                  <div className="summary-record-header"><div><strong>{task.name}</strong><span>{task.time_period}</span></div><ReportStatus status={submission || completion ? '✓' : 'NC'} /></div>
                  {submission ? (
                    <>
                      <table className="report-table report-summary-table"><tbody>
                        <tr><th>Completed by</th><td>{submission.submitted_by_name || '—'}</td></tr>
                        <tr><th>Log date</th><td>{formatDate(submission.log_date)}</td></tr>
                        <tr><th>Submitted</th><td>{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}</td></tr>
                        <tr><th>Notes</th><td>{submission.notes || '—'}</td></tr>
                      </tbody></table>
                      <div className="summary-subheading">Question responses</div>
                      <div className="report-table-wrapper"><table className="report-table report-summary-table"><thead><tr><th>Question</th><th>Response</th><th>Notes</th></tr></thead><tbody>
                        {answers.map(answer => { const item = items.find(current => current.id === answer.checklist_item_id); return <tr key={answer.id}><td>{item?.question || item?.name || 'Question'}</td><td><strong>{answer.answer || '—'}</strong></td><td>{answer.notes || '—'}</td></tr> })}
                      </tbody></table></div>
                    </>
                  ) : completion ? <div className="summary-empty">Task completed without a checklist submission record. Completion record: {completion.completion_date || selectedSummary.date || '—'}.</div> : <div className="summary-empty">No data was entered for this task.</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default ManagerChecklistReport
