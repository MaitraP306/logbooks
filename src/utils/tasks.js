export function getTaskLabel(task) {
  if (!task) return ''
  return (task.name || `${task.time_period || ''} ${task.task_type || ''}`).trim()
}
