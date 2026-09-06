import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { getLocalDate } from '../utils/date'
import { isMissingTableError } from '../utils/errors'

function StorePage() {

  const { id } = useParams()

  const [store, setStore] = useState(null)
  const [tasks, setTasks] = useState([])
  const [completionSet, setCompletionSet] = useState(new Set())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  useEffect(() => {
    loadStore()
    // loadStore is intentionally defined in the component and keyed by the route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])


  async function loadStore() {

    setLoading(true)
    setError('')

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
        .eq('active', true)
        .order('sort_order')
        .order('name')

    if (taskResult.error) {
      setError(taskResult.error.message)
      setLoading(false)
      return
    }

    setTasks(taskResult.data || [])


    const today = getLocalDate()

    const [
      tempResult,
      checklistResult,
      genericResult
    ] = await Promise.all([

      supabase
        .from('temperature_logs')
        .select('task_type_id')
        .eq('store_id', id)
        .eq('log_date', today),

      supabase
        .from('checklist_submissions')
        .select('task_type_id')
        .eq('store_id', id)
        .eq('log_date', today),

      supabase
        .from('task_completions')
        .select('task_type_id')
        .eq('store_id', id)
        .eq('completion_date', today)

    ])


    if (
      tempResult.error &&
      !isMissingTableError(tempResult.error)
    ) {
      setError(tempResult.error.message)
      setLoading(false)
      return
    }


    if (
      checklistResult.error &&
      !isMissingTableError(checklistResult.error)
    ) {
      setError(checklistResult.error.message)
      setLoading(false)
      return
    }


    if (
      genericResult.error &&
      !isMissingTableError(genericResult.error)
    ) {
      setError(genericResult.error.message)
      setLoading(false)
      return
    }


    const completed = new Set()

    for (const row of tempResult.data || []) {
      completed.add(row.task_type_id)
    }

    for (const row of checklistResult.data || []) {
      completed.add(row.task_type_id)
    }

    for (const row of genericResult.data || []) {
      completed.add(row.task_type_id)
    }

    setCompletionSet(completed)
    setLoading(false)
  }


  function getTaskUrl(task, completed) {

    const mode = completed
      ? 'view'
      : 'complete'

    return (
      `/store/${id}/` +
      `${task.task_type}/` +
      `${task.time_period}/` +
      `${mode}`
    )
  }


  if (loading) {
    return (
      <main className="content">
        <p>Loading...</p>
      </main>
    )
  }


  if (error) {
    return (
      <main className="content">

        <h1>
          Database Error
        </h1>

        <div className="error-box">
          {error}
        </div>

      </main>
    )
  }


  return (
    <main className="content">

      <Link
        to="/"
        className="back-link"
      >
        ← All Stores
      </Link>


      <div className="store-header">

        <div>

          <h1 className="page-title">
            {store.name}
          </h1>

          <p className="subtitle">
            Today's Tasks
          </p>

        </div>


        <div className="date-box">

          {new Date().toLocaleDateString(
            'en-CA',
            {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }
          )}

        </div>

      </div>


      <div className="task-table">

        <div className="task-table-header">

          <div>
            Task
          </div>

          <div>
            Status
          </div>

          <div>
            Action
          </div>

        </div>


        {tasks.map(task => {

          const completed =
            completionSet.has(task.id)

          return (

            <div
              className="task-row"
              key={task.id}
            >

              <div>

                <div className="task-name">
                  {task.name}
                </div>

                <div className="task-meta">
                  {task.time_period}
                </div>

              </div>


              <div>

                {completed ? (

                  <span className="status-completed">
                    Completed
                  </span>

                ) : (

                  <span className="status-pending">
                    Pending
                  </span>

                )}

              </div>


              <div>

                <Link
                  to={getTaskUrl(
                    task,
                    completed
                  )}
                  className={
                    completed
                      ? 'action-button secondary'
                      : 'action-button'
                  }
                >
                  {completed
                    ? 'View'
                    : 'Complete Now'}
                </Link>

              </div>

            </div>

          )
        })}


        {tasks.length === 0 && (

          <div className="empty-state">
            No active tasks have been configured.
          </div>

        )}

      </div>

    </main>
  )
}

export default StorePage
