import type { Role } from '../api'

export interface NavItem {
  label: string
  to: string
  minRole: Role
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Applications', to: '/apps', minRole: 'manager' },
  { label: 'Runs', to: '/runs', minRole: 'qa' },
  { label: 'Settings', to: '/settings', minRole: 'admin' },
  { label: 'Users', to: '/users', minRole: 'admin' },
]
