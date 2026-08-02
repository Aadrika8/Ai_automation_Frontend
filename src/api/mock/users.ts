/* Hardcoded demo credentials — replaced by real auth with the backend. */
import type { ManagedUser, Role, User } from '../types'

interface Credential extends User {
  password: string
}

export const CREDENTIALS: Credential[] = [
  { username: 'admin', password: 'admin123', name: 'Aadrika Sharma', role: 'admin' },
  { username: 'qa', password: 'qa123', name: 'Rahul Verma', role: 'qa' },
  { username: 'manager', password: 'manager123', name: 'Priya Nair', role: 'manager' },
]

export const MANAGED_USERS: ManagedUser[] = [
  { username: 'admin', name: 'Aadrika Sharma', role: 'admin', lastActive: 'Now' },
  { username: 'qa', name: 'Rahul Verma', role: 'qa', lastActive: '2 h ago' },
  { username: 'manager', name: 'Priya Nair', role: 'manager', lastActive: 'Yesterday' },
  { username: 'qa2', name: 'Meera Iyer', role: 'qa', lastActive: '3 days ago' },
  { username: 'manager2', name: 'Vikram Rao', role: 'manager', lastActive: '5 days ago' },
]

export const ROLE_RANK: Record<Role, number> = { manager: 0, qa: 1, admin: 2 }
