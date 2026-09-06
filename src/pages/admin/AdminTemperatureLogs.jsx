import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { dateRangeDefault, formatDate, getLocalDate } from '../../utils/date'

function AdminTemperatureLogs() {

  const [stores, setStores] =
    useState([])

  const [tasks, setTasks] =
    useState([])

  const [logs, setLogs] =
    useState([])

  const [selectedStore, setSelectedStore] =
    useState('all')

  const [selectedTask, setSelectedTask] =
    useState('all')

  const [fromDate, setFromDate] =
    useState(dateRangeDefault())

  const [toDate, setToDate] =
    useState(getLocalDate())

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')


  useEffect(() => {
    loadFilters()
  }, [])


  async function loadFilters() {

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
      return
    }


    if (tasksResult.error) {
      setError(tasksResult.error.message)
      return
    }


    setStores(
      storesResult.data || []
    )

    setTasks(
      tasksResult.data || []
    )
  }


  async function search() {

    setLoading(true)
    setError('')


    let query =
      supabase
        .from('temperature_logs')
        .select(`
          id,
          store_id,
          task_type_id,
          log_date,
          submitted_by_name,
          submitted_at,
          notes
        `)
        .gte('log_date', fromDate)
        .lte('log_date', toDate)
        .order('log_date', {
          ascending: false
        })
        .order('submitted_at', {
          ascending: false
        })


    if (selectedStore !== 'all') {
      query =
        query.eq(
          'store_id',
          selectedStore
        )
    }


    if (selectedTask !== 'all') {
      query =
        query.eq(
          'task_type_id',
          selectedTask
        )
    }


    const { data, error } =
      await query


    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }


    setLogs(data || [])
    setLoading(false)
  }


  function getStoreName(storeId) {

    return (
      stores.find(
        store => store.id === storeId
      )?.name ||
      'Unknown Store'
    )
  }


  function getTask(taskId) {

    return tasks.find(
      task => task.id === taskId
    )
  }


  return (
    <div>

      <div className="admin-report-filter">

        <div className="form-section">

          <label>
            Store
          </label>

          <select
            value={selectedStore}
            onChange={event =>
              setSelectedStore(
                event.target.value
              )
            }
          >

            <option value="all">
              All Stores
            </option>

            {stores.map(store => (

              <option
                key={store.id}
                value={store.id}
              >
                {store.name}
              </option>

            ))}

          </select>

        </div>


        <div className="form-section">

          <label>
            Temperature Period
          </label>

          <select
            value={selectedTask}
            onChange={event =>
              setSelectedTask(
                event.target.value
              )
            }
          >

            <option value="all">
              All Periods
            </option>

            {tasks.map(task => (

              <option
                key={task.id}
                value={task.id}
              >
                {task.time_period}
              </option>

            ))}

          </select>

        </div>


        <div className="form-section">

          <label>
            From
          </label>

          <input
            type="date"
            value={fromDate}
            onChange={event =>
              setFromDate(
                event.target.value
              )
            }
          />

        </div>


        <div className="form-section">

          <label>
            To
          </label>

          <input
            type="date"
            value={toDate}
            onChange={event =>
              setToDate(
                event.target.value
              )
            }
          />

        </div>


        <button
          className="submit-button"
          onClick={search}
          disabled={loading}
        >
          {loading
            ? 'Searching...'
            : 'Find Temperature Logs'}
        </button>

      </div>


      {error && (
        <div className="error-box">
          {error}
        </div>
      )}


      <div className="admin-log-list">

        {logs.map(log => {

          const task =
            getTask(log.task_type_id)


          return (

            <div
              className="admin-log-card"
              key={log.id}
            >

              <div>

                <strong>
                  {getStoreName(
                    log.store_id
                  )}
                </strong>

                <span>
                  {formatDate(log.log_date)}
                </span>

                <span>
                  {task?.time_period ||
                    'Temperature'}
                </span>

                <small>
                  Completed by:{' '}
                  {log.submitted_by_name ||
                    'Unknown'}
                </small>

              </div>


              <Link
                to={`/admin/temperature/${log.id}`}
                className="action-button"
              >
                Edit Log
              </Link>

            </div>

          )
        })}


        {logs.length === 0 && (

          <div className="empty-state">
            No temperature logs found.
            Select your filters and search.
          </div>

        )}

      </div>

    </div>
  )
}

export default AdminTemperatureLogs
