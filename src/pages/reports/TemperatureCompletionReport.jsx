import { useEffect, useMemo, useState } from 'react'

import ReportFilter from '../../components/reports/ReportFilter'
import ReportStatus from '../../components/reports/ReportStatus'
import { supabase } from '../../lib/supabase'
import { dateRangeDefault, formatDate, getLocalDate } from '../../utils/date'

function TemperatureCompletionReport() {

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
        .eq('task_type', 'temperature')
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


    const result =
      await supabase
        .from('temperature_logs')
        .select(
          'store_id, task_type_id, log_date'
        )
        .gte('log_date', from)
        .lte('log_date', to)
        .in(
          'store_id',
          selectedStoreIds
        )


    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }


    const completionSet =
      new Set()


    for (
      const row of result.data || []
    ) {

      completionSet.add(
        `${row.store_id}|${row.log_date}|${row.task_type_id}`
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


          /*
            Temperature report ONLY looks at
            temperature tasks.

            This is deliberately separate from
            manager checklist completion.
          */

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
    setSelectedSummary({
      storeName: row.storeName,
      date: row.date,
      period,
      status: row[period],
      logs: [],
    })
    setSummaryLoading(true)
    setSummaryError('')

    const periodTasks = tasks.filter(task => task.time_period === period)
    const taskResults = await Promise.all(periodTasks.map(async task => {
      const logResult = await supabase
        .from('temperature_logs')
        .select('*')
        .eq('store_id', row.storeId)
        .eq('task_type_id', task.id)
        .eq('log_date', row.date)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (logResult.error) throw logResult.error
      if (!logResult.data) return { task, log: null, readings: [] }

      const readingsResult = await supabase
        .from('temperature_readings')
        .select('*')
        .eq('temperature_log_id', logResult.data.id)
        .order('created_at')

      if (readingsResult.error) throw readingsResult.error
      return { task, log: logResult.data, readings: readingsResult.data || [] }
    }))

    try {
      setSelectedSummary(prev => prev ? { ...prev, logs: taskResults } : prev)
    } catch (error) {
      setSummaryError(error.message || 'Unable to load the entered temperature data.')
    } finally {
      setSummaryLoading(false)
    }
  }


  return (
    <div>

      <div className="report-section-heading">

        <div>

          <h2>
            Temperature Log Completion
          </h2>

          <p>
            AM, PM and Evening temperature logs
            are tracked independently.
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
                    No temperature records found.
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
        <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedSummary(null)
        }}>
          <section className="report-modal report-modal-wide" role="dialog" aria-modal="true" aria-labelledby="report-summary-title">
            <div className="report-modal-header">
              <div>
                <div className="eyebrow">Entered data</div>
                <h2 id="report-summary-title">Temperature Log Details</h2>
                <p className="modal-subtitle">{selectedSummary.storeName} · {formatDate(selectedSummary.date)} · {selectedSummary.period}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedSummary(null)} aria-label="Close summary">×</button>
            </div>
            <div className="report-summary-content">
              {summaryLoading && <div className="summary-loading">Loading entered temperature data…</div>}
              {summaryError && <div className="error-box">{summaryError}</div>}
              {!summaryLoading && !summaryError && selectedSummary.logs.map(({ task, log, readings }) => (
                <div className="summary-record" key={task.id}>
                  <div className="summary-record-header">
                    <div><strong>{task.name}</strong><span>{task.time_period}</span></div>
                    <ReportStatus status={log ? '✓' : 'NC'} />
                  </div>
                  {log ? (
                    <>
                      <table className="report-table report-summary-table">
                        <tbody>
                          <tr><th>Completed by</th><td>{log.submitted_by_name || '—'}</td></tr>
                          <tr><th>Log date</th><td>{formatDate(log.log_date)}</td></tr>
                          <tr><th>Submitted</th><td>{log.submitted_at ? new Date(log.submitted_at).toLocaleString() : '—'}</td></tr>
                          <tr><th>Notes</th><td>{log.notes || '—'}</td></tr>
                        </tbody>
                      </table>
                      <div className="summary-subheading">Temperature readings</div>
                      <div className="report-table-wrapper">
                        <table className="report-table report-summary-table">
                          <thead><tr><th>Item</th><th>Temperature</th><th>Expected Range</th><th>Status</th><th>Corrective Action</th><th>Notes</th></tr></thead>
                          <tbody>{readings.map(reading => (
                            <tr key={reading.id}>
                              <td>{reading.item_name}</td>
                              <td>{reading.temperature ?? '—'}{reading.unit ? ` ${reading.unit}` : ''}</td>
                              <td>{reading.min_temp_at_time ?? '—'} – {reading.max_temp_at_time ?? '—'}</td>
                              <td><ReportStatus status={reading.acceptable ? '✓' : 'NC'} /></td>
                              <td>{reading.corrective_action || '—'}</td>
                              <td>{reading.notes || '—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </>
                  ) : <div className="summary-empty">No log was entered for this task.</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default TemperatureCompletionReport
