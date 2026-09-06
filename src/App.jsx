import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import { AuthProvider } from './components/auth/AuthProvider'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Home from './pages/Home'
import StorePage from './pages/StorePage'
import TaskPage from './pages/TaskPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminPage from './pages/admin/AdminPage'
import AdminTemperatureLogEdit from './pages/admin/AdminTemperatureLogEdit'
import CompletionReports from './pages/reports/CompletionReports'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/logbooks">
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/store/:id" element={<StorePage />} />
            <Route path="/store/:id/:taskType/:timePeriod/:mode" element={<TaskPage />} />
            <Route path="/reports" element={<CompletionReports />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/admin/temperature/:logId" element={<ProtectedRoute><AdminTemperatureLogEdit /></ProtectedRoute>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
