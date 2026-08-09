import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { PyramidPage } from './pages/PyramidPage'
import { DashboardPage } from './pages/DashboardPage'
import { TestCasesPage } from './pages/TestCasesPage'
import { TestDetailPage } from './pages/TestDetailPage'
import { RunsPage } from './pages/RunsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'
import { ReportPage } from './pages/ReportPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* any authenticated user */}
          <Route element={<RequireRole minRole="manager" />}>
            {/* full-page report (outside AppLayout so the printed PDF has no app chrome) */}
            <Route element={<RequireRole minRole="qa" />}>
              <Route path="/apps/:appId/:layerId/report" element={<ReportPage />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="/apps" element={<ApplicationsPage />} />
              <Route path="/apps/:appId/pyramid" element={<PyramidPage />} />
              <Route path="/apps/:appId/:layerId" element={<DashboardPage />} />

              {/* QA and above */}
              <Route element={<RequireRole minRole="qa" />}>
                <Route path="/apps/:appId/:layerId/tests" element={<TestCasesPage />} />
                <Route path="/apps/:appId/:layerId/tests/:testId" element={<TestDetailPage />} />
                <Route path="/runs" element={<RunsPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<RequireRole minRole="admin" />}>
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/apps" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
