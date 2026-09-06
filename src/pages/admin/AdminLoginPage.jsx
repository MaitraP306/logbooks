import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../components/auth/useAuth'
import { supabase } from '../../lib/supabase'

function AdminLoginPage() {
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Admin Login | Logbooks'
  }, [])

  useEffect(() => {
    if (!authLoading && session) {
      navigate(location.state?.from || '/admin', { replace: true })
    }
  }, [authLoading, session, navigate, location.state])

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError('Unable to sign in. Check your email and password and try again.')
      setSubmitting(false)
      return
    }

    navigate(location.state?.from || '/admin', { replace: true })
    setSubmitting(false)
  }

  return (
    <main className="content auth-page">
      <Link to="/" className="back-link">← Back to Logbooks</Link>

      <section className="auth-shell" aria-labelledby="admin-login-title">
        <div className="auth-brand-mark">L</div>
        <p className="eyebrow">Administration</p>
        <h1 id="admin-login-title" className="page-title">Welcome back</h1>
        <p className="subtitle">Sign in to manage logbook configuration and review operational records.</p>

        {error && <div className="error-box" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-section">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-section">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="submit-button auth-submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">Authentication is securely handled by Supabase.</p>
      </section>
    </main>
  )
}

export default AdminLoginPage
