import { useState } from 'react'

import AdminTemperatureLogs from './AdminTemperatureLogs'
import ChecklistBuilder from './ChecklistBuilder'
import StoreSetup from './StoreSetup'
import SettingsPage from './SettingsPage'

const tabs = [
  { id: 'checklists', label: 'Checklist Builder' },
  { id: 'temperature-logs', label: 'Edit Temperature Logs' },
  { id: 'stores', label: 'Store Setup' },
  { id: 'settings', label: 'Settings' },
]

function AdminPage() {
  const [activeTab, setActiveTab] = useState('checklists')

  return (
    <main className="content admin-page">
      <header className="admin-header">
        <div>
          <div className="eyebrow">Operations</div>
          <h1 className="page-title">Administration</h1>
          <p className="subtitle">Configure stores, validation rules, checklists, and temperature records.</p>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Administration sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {activeTab === 'stores' && <StoreSetup />}
        {activeTab === 'settings' && <SettingsPage />}
        {activeTab === 'checklists' && <ChecklistBuilder />}
        {activeTab === 'temperature-logs' && (
          <section className="admin-log-tool">
            <div className="admin-section-header">
              <div>
                <div className="eyebrow">Record maintenance</div>
                <h2>Temperature Logs</h2>
                <p>Find and correct previously submitted temperature logs.</p>
              </div>
            </div>
            <AdminTemperatureLogs />
          </section>
        )}
      </div>
    </main>
  )
}

export default AdminPage
