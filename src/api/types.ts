export type Role = 'manager' | 'qa' | 'admin'

export interface User {
  username: string
  name: string
  role: Role
}

export type AppId = 'hrms' | 'cellsens' | 'preciv'
export type LayerId = 'unit' | 'integration' | 'system' | 'e2e'
export type AppIcon = 'people' | 'scope' | 'ruler'

export interface AppSummary {
  id: AppId
  name: string
  tag: string
  desc: string
  icon: AppIcon
  totalTests: number
  passRate: number
}

export interface LayerInfo {
  id: LayerId
  name: string
  short: string
  /** approximate share of all tests, 0..1 */
  share: number
  desc: string
  /** css custom property carrying the tier color */
  colorVar: string
  testCount: number
  passRate: number
}

export interface LayerSnapshot {
  total: number
  passed: number
  failed: number
  running: number
  skipped: number
  passRate: number
  /** percentage-point change vs 7 days ago */
  deltaVsLastWeek: number
}

export interface HistoryPoint {
  daysAgo: number
  passRate: number
  runs: number
}

export type RunStatus = 'Completed' | 'Running' | 'Failed'

export interface RunSummary {
  id: string
  appId: AppId
  layerId: LayerId
  name: string
  when: string
  total: number
  passed: number
  durationMin: number
  status: RunStatus
}

export interface LayerDashboard {
  snapshot: LayerSnapshot
  /** 90 days, oldest first */
  history: HistoryPoint[]
  recentRuns: RunSummary[]
}

export type TestStatus = 'Passed' | 'Failed' | 'Running' | 'Skipped'

export interface TestCaseRow {
  id: string
  name: string
  suite: string
  release: string
  status: TestStatus
  durationS: number
  lastRun: string
}

export interface TestRunRecord {
  when: string
  status: TestStatus
  durationS: number
}

export interface TestFailureDetail {
  errorMessage: string
  failingStep: string
  stackTrace: string
}

export interface TestDetail extends TestCaseRow {
  appId: AppId
  layerId: LayerId
  path: string
  history: TestRunRecord[]
  failure?: TestFailureDetail
}

export interface AppSettings {
  repoUrl: string
  branch: string
  cacheDir: string
  timeoutSeconds: number
  rootFolder: string
  levels: string[]
  extensions: string[]
}

export interface ManagedUser {
  username: string
  name: string
  role: Role
  lastActive: string
}
