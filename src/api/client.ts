/* The single seam between the UI and data.
   Today every function serves seeded mock fixtures with simulated latency.
   When the FastAPI backend lands, ONLY the bodies here change to fetch()
   calls (each is annotated with its future endpoint) and mock/ is deleted. */
import type {
  AppId, AppSettings, AppSummary, LayerDashboard, LayerId, LayerInfo,
  ManagedUser, RunSummary, TestCaseRow, TestDetail, User,
} from './types'
import {
  DEFAULT_SETTINGS, fxAllRuns, fxApplications, fxLayerDashboard,
  fxLayers, fxTestCases, fxTestDetail,
} from './mock/fixtures'
import { CREDENTIALS, MANAGED_USERS } from './mock/users'

const delay = (ms = 150 + Math.random() * 300) => new Promise(res => setTimeout(res, ms))

const SETTINGS_KEY = 'qi.settings'

// POST /api/auth/login
export async function login(username: string, password: string): Promise<User> {
  await delay(350)
  const match = CREDENTIALS.find(c => c.username === username.trim() && c.password === password)
  if (!match) throw new Error('Invalid username or password')
  const { password: _pw, ...user } = match
  return user
}

// GET /api/apps
export async function getApplications(): Promise<AppSummary[]> {
  await delay()
  return fxApplications()
}

// GET /api/apps/{appId}/layers
export async function getLayers(appId: AppId): Promise<LayerInfo[]> {
  await delay()
  return fxLayers(appId)
}

// GET /api/apps/{appId}/layers/{layerId}/dashboard
export async function getLayerDashboard(appId: AppId, layerId: LayerId): Promise<LayerDashboard> {
  await delay()
  return fxLayerDashboard(appId, layerId)
}

// GET /api/apps/{appId}/layers/{layerId}/tests
export async function getTestCases(appId: AppId, layerId: LayerId): Promise<TestCaseRow[]> {
  await delay()
  return fxTestCases(appId, layerId)
}

// GET /api/tests/{testId}
export async function getTestDetail(testId: string): Promise<TestDetail> {
  await delay()
  const detail = fxTestDetail(testId)
  if (!detail) throw new Error('Test case not found')
  return detail
}

// GET /api/runs
export async function getRuns(): Promise<RunSummary[]> {
  await delay()
  return fxAllRuns()
}

// GET /api/settings
export async function getSettings(): Promise<AppSettings> {
  await delay(120)
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch { /* fall through to defaults */ }
  return { ...DEFAULT_SETTINGS }
}

// PUT /api/settings
export async function saveSettings(settings: AppSettings): Promise<void> {
  await delay(250)
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// GET /api/users
export async function getUsers(): Promise<ManagedUser[]> {
  await delay()
  return MANAGED_USERS
}
