import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { dateRangeDefault, formatDate, getLocalDate } from '../../utils/date'

function enumerateDates(fromDate, toDate) {
  const dates = []
  if (!fromDate || !toDate || fromDate > toDate) return dates

  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number)
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number)
  const cursor = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay))
  const end = new Date(Date.UTC(toYear, toMonth - 1, toDay))

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function AdminTemperatureLogs() {
  const [stores, setStores] = useState([])
  const [tasks, setTasks] = useState([])
  const [logs, setLogs] = useState([])
  const [missingLogs, setMissingLogs] = useState([])
  const [selectedStore, setSelectedStore] = useState('all')
  const [selectedTask, setSelectedTask] = useState('all')
  const [fromDate, setFromDate] = useState(dateRangeDefault())
  const [toDate, setToDate] = useState(getLocalDate())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFilters()
  }, [])

  async function loadFilters() {
    const [storesResult, tasksResult] = await Promise.all([
      supabase.from('stores').select('*').eq('active', true).order('name'),
      supabase.from('task_types').select('*').eq('active', true).eq('task_type', 'temperature').order('sort_order'),
    ])

    if (storesResult.error) {
      setError(storesResult.error.message)
      return
    }
    if (tasksResult.error) {
      setError(tasksResult.error.message)
      return
    }

    setStores(storesResult.data || [])
    setTasks(tasksResult.data || [])
  }

  async function search() {
    setLoading(true)
    setError('')
    setMissingLogs([])

    if (fromDate > toDate) {
      setError('The From date cannot be after the To date.')
      setLoading(false)
      return
    }

    let query = supabase
      .from('temperature_logs')
      .select('id, store_id, task_type_id, log_date, submitted_by_name, submitted_at, notes')
      .gte('log_date', fromDate)
      .lte('log_date', toDate)
      .order('log_date', { ascending: false })
      .order('submitted_at', { ascending: false })

    if (selectedStore !== 'all') query = query.eq('store_id', selectedStore)
    if (selectedTask !== 'all') query = query.eq('task_type_id', selectedTask)

    const { data, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    const foundLogs = data || []
    setLogs(foundLogs)

    const storeList = selectedStore === 'all'
      ? stores
      : stores.filter(store => store.id === selectedStore)
    const taskList = selectedTask === 'all'
      ? tasks
      : tasks.filter(task => task.id === selectedTask)
    const existing = new Set(foundLogs.map(log => `${log.store_id}:${log.task_type_id}:${log.log_date}`))
    const missing = []

    for (const date of enumerateDates(fromDate, toDate)) {
      for (const store of storeList) {
        for (const task of taskList) {
          const key = `${store.id}:${task.id}:${date}`
          if (!existing.has(key)) {
            missing.push({
              store_id: store.id,
              task_type_id: task.id,
              log_date: date,
            })
          }
        }
      }
    }

    setMissingLogs(missing)
    setLoading(false)
  }

  function getStoreName(storeId) {
    return stores.find(store => store.id === storeId)?.name || 'Unknown Store'
  }

  function getTask(taskId) {
    return tasks.find(task => task.id === taskId)
  }

  return (
    <div>
      <div className="admin-report-filter">
        <div className="form-section">
          <label>Store</label>
          <select value={selectedStore} onChange={event => setSelectedStore(event.target.value)}>
            <option value="all">All Stores</option>
            {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </div>

        <div className="form-section">
          <label>Temperature Period</label>
          <select value={selectedTask} onChange={event => setSelectedTask(event.target.value)}>
            <option value="all">All Periods</option>
            {tasks.map(task => <option key={task.id} value={task.id}>{task.time_period}</option>)}
          </select>
        </div>

        <div className="form-section">
          <label>From</label>
          <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
        </div>

        <div className="form-section">
          <label>To</label>
          <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
        </div>

        <button className="submit-button" onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Find Temperature Logs'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {missingLogs.length > 0 && (
        <section className="admin-section" style={{ marginTop: 16 }}>
          <div className="admin-section-header">
            <div>
              <div className="eyebrow">Missing records</div>
              <h3>Temperature Logs Not Completed</h3>
              <p>Select a missing record to enter the temperature log for that store, period, and date.</p>
            </div>
          </div>
          <div className="admin-log-list">
            {missingLogs.map(entry => {
              const task = getTask(entry.task_type_id)
              const params = new URLSearchParams({
                storeId: entry.store_id,
                taskTypeId: entry.task_type_id,
                date: entry.log_date,
              })
              return (
                <div className="admin-log-card admin-log-card-missing" key={`${entry.store_id}:${entry.task_type_id}:${entry.log_date}`}>
                  <div>
                    <strong>{getStoreName(entry.store_id)}</strong>
                    <span>{formatDate(entry.log_date)}</span>
                    <span>{task?.time_period || 'Temperature'}</span>
                    <small className="missing-status">Not completed</small>
                  </div>
                  <Link to={`/admin/temperature/new?${params.toString()}`} className="action-button">
                    Enter Log
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="admin-log-list">
        {logs.map(log => {
          const task = getTask(log.task_type_id)
          return (
            <div className="admin-log-card" key={log.id}>
              <div>
                <strong>{getStoreName(log.store_id)}</strong>
                <span>{formatDate(log.log_date)}</span>
                <span>{task?.time_period || 'Temperature'}</span>
                <small>Completed by: {log.submitted_by_name || 'Unknown'}</small>
              </div>
              <Link to={`/admin/temperature/${log.id}`} className="action-button">Edit Log</Link>
            </div>
          )
        })}

        {logs.length === 0 && missingLogs.length === 0 && (
          <div className="empty-state">No temperature logs found. Select your filters and search.</div>
        )}
      </div>
    </div>
  )
}

export default AdminTemperatureLogs
