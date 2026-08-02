import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../api'
import { useAuth } from './AuthContext'

/** Route guard. Unauthenticated → /login (remembering the target);
    authenticated but below minRole → /apps. Roles are hierarchical. */
export function RequireRole({ minRole }: { minRole: Role }) {
  const { user, hasRole } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (!hasRole(minRole)) return <Navigate to="/apps" replace />
  return <Outlet />
}
