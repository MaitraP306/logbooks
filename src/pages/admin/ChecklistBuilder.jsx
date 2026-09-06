import { useEffect, useState } from 'react'
import AdminChecklistQuestion from '../../components/admin/AdminChecklistQuestion'
import { supabase } from '../../lib/supabase'
import { isMissingTableError } from '../../utils/errors'

const DEFAULT_OPTIONS = ['Yes', 'No', 'N/A']

function ChecklistBuilder() {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [taskForm, setTaskForm] = useState({ name: '', time_period: 'AM', sort_order: 10 })
  const [questionForm, setQuestionForm] = useState({ name: '', description: '', required: true, options: [...DEFAULT_OPTIONS] })
  const [newOption, setNewOption] = useState('')

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('task_types').select('*').eq('active', true).neq('task_type', 'temperature')
      .order('sort_order').order('time_period').order('name')
    if (loadError) setError(loadError.message)
    else setTasks(data || [])
    setLoading(false)
  }

  async function selectTask(task) {
    setSelectedTask(task)
    setError('')
    setMessage('')
    setShowQuestionForm(false)
    const { data, error: loadError } = await supabase
      .from('checklist_items').select('*').eq('task_type_id', task.id)
      .order('sort_order').order('created_at')
    if (loadError && !isMissingTableError(loadError)) {
      setError(loadError.message)
      return
    }
    setItems((data || []).map(item => ({ ...item, options: Array.isArray(item.options) && item.options.length ? item.options : DEFAULT_OPTIONS })))
  }

  async function createTask(event) {
    event.preventDefault()
    const name = taskForm.name.trim()
    if (!name) return setError('Enter a checklist name.')
    setError('')
    const taskType = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `checklist_${Date.now()}`
    const { data, error: createError } = await supabase.from('task_types').insert({
      name, task_type: taskType, time_period: taskForm.time_period, active: true, sort_order: Number(taskForm.sort_order) || 10,
    }).select().single()
    if (createError) return setError(createError.message)
    setTasks(prev => [...prev, data].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || a.name.localeCompare(b.name)))
    setSelectedTask(data)
    setItems([])
    setShowTaskForm(false)
    setMessage(`${name} was created. Add its questions and response options below.`)
    setTaskForm({ name: '', time_period: 'AM', sort_order: 10 })
  }

  async function updateTask(task, changes) {
    setError('')
    const { error: updateError } = await supabase.from('task_types').update(changes).eq('id', task.id)
    if (updateError) return setError(updateError.message)
    const updated = { ...task, ...changes }
    setTasks(prev => prev.map(current => current.id === task.id ? updated : current))
    setSelectedTask(updated)
  }

  async function removeTask(task) {
    if (!window.confirm(`Remove "${task.name}"? Existing submissions will be preserved.`)) return
    const { error: removeError } = await supabase.from('task_types').update({ active: false }).eq('id', task.id)
    if (removeError) return setError(removeError.message)
    setTasks(prev => prev.filter(current => current.id !== task.id))
    setSelectedTask(null)
    setItems([])
  }

  function updateQuestionForm(field, value) {
    setQuestionForm(prev => ({ ...prev, [field]: value }))
  }

  function addFormOption() {
    const value = newOption.trim()
    if (!value || questionForm.options.includes(value)) return
    setQuestionForm(prev => ({ ...prev, options: [...prev.options, value] }))
    setNewOption('')
  }

  function removeFormOption(option) {
    if (questionForm.options.length <= 1) return
    setQuestionForm(prev => ({ ...prev, options: prev.options.filter(value => value !== option) }))
  }

  async function createQuestion(event) {
    event.preventDefault()
    if (!selectedTask) return
    if (!questionForm.name.trim()) return setError('Enter a question.')
    if (questionForm.options.length === 0) return setError('Add at least one response option.')
    setSavingQuestion(true)
    setError('')
    const nextSort = items.length === 0 ? 10 : Math.max(...items.map(item => Number(item.sort_order) || 0)) + 10
    const { data, error: createError } = await supabase.from('checklist_items').insert({
      task_type_id: selectedTask.id,
      name: questionForm.name.trim(),
      description: questionForm.description.trim() || null,
      required: questionForm.required,
      options: questionForm.options,
      active: true,
      sort_order: nextSort,
    }).select().single()
    if (createError) {
      setError(createError.message)
      setSavingQuestion(false)
      return
    }
    setItems(prev => [...prev, data])
    setQuestionForm({ name: '', description: '', required: true, options: [...DEFAULT_OPTIONS] })
    setShowQuestionForm(false)
    setMessage('Question added to the checklist.')
    setSavingQuestion(false)
  }

  async function updateQuestion(item, changes) {
    setError('')
    const { error: updateError } = await supabase.from('checklist_items').update(changes).eq('id', item.id)
    if (updateError) return setError(updateError.message)
    setItems(prev => prev.map(current => current.id === item.id ? { ...current, ...changes } : current))
  }

  async function removeQuestion(item) {
    if (!window.confirm(`Remove "${item.name}"? Existing answers will be preserved.`)) return
    const { error: removeError } = await supabase.from('checklist_items').update({ active: false }).eq('id', item.id)
    if (removeError) return setError(removeError.message)
    setItems(prev => prev.filter(current => current.id !== item.id))
  }

  return (
    <div className="builder">
      <div className="builder-toolbar">
        <div>
          <div className="eyebrow">Workflow designer</div>
          <h3>Manager Checklists</h3>
          <p>Create a checklist task, then define every question and its allowed responses.</p>
        </div>
        <button type="button" className="submit-button" onClick={() => setShowTaskForm(value => !value)}>
          {showTaskForm ? 'Cancel' : '+ New checklist'}
        </button>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {message && <div className="success-box compact-success" role="status">{message}</div>}

      {showTaskForm && (
        <form className="builder-create-panel" onSubmit={createTask}>
          <div className="builder-create-copy"><span>01</span><div><strong>Create the checklist task</strong><p>This becomes the task employees see in their daily store workflow.</p></div></div>
          <div className="builder-create-fields">
            <div className="form-section"><label>Checklist name</label><input value={taskForm.name} onChange={event => setTaskForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Manager Walkthrough" /></div>
            <div className="form-section"><label>Time period</label><select value={taskForm.time_period} onChange={event => setTaskForm(prev => ({ ...prev, time_period: event.target.value }))}><option>AM</option><option>PM</option><option>EVENING</option></select></div>
            <div className="form-section"><label>Sort order</label><input type="number" value={taskForm.sort_order} onChange={event => setTaskForm(prev => ({ ...prev, sort_order: event.target.value }))} /></div>
            <button type="submit" className="submit-button">Create checklist</button>
          </div>
        </form>
      )}

      <div className="builder-layout">
        <aside className="builder-sidebar">
          <div className="builder-sidebar-heading"><span>Checklists</span><strong>{tasks.length}</strong></div>
          {loading ? <div className="builder-loading">Loading checklists…</div> : tasks.map(task => (
            <button type="button" key={task.id} className={selectedTask?.id === task.id ? 'builder-task active' : 'builder-task'} onClick={() => selectTask(task)}>
              <span className="builder-task-name">{task.name}</span><span className="builder-task-meta">{task.time_period} · Checklist</span>
            </button>
          ))}
          {!loading && tasks.length === 0 && <div className="empty-state">No checklists yet.</div>}
        </aside>

        <section className="builder-main">
          {!selectedTask ? (
            <div className="builder-empty"><div className="builder-empty-icon">✓</div><h3>Build your first checklist</h3><p>Create a checklist task on the left, then add questions with custom response options.</p></div>
          ) : (
            <>
              <div className="builder-main-header">
                <div className="builder-main-title">
                  <input className="builder-title-input" value={selectedTask.name} onChange={event => setSelectedTask(prev => ({ ...prev, name: event.target.value }))} onBlur={() => updateTask(selectedTask, { name: selectedTask.name.trim() })} />
                  <div className="builder-meta"><select value={selectedTask.time_period} onChange={event => updateTask(selectedTask, { time_period: event.target.value })}><option>AM</option><option>PM</option><option>EVENING</option></select><span>·</span><span>{items.length} questions</span></div>
                </div>
                <div className="question-header-actions"><button type="button" className="submit-button" onClick={() => setShowQuestionForm(value => !value)}>{showQuestionForm ? 'Close' : '+ Add question'}</button><button type="button" className="delete-button" onClick={() => removeTask(selectedTask)}>Remove checklist</button></div>
              </div>

              {showQuestionForm && (
                <form className="question-create-panel" onSubmit={createQuestion}>
                  <div className="question-create-header"><div><span className="step-badge">02</span><div><strong>Add a question</strong><p>Configure the response options employees can choose.</p></div></div><button type="button" className="icon-button" onClick={() => setShowQuestionForm(false)} aria-label="Close question form">×</button></div>
                  <div className="question-create-grid">
                    <div className="form-section full-width-field"><label>Question</label><input value={questionForm.name} onChange={event => updateQuestionForm('name', event.target.value)} placeholder="Are all food-contact surfaces sanitized?" /></div>
                    <div className="form-section"><label>Instructions</label><textarea value={questionForm.description} onChange={event => updateQuestionForm('description', event.target.value)} placeholder="Optional instructions" rows="2" /></div>
                    <label className="settings-toggle question-required-toggle"><input type="checkbox" checked={questionForm.required} onChange={event => updateQuestionForm('required', event.target.checked)} /> Response required</label>
                  </div>
                  <div className="question-create-options">
                    <div className="question-options-header"><div><h4>Options</h4><p>These are the only responses the employee will be able to select.</p></div></div>
                    <div className="question-options-list">
                      {questionForm.options.map((option, index) => <div className="question-option-row" key={`${option}-${index}`}><span className="question-option-index">{index + 1}</span><input value={option} onChange={event => setQuestionForm(prev => ({ ...prev, options: prev.options.map((value, i) => i === index ? event.target.value : value) }))} /><button type="button" className="icon-button danger-icon" onClick={() => removeFormOption(option)} disabled={questionForm.options.length <= 1}>×</button></div>)}
                    </div>
                    <div className="add-option-row"><input value={newOption} onChange={event => setNewOption(event.target.value)} placeholder="e.g. Needs attention" /><button type="button" className="small-button" onClick={addFormOption}>+ Add option</button></div>
                  </div>
                  <div className="question-create-footer"><span>{questionForm.options.length} response option{questionForm.options.length === 1 ? '' : 's'}</span><button type="submit" className="submit-button" disabled={savingQuestion}>{savingQuestion ? 'Adding…' : 'Add question'}</button></div>
                </form>
              )}

              <div className="builder-question-summary"><div><strong>Questions</strong><span>Employees will see these in this exact order.</span></div><span className="settings-count">{items.length}</span></div>
              <div className="question-list">
                {items.map((item, index) => <AdminChecklistQuestion key={item.id} item={item} index={index} onSave={updateQuestion} onDelete={removeQuestion} />)}
                {items.length === 0 && <div className="empty-state builder-question-empty">No questions yet. Add the first question to make this checklist usable.</div>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default ChecklistBuilder
