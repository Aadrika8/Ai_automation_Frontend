import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { LayersPage } from './pages/LayersPage'
import { LayerPage } from './pages/LayerPage'
import { CoveragePage } from './pages/CoveragePage'
import { BenchmarkPage } from './pages/BenchmarkPage'
import { ReportPage } from './pages/ReportPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* any authenticated user */}
          <Route element={<RequireRole minRole="manager" />}>
            <Route element={<AppLayout />}>
              <Route path="/apps" element={<ApplicationsPage />} />
              <Route path="/apps/:appId" element={<LayersPage />} />
              <Route path="/apps/:appId/layers/:layerId" element={<LayerPage />} />
              <Route path="/apps/:appId/traceability" element={<CoveragePage />} />
              {/* the page’s earlier address, kept so old links still open it */}
              <Route path="/apps/:appId/coverage" element={<CoveragePage />} />
              <Route path="/apps/:appId/benchmark" element={<BenchmarkPage />} />
              <Route path="/apps/:appId/report" element={<ReportPage />} />

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
