/* The single seam between the UI and data — real HTTP client for the
   FastAPI backend. Each function maps 1:1 to a backend endpoint. */
import type {
  AiReport, AppId, AppSettings, AppSummary, LayerDashboard, LayerId, LayerInfo,
  ManagedUser, RunSummary, TestCaseRow, TestDetail, User,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const SESSION_KEY = 'qi.session'

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw).token ?? null) : null
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = readToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, { ...init, headers })
  } catch {
    throw new Error('Cannot reach the API — is the backend running?')
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    // expired/invalid session: force a clean re-login
    localStorage.removeItem(SESSION_KEY)
    location.assign('/login')
    throw new Error('Session expired')
  }
  if (!res.ok) {
    const detail = await res.json().then(body => body?.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status})`)
  }
  return res.json()
}

// POST /api/auth/login
export function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

// GET /api/apps
export function getApplications(): Promise<AppSummary[]> {
  return request('/apps')
}

// GET /api/apps/{appId}/layers
export function getLayers(appId: AppId): Promise<LayerInfo[]> {
  return request(`/apps/${appId}/layers`)
}

// GET /api/apps/{appId}/layers/{layerId}/dashboard
export function getLayerDashboard(appId: AppId, layerId: LayerId): Promise<LayerDashboard> {
  return request(`/apps/${appId}/layers/${layerId}/dashboard`)
}

// GET /api/apps/{appId}/layers/{layerId}/tests
export function getTestCases(appId: AppId, layerId: LayerId): Promise<TestCaseRow[]> {
  return request(`/apps/${appId}/layers/${layerId}/tests`)
}

// GET /api/tests/{testId}
export function getTestDetail(testId: string): Promise<TestDetail> {
  return request(`/tests/${encodeURIComponent(testId)}`)
}

// GET /api/runs
export function getRuns(): Promise<RunSummary[]> {
  return request('/runs')
}

// GET /api/settings
export function getSettings(): Promise<AppSettings> {
  return request('/settings')
}

// PUT /api/settings
export async function saveSettings(settings: AppSettings): Promise<void> {
  await request('/settings', { method: 'PUT', body: JSON.stringify(settings) })
}

// GET /api/users
export function getUsers(): Promise<ManagedUser[]> {
  return request('/users')
}

// POST /api/apps/{appId}/layers/{layerId}/report — server caches by data hash,
// so repeat calls are free until the underlying data changes
export function generateReport(appId: AppId, layerId: LayerId, force = false): Promise<AiReport> {
  return request(`/apps/${appId}/layers/${layerId}/report${force ? '?force=true' : ''}`, { method: 'POST' })
}
