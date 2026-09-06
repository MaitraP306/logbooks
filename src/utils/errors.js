export function isMissingTableError(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
