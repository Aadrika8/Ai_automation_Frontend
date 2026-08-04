/* Seeded mock data — ported from pyramid_dashboard/index.html so numbers are
   stable across reloads. Deleted wholesale when the FastAPI backend lands. */
import type {
  AppId, AppSummary, LayerDashboard, LayerId, LayerInfo, LayerSnapshot,
  HistoryPoint, HourPoint, RunStatus, RunSummary, TestCaseRow, TestDetail, TestStatus,
} from '../types'

/* ---------- deterministic PRNG ---------- */
function hash(s: string): number {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rng(seed: string): () => number {
  let a = hash(seed)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- static catalog ---------- */
const APP_DEFS = [
  {
    id: 'hrms' as AppId, name: 'HRMS', tag: 'HR Management Suite', icon: 'people' as const,
    total: 1840, desc: 'Payroll, attendance and employee lifecycle platform used across all business units.',
  },
  {
    id: 'cellsens' as AppId, name: 'cellSens', tag: 'Imaging & Microscopy', icon: 'scope' as const,
    total: 2620, desc: 'Life-science imaging software for microscope control, acquisition and analysis.',
  },
  {
    id: 'preciv' as AppId, name: 'PRECiV', tag: 'Industrial Measurement', icon: 'ruler' as const,
    total: 1210, desc: 'Precision measurement and inspection software for industrial quality control.',
  },
]

const LAYER_DEFS = [
  { id: 'unit' as LayerId, name: 'Unit Testing', short: 'Unit', share: 0.55, colorVar: '--tier-unit', desc: 'Fast, isolated checks of individual components' },
  { id: 'integration' as LayerId, name: 'Integration Testing', short: 'Integration', share: 0.25, colorVar: '--tier-integration', desc: 'Modules verified working together' },
  { id: 'system' as LayerId, name: 'System Testing', short: 'System', share: 0.13, colorVar: '--tier-system', desc: 'Complete builds validated end-to-end internally' },
  { id: 'e2e' as LayerId, name: 'UI / End-to-End Testing', short: 'UI / E2E', share: 0.07, colorVar: '--tier-e2e', desc: 'Real user journeys through the interface' },
]

const RUN_NAMES: Record<LayerId, string[]> = {
  unit: ['CI · push build', 'CI · merge queue', 'Nightly unit sweep', 'Pre-release gate'],
  integration: ['Service contract run', 'Nightly integration', 'API compatibility run', 'Data-flow verification'],
  system: ['Full build validation', 'Release candidate run', 'Environment matrix run', 'Upgrade-path validation'],
  e2e: ['User journey suite', 'Smoke on staging', 'Release sign-off run', 'Cross-platform UI run'],
}

const SUITES = ['Regression', 'Smoke', 'Sanity', 'Integration']
const RELEASES: Record<AppId, string[]> = {
  hrms: ['4.5', '4.3'], cellsens: ['4.5', '4.3'], preciv: ['2.1', '2.0'],
}
const TEST_VERBS = ['login', 'export', 'capture', 'measure', 'sync', 'upload', 'render', 'search', 'filter', 'validate', 'import', 'calibrate', 'stitch', 'annotate', 'report', 'archive', 'zoom', 'crop', 'align', 'batch']
const TEST_NOUNS = ['flow', 'dialog', 'session', 'profile', 'image', 'dataset', 'project', 'settings', 'permissions', 'report', 'layout', 'metadata', 'preview', 'workspace', 'template', 'queue', 'history', 'snapshot', 'overlay', 'wizard']

const ERROR_TEMPLATES = [
  {
    msg: (t: string) => `AssertionError: expected status 'saved' but got 'pending' in ${t}`,
    step: 'Step 4 — Verify persisted state after submit',
    exc: 'AssertionError',
  },
  {
    msg: (t: string) => `TimeoutError: element '#confirm-dialog .ok-button' not visible after 30s in ${t}`,
    step: 'Step 3 — Confirm dialog interaction',
    exc: 'TimeoutError',
  },
  {
    msg: (t: string) => `ElementNotFoundError: locator 'toolbar > Export' matched 0 nodes in ${t}`,
    step: 'Step 2 — Open export toolbar action',
    exc: 'ElementNotFoundError',
  },
  {
    msg: (t: string) => `ValueError: measured 41.7 µm, expected 42.0 µm ± 0.1 in ${t}`,
    step: 'Step 5 — Compare measurement to reference',
    exc: 'ValueError',
  },
]

/* ---------- per app+layer model ---------- */
interface LayerModel {
  snapshot: LayerSnapshot
  history: HistoryPoint[]
  hourly: HourPoint[]
  version: { current: string; lastUpdated: string }
  recentRuns: RunSummary[]
}

const layerModels = new Map<string, LayerModel>()
function layerModel(appId: AppId, layerId: LayerId): LayerModel {
  const key = `${appId}:${layerId}`
  const cached = layerModels.get(key)
  if (cached) return cached

  const appDef = APP_DEFS.find(a => a.id === appId)!
  const layerDef = LAYER_DEFS.find(l => l.id === layerId)!
  const r = rng(key)
  const total = Math.round(appDef.total * layerDef.share)

  const history: HistoryPoint[] = []
  let pr = 88 + r() * 8
  for (let d = 89; d >= 0; d--) {
    pr = Math.min(99.6, Math.max(78, pr + (r() - 0.48) * 1.6))
    history.push({ daysAgo: d, passRate: +pr.toFixed(1), runs: 2 + Math.floor(r() * 7) })
  }
  const cur = history[history.length - 1].passRate
  const weekAgo = history[history.length - 8].passRate
  const running = Math.max(1, Math.round(total * 0.012 * r() * 2))
  const skipped = Math.round(total * 0.02 * r())
  const passed = Math.round((total - running - skipped) * cur / 100)
  const failed = total - passed - running - skipped

  const whenLabels = ['38 min ago', '3 h ago', 'Yesterday', '2 days ago', '4 days ago', '5 days ago']
  const recentRuns: RunSummary[] = whenLabels.map((when, i) => {
    const st = r()
    const status: RunStatus = st < 0.68 ? 'Completed' : st < 0.85 ? 'Running' : 'Failed'
    const runTotal = Math.round(total * (0.25 + r() * 0.75))
    const runPassed = status === 'Failed'
      ? Math.round(runTotal * (0.62 + r() * 0.25))
      : Math.round(runTotal * (0.9 + r() * 0.099))
    return {
      id: `${key}:run${i}`,
      appId, layerId,
      name: `${RUN_NAMES[layerId][i % 4]} #${310 - i * 7 - Math.floor(r() * 5)}`,
      when,
      total: runTotal,
      passed: Math.min(runPassed, runTotal),
      durationMin: Math.round(8 + r() * 70),
      status,
    }
  })

  const knownBugs = Math.min(failed, Math.round(failed * (0.25 + r() * 0.35)))

  // last 24 hours: walk backwards from the current pass rate
  const hourly: HourPoint[] = []
  let hourPr = cur
  for (let h = 0; h < 24; h++) {
    hourly.unshift({ hoursAgo: h, passRate: +hourPr.toFixed(1), runs: Math.floor(r() * 3) })
    hourPr = Math.min(99.6, Math.max(78, hourPr + (r() - 0.5) * 0.8))
  }

  const updatedDaysAgo = 1 + Math.floor(r() * 13)
  const version = {
    current: `${RELEASES[appId][0]}.${1 + Math.floor(r() * 8)}`,
    lastUpdated: new Date(Date.now() - updatedDaysAgo * 864e5)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }

  const model: LayerModel = {
    snapshot: { total, passed, failed, knownBugs, running, skipped, passRate: cur, deltaVsLastWeek: +(cur - weekAgo).toFixed(1) },
    history,
    hourly,
    version,
    recentRuns,
  }
  layerModels.set(key, model)
  return model
}

/* ---------- test cases per app+layer ---------- */
const testCaseCache = new Map<string, TestCaseRow[]>()
function layerTestCases(appId: AppId, layerId: LayerId): TestCaseRow[] {
  const key = `${appId}:${layerId}`
  const cached = testCaseCache.get(key)
  if (cached) return cached

  const { snapshot } = layerModel(appId, layerId)
  const r = rng(key + ':tests')
  const rows: TestCaseRow[] = []
  // status assignment consistent with snapshot totals: fill counts in order, then shuffle deterministically
  const statuses: TestStatus[] = [
    ...Array<TestStatus>(snapshot.failed).fill('Failed'),
    ...Array<TestStatus>(snapshot.running).fill('Running'),
    ...Array<TestStatus>(snapshot.skipped).fill('Skipped'),
    ...Array<TestStatus>(snapshot.passed).fill('Passed'),
  ]
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]]
  }
  const lastRuns = ['38 min ago', '3 h ago', '6 h ago', 'Yesterday', '2 days ago']
  for (let i = 0; i < snapshot.total; i++) {
    const verb = TEST_VERBS[Math.floor(r() * TEST_VERBS.length)]
    const noun = TEST_NOUNS[Math.floor(r() * TEST_NOUNS.length)]
    rows.push({
      id: `${appId}~${layerId}~${i}`,
      name: `test_${verb}_${noun}_${String(i + 1).padStart(3, '0')}`,
      suite: SUITES[Math.floor(r() * SUITES.length)],
      release: RELEASES[appId][Math.floor(r() * RELEASES[appId].length)],
      status: statuses[i],
      durationS: +(0.2 + r() * (layerId === 'unit' ? 3 : layerId === 'e2e' ? 90 : 25)).toFixed(1),
      lastRun: lastRuns[Math.floor(r() * lastRuns.length)],
    })
  }
  testCaseCache.set(key, rows)
  return rows
}

function buildStackTrace(appId: AppId, layerId: LayerId, row: TestCaseRow, exc: string, msg: string): string {
  const mod = row.name.replace(/_\d+$/, '')
  return [
    'Traceback (most recent call last):',
    `  File "test_suites/${APP_DEFS.find(a => a.id === appId)!.name}/${row.suite}/${row.release}/${row.name}.py", line ${40 + (hash(row.id) % 180)}, in ${mod}`,
    '    result = page.submit_and_wait(payload)',
    `  File "framework/${layerId}/driver.py", line ${120 + (hash(row.id) % 300)}, in submit_and_wait`,
    '    return self._await_state(target, timeout=self.timeout)',
    `  File "framework/core/waiter.py", line 88, in _await_state`,
    '    raise self._error_for(state)',
    `${exc}: ${msg.split(': ').slice(1).join(': ')}`,
  ].join('\n')
}

/* ---------- public fixture accessors (used only by client.ts) ---------- */
export function fxApplications(): AppSummary[] {
  return APP_DEFS.map(a => {
    let total = 0
    let passed = 0
    for (const l of LAYER_DEFS) {
      const s = layerModel(a.id, l.id).snapshot
      total += s.total
      passed += s.passed
    }
    return {
      id: a.id, name: a.name, tag: a.tag, desc: a.desc, icon: a.icon,
      totalTests: total, passRate: +(100 * passed / total).toFixed(1),
    }
  })
}

export function fxLayers(appId: AppId): LayerInfo[] {
  return LAYER_DEFS.map(l => {
    const s = layerModel(appId, l.id).snapshot
    return { ...l, testCount: s.total, passRate: s.passRate }
  })
}

export function fxLayerDashboard(appId: AppId, layerId: LayerId): LayerDashboard {
  return layerModel(appId, layerId)
}

export function fxTestCases(appId: AppId, layerId: LayerId): TestCaseRow[] {
  return layerTestCases(appId, layerId)
}

export function fxTestDetail(testId: string): TestDetail | undefined {
  const [appId, layerId, idxStr] = testId.split('~') as [AppId, LayerId, string]
  const rows = layerTestCases(appId, layerId)
  const row = rows[Number(idxStr)]
  if (!row) return undefined
  const appDef = APP_DEFS.find(a => a.id === appId)!
  const r = rng(testId)
  const historyWhen = ['38 min ago', 'Yesterday', '2 days ago', '3 days ago', '5 days ago', '6 days ago', '8 days ago']
  const history = historyWhen.map((when, i) => {
    const failedNow = row.status === 'Failed' && i === 0
    const flaky = r() < 0.12
    const status: TestStatus = failedNow ? 'Failed' : flaky ? 'Failed' : 'Passed'
    return { when, status, durationS: +(row.durationS * (0.85 + r() * 0.3)).toFixed(1) }
  })
  let failure
  if (row.status === 'Failed') {
    const t = ERROR_TEMPLATES[hash(testId) % ERROR_TEMPLATES.length]
    const msg = t.msg(row.name)
    failure = { errorMessage: msg, failingStep: t.step, stackTrace: buildStackTrace(appId, layerId, row, t.exc, msg) }
  }
  return {
    ...row, appId, layerId,
    path: `test_suites/${appDef.name}/${row.suite}/${row.release}/${row.name}.py`,
    history, failure,
  }
}

export function fxAllRuns(): RunSummary[] {
  const all: RunSummary[] = []
  for (const a of APP_DEFS) for (const l of LAYER_DEFS) all.push(...layerModel(a.id, l.id).recentRuns)
  const order = ['38 min ago', '3 h ago', 'Yesterday', '2 days ago', '4 days ago', '5 days ago']
  return all.sort((x, y) => order.indexOf(x.when) - order.indexOf(y.when))
}

export const DEFAULT_SETTINGS = {
  repoUrl: 'https://github.com/Aadrika8/test_suites.git',
  branch: 'main',
  cacheDir: '~/TestRunner/cache',
  timeoutSeconds: 60,
  rootFolder: 'test_suites',
  levels: ['application', 'suite', 'release'],
  extensions: ['.py'],
}
