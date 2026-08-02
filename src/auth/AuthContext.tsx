import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api, ROLE_RANK, type Role, type User } from '../api'

const SESSION_KEY = 'qi.session'

interface AuthValue {
  user: User | null
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  hasRole: (minRole: Role) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readSession)

  const login = useCallback(async (username: string, password: string) => {
    const u = await api.login(username, password)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const hasRole = useCallback(
    (minRole: Role) => user != null && ROLE_RANK[user.role] >= ROLE_RANK[minRole],
    [user],
  )

  return <AuthContext.Provider value={{ user, login, logout, hasRole }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
