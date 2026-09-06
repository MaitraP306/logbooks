import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from './auth/useAuth'

function Layout({ children }) {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const isLoginPage = location.pathname === '/admin/login'

  async function handleSignOut() {
    await signOut()
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo" aria-label="Logbooks home">
            LOGBOOKS
          </Link>

          <nav className="topbar-actions" aria-label="Primary navigation">
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                isActive ? 'admin-link report-link active' : 'admin-link report-link'
              }
            >
              Completion Reports
            </NavLink>
            {session && !isLoginPage && (
              <button type="button" className="admin-signout" onClick={handleSignOut}>Sign out</button>
            )}
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? 'admin-link active' : 'admin-link'
              }
            >
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      {children}
    </div>
  )
}

export default Layout
