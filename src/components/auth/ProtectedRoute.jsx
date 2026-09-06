import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="content auth-loading-page">
        <div className="auth-loading-card" role="status" aria-live="polite">
          <span className="auth-spinner" />
          <span>Checking your session…</span>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
