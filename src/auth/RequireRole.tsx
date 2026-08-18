import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../api'
import { useAuth } from './AuthContext'

/** Route guard. Unauthenticated → /login (sign-in always lands on /apps);
    authenticated but below minRole → /apps. Roles are hierarchical. */
export function RequireRole({ minRole }: { minRole: Role }) {
  const { user, hasRole } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (!hasRole(minRole)) return <Navigate to="/apps" replace />
  return <Outlet />
}
