/* The single seam between the UI and data — real HTTP client for the
   FastAPI backend. Each function maps 1:1 to a backend endpoint.

   Everything below an application is addressed through a release:
   /apps/{appId}/releases/{releaseId}/layers/... — a release owns its layers,
   their Excel schema and their rows, so no call can reach across releases. */
import type {
  AppCreate, AppSettings, AppSummary, AppUpdate, LayerCreate, LayerDashboardResponse,
  LayerInfo, LayerRecordsResponse, ManagedUser, ReleaseCreate, ReleaseInfo, ReleaseUpdate,
  LayerFileInfo, SnapshotInfo, SnapshotPeriod, SnapshotRequest, SnapshotRunResult,
  SourceStatus, User, UserCreate,
  CoverageResponse, TraceConfig, TraceConfigUpdate, TracePreview,
  AutomationCoverageResponse, AutomationTrendResponse,
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

/* UPLOAD DISABLED: multipart helper, used only by the upload call below.
   Uncomment together with it.

function requestForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  return send(path, { method, body: form }, {})
}
*/

/** Base path for everything inside one release. */
const rel = (appId: string, releaseId: string) => `/apps/${appId}/releases/${releaseId}`

// POST /api/auth/login
export function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

// GET /api/apps
export function getApplications(): Promise<AppSummary[]> {
  return request('/apps')
}

// POST /api/apps (admin) — also creates the app's first release
export function createApp(body: AppCreate): Promise<AppSummary> {
  return request('/apps', { method: 'POST', body: JSON.stringify(body) })
}

// PATCH /api/apps/{appId} (admin)
export function updateApp(appId: string, body: AppUpdate): Promise<AppSummary> {
  return request(`/apps/${appId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

// DELETE /api/apps/{appId} (admin) — cascades to every release and its data
export function deleteApp(appId: string): Promise<void> {
  return request(`/apps/${appId}`, { method: 'DELETE' })
}

// GET /api/apps/{appId}/releases — newest first
export function getReleases(appId: string): Promise<ReleaseInfo[]> {
  return request(`/apps/${appId}/releases`)
}

// POST /api/apps/{appId}/releases (admin)
// starts from the default pyramid, or copies another release's layer
// structure (never its data) when copyLayersFrom is given
export function createRelease(appId: string, body: ReleaseCreate): Promise<ReleaseInfo> {
  return request(`/apps/${appId}/releases`, { method: 'POST', body: JSON.stringify(body) })
}

// PATCH /api/apps/{appId}/releases/{releaseId} (admin)
// renaming keeps the id, so existing links still resolve
export function updateRelease(
  appId: string, releaseId: string, body: ReleaseUpdate,
): Promise<ReleaseInfo> {
  return request(rel(appId, releaseId), { method: 'PATCH', body: JSON.stringify(body) })
}

// DELETE /api/apps/{appId}/releases/{releaseId} (admin)
// removes this release's layers, uploads and rows — other releases are untouched
export function deleteRelease(appId: string, releaseId: string): Promise<void> {
  return request(rel(appId, releaseId), { method: 'DELETE' })
}

// GET /api/apps/{appId}/releases/{releaseId}/layers
export function getLayers(appId: string, releaseId: string): Promise<LayerInfo[]> {
  return request(`${rel(appId, releaseId)}/layers`)
}

// POST /api/apps/{appId}/releases/{releaseId}/layers (admin)
// the layer belongs to this release alone
export function createLayer(
  appId: string, releaseId: string, body: LayerCreate,
): Promise<LayerInfo> {
  return request(`${rel(appId, releaseId)}/layers`, { method: 'POST', body: JSON.stringify(body) })
}

// DELETE /api/apps/{appId}/releases/{releaseId}/layers/{layerId} (admin)
export function deleteLayer(appId: string, releaseId: string, layerId: string): Promise<void> {
  return request(`${rel(appId, releaseId)}/layers/${layerId}`, { method: 'DELETE' })
}

// GET /api/apps/{appId}/releases/{releaseId}/source
// what this release's Excel folder holds, and what has changed
export function getSource(appId: string, releaseId: string): Promise<SourceStatus> {
  return request(`${rel(appId, releaseId)}/source`)
}

// POST /api/apps/{appId}/releases/{releaseId}/snapshots (qa+)
// reads this release's workbooks and records a snapshot per testing type.
// A type whose data is unchanged records nothing; earlier snapshots and other
// releases are never touched.
export function createSnapshots(
  appId: string, releaseId: string, body: SnapshotRequest,
): Promise<SnapshotRunResult> {
  return request(`${rel(appId, releaseId)}/snapshots`,
                 { method: 'POST', body: JSON.stringify(body) })
}

// GET /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/files
// the workbooks this testing type holds data from, most recently loaded first.
// Each is an independent dataset — they are never combined.
export function getLayerFiles(
  appId: string, releaseId: string, layerId: string,
): Promise<LayerFileInfo[]> {
  return request(`${rel(appId, releaseId)}/layers/${layerId}/files`)
}

// GET /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/snapshots
// this testing type's history — every file's snapshots together, newest load
// first. Naming a file narrows it to that one.
export function getSnapshots(
  appId: string, releaseId: string, layerId: string, file?: string,
): Promise<SnapshotInfo[]> {
  const qs = file ? `?file=${encodeURIComponent(file)}` : ''
  return request(`${rel(appId, releaseId)}/layers/${layerId}/snapshots${qs}`)
}

// PATCH /api/apps/{appId}/releases/{releaseId}/snapshots/{snapshotId} (admin)
// corrects which month a snapshot is filed under; its data is immutable
export function updateSnapshotPeriod(
  appId: string, releaseId: string, snapshotId: string, period: SnapshotPeriod,
): Promise<SnapshotInfo> {
  return request(`${rel(appId, releaseId)}/snapshots/${snapshotId}`,
                 { method: 'PATCH', body: JSON.stringify({ period }) })
}

// DELETE /api/apps/{appId}/releases/{releaseId}/snapshots/{snapshotId} (admin)
// removes one snapshot and its rows — every other snapshot keeps its data,
// and the one before it becomes current again
export function deleteSnapshot(
  appId: string, releaseId: string, snapshotId: string,
): Promise<{ deleted: number; sequence: number }> {
  return request(`${rel(appId, releaseId)}/snapshots/${snapshotId}`, { method: 'DELETE' })
}

/* UPLOAD DISABLED — data is read from each release's folder instead of being pushed
   up from a browser. Kept, not deleted: uncomment this, `requestForm` above,
   UploadDialog.tsx, and the call sites marked in LayersPage/LayerPage to
   restore it, along with the endpoint in the backend's routers/apps.py.

// POST /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/uploads (qa+)
export function uploadLayerExcel(
  appId: string, releaseId: string, layerId: string, file: File,
  mode: 'merge' | 'replace' = 'merge',
): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return requestForm(`${rel(appId, releaseId)}/layers/${layerId}/uploads?mode=${mode}`, form)
}
*/

// GET /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/records
export function getLayerRecords(
  appId: string, releaseId: string, layerId: string,
  opts: {
    search?: string; section?: string; page?: number; pageSize?: number
    /** which workbook to read; default the most recently loaded */
    file?: string
    /** a snapshot by id, or the last one of a month ("2026-09"); default current */
    snapshot?: string; month?: string
  } = {},
): Promise<LayerRecordsResponse> {
  const params = new URLSearchParams()
  if (opts.search) params.set('search', opts.search)
  if (opts.section) params.set('section', opts.section)
  if (opts.file) params.set('file', opts.file)
  if (opts.snapshot) params.set('snapshot', opts.snapshot)
  if (opts.month) params.set('month', opts.month)
  if (opts.page) params.set('page', String(opts.page))
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize))
  const qs = params.toString()
  return request(`${rel(appId, releaseId)}/layers/${layerId}/records${qs ? `?${qs}` : ''}`)
}

// GET /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/dashboard
// metrics for one workbook, or — with `merged` — every file's current
// snapshot added up at read time. Merging changes nothing in storage.
export function getLayerDashboard(
  appId: string, releaseId: string, layerId: string,
  opts: {
    file?: string; snapshot?: string; month?: string; merged?: boolean
    /** which column a results dashboard breaks its figures down by */
    dimension?: string
  } = {},
): Promise<LayerDashboardResponse> {
  const params = new URLSearchParams()
  if (opts.merged) params.set('merged', 'true')
  if (opts.file) params.set('file', opts.file)
  if (opts.snapshot) params.set('snapshot', opts.snapshot)
  if (opts.month) params.set('month', opts.month)
  if (opts.dimension) params.set('dimension', opts.dimension)
  const qs = params.toString()
  return request(`${rel(appId, releaseId)}/layers/${layerId}/dashboard${qs ? `?${qs}` : ''}`)
}

// DELETE /api/apps/{appId}/releases/{releaseId}/layers/{layerId}/records (admin)
// removes every snapshot of this testing type. To undo one bad load, delete
// that snapshot instead.
export function clearLayerRecords(
  appId: string, releaseId: string, layerId: string,
): Promise<{ deleted: number; scope: string }> {
  return request(`${rel(appId, releaseId)}/layers/${layerId}/records`, { method: 'DELETE' })
}

/* --- traceability: Feature <-> System coverage --------------------------

   Both directions come from one response, because they are two readings of
   the same comparison. Everything is computed when it is asked for, from the
   current snapshot of every workbook feeding each layer — only the
   configuration is stored. */

// GET /api/apps/{appId}/releases/{releaseId}/traceability
// the coverage matrix: one entry per identifier across both sides, gaps first
export function getCoverage(appId: string, releaseId: string): Promise<CoverageResponse> {
  return request(`${rel(appId, releaseId)}/traceability`)
}

// GET /api/apps/{appId}/releases/{releaseId}/traceability/config
// never 404s: an unconfigured release answers with what the rule read
export function getTraceConfig(appId: string, releaseId: string): Promise<TraceConfig> {
  return request(`${rel(appId, releaseId)}/traceability/config`)
}

// PUT /api/apps/{appId}/releases/{releaseId}/traceability/config (admin)
export function saveTraceConfig(
  appId: string, releaseId: string, body: TraceConfigUpdate,
): Promise<TraceConfig> {
  return request(`${rel(appId, releaseId)}/traceability/config`,
                 { method: 'PUT', body: JSON.stringify(body) })
}

// GET /api/apps/{appId}/releases/{releaseId}/traceability/preview (admin)
// what a proposed override would read out of a layer. With neither column
// nor pattern this is the rule itself: each workbook's first column.
export function getTracePreview(
  appId: string, releaseId: string,
  opts: { layer: string; column?: string; pattern?: string },
): Promise<TracePreview> {
  const params = new URLSearchParams({ layer: opts.layer })
  if (opts.column) params.set('column', opts.column)
  if (opts.pattern) params.set('pattern', opts.pattern)
  return request(`${rel(appId, releaseId)}/traceability/preview?${params}`)
}

/* CSV EXPORT DISABLED — the endpoint is commented out in the backend's
   routers/traceability.py. Kept, not deleted: uncomment this together with it
   and the download button in pages/CoveragePage.tsx.

// The CSV export is a download, not a fetch — the browser needs the URL.
export function coverageCsvUrl(appId: string, releaseId: string): string {
  return `${BASE}/api${rel(appId, releaseId)}/traceability.csv`
}
*/

/* --- benchmark: automation coverage ------------------------------------

   One response carries both sides, and they stay apart inside it: Evident's
   figure is computed from the ingested rows, the reference is curated, and the
   distance between them is derived rather than stored on either. */

// GET /api/apps/{appId}/releases/{releaseId}/benchmark/automation
export function getAutomationCoverage(
  appId: string, releaseId: string,
): Promise<AutomationCoverageResponse> {
  return request(`${rel(appId, releaseId)}/benchmark/automation`)
}

// GET /api/apps/{appId}/benchmark/automation/trend
// every release, oldest first, each with its change from the previous
// *measured* one — so a release that recorded no automated count breaks the
// chain of evidence without breaking the trend
export function getAutomationTrend(appId: string): Promise<AutomationTrendResponse> {
  return request(`/apps/${appId}/benchmark/automation/trend`)
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
