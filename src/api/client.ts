/* The single seam between the UI and data — real HTTP client for the
   FastAPI backend. Each function maps 1:1 to a backend endpoint. */
import type {
  AppCreate, AppSettings, AppSummary, LayerCreate, LayerDashboardResponse,
  LayerInfo, LayerRecordsResponse, ManagedUser, UploadResult, User, UserCreate,
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

async function send<T>(path: string, init: RequestInit, headers: Record<string, string>): Promise<T> {
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
  if (res.status === 204) return undefined as T
  return res.json()
}

function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return send(path, init, { 'Content-Type': 'application/json' })
}

/* multipart: no Content-Type header — the browser sets it with the boundary */
function requestForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  return send(path, { method, body: form }, {})
}

// POST /api/auth/login
export function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

// GET /api/apps
export function getApplications(): Promise<AppSummary[]> {
  return request('/apps')
}

// POST /api/apps (admin)
export function createApp(body: AppCreate): Promise<AppSummary> {
  return request('/apps', { method: 'POST', body: JSON.stringify(body) })
}

// DELETE /api/apps/{appId} (admin)
export function deleteApp(appId: string): Promise<void> {
  return request(`/apps/${appId}`, { method: 'DELETE' })
}

// GET /api/apps/{appId}/layers
export function getLayers(appId: string): Promise<LayerInfo[]> {
  return request(`/apps/${appId}/layers`)
}

// POST /api/apps/{appId}/layers (admin)
export function createLayer(appId: string, body: LayerCreate): Promise<LayerInfo> {
  return request(`/apps/${appId}/layers`, { method: 'POST', body: JSON.stringify(body) })
}

// DELETE /api/apps/{appId}/layers/{layerId} (admin)
export function deleteLayer(appId: string, layerId: string): Promise<void> {
  return request(`/apps/${appId}/layers/${layerId}`, { method: 'DELETE' })
}

// POST /api/apps/{appId}/layers/{layerId}/uploads (qa+)
// mode 'merge' upserts into the existing rows; 'replace' wipes the layer first
export function uploadLayerExcel(
  appId: string, layerId: string, file: File, mode: 'merge' | 'replace' = 'merge',
): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return requestForm(`/apps/${appId}/layers/${layerId}/uploads?mode=${mode}`, form)
}

// GET /api/apps/{appId}/layers/{layerId}/records
export function getLayerRecords(
  appId: string, layerId: string,
  opts: { search?: string; section?: string; page?: number; pageSize?: number } = {},
): Promise<LayerRecordsResponse> {
  const params = new URLSearchParams()
  if (opts.search) params.set('search', opts.search)
  if (opts.section) params.set('section', opts.section)
  if (opts.page) params.set('page', String(opts.page))
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize))
  const qs = params.toString()
  return request(`/apps/${appId}/layers/${layerId}/records${qs ? `?${qs}` : ''}`)
}

// GET /api/apps/{appId}/layers/{layerId}/dashboard
export function getLayerDashboard(appId: string, layerId: string): Promise<LayerDashboardResponse> {
  return request(`/apps/${appId}/layers/${layerId}/dashboard`)
}

// DELETE /api/apps/{appId}/layers/{layerId}/records (admin)
// scope 'all' purges the layer's data; 'last' removes only the latest upload
export function clearLayerRecords(
  appId: string, layerId: string, scope: 'all' | 'last' = 'all',
): Promise<{ deleted: number; scope: string }> {
  return request(`/apps/${appId}/layers/${layerId}/records?scope=${scope}`, { method: 'DELETE' })
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

// POST /api/users (admin)
export function createUser(body: UserCreate): Promise<ManagedUser> {
  return request('/users', { method: 'POST', body: JSON.stringify(body) })
}

// DELETE /api/users/{username} (admin)
export function deleteUser(username: string): Promise<void> {
  return request(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' })
}
