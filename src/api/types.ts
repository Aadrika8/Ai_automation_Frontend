export type Role = 'manager' | 'qa' | 'admin'

/** Hierarchical role ranks: manager ⊂ qa ⊂ admin (mirrors the backend). */
export const ROLE_RANK: Record<Role, number> = { manager: 0, qa: 1, admin: 2 }

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
  /** of the failed tests, how many are pre-existing tracked bugs */
  knownBugs: number
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

export interface HourPoint {
  hoursAgo: number
  passRate: number
  runs: number
}

export interface SuiteVersion {
  current: string
  lastUpdated: string
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
  /** last 24 hours, oldest first */
  hourly: HourPoint[]
  version: SuiteVersion
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

export interface ReportIssue {
  title: string
  affectedTests: number
  likelyCauses: string[]
  suggestedFixes: string[]
}

export interface AiReport {
  summary: string
  healthAssessment: string
  topIssues: ReportIssue[]
  recommendations: string[]
  generatedAt: string
  model: string
  cached: boolean
}
