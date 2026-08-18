export type Role = 'manager' | 'qa' | 'admin'

/** Hierarchical role ranks: manager ⊂ qa ⊂ admin (mirrors the backend). */
export const ROLE_RANK: Record<Role, number> = { manager: 0, qa: 1, admin: 2 }

export interface User {
  username: string
  name: string
  role: Role
}

/** A cell value from an ingested spreadsheet. */
export type CellValue = string | number | null

export interface ColumnDef {
  /** sanitized data key, e.g. "test_count" */
  key: string
  /** original header label, e.g. "Test Count" */
  label: string
  type: 'string' | 'number'
}

export interface AppSummary {
  id: string
  name: string
  tag: string
  desc: string
  icon: string
  layerCount: number
  recordCount: number
}

export interface AppCreate {
  name: string
  tag?: string
  desc?: string
  icon?: string
}

export interface LayerInfo {
  id: string
  name: string
  short: string
  desc: string
  order: number
  recordCount: number
  lastUploadAt: string | null
  lastUploadFile: string | null
}

export interface LayerCreate {
  name: string
  short?: string
  desc?: string
}

export interface UploadResult {
  uploadId: string
  fileName: string
  columns: ColumnDef[]
  sections: string[]
  totalRows: number
  inserted: number
  updated: number
  unchanged: number
  duplicatesSkipped: number
  uploadedBy: string
  uploadedAt: string
}

export interface RecordRow {
  section: string
  data: Record<string, CellValue>
}

export interface SectionGroup {
  name: string
  rowCount: number
  rows: RecordRow[]
}

export interface LayerRecordsResponse {
  columns: ColumnDef[]
  lastUpload: UploadResult | null
  total: number
  page: number
  pageSize: number
  sections: SectionGroup[]
}

export interface SectionAggregate {
  section: string
  rowCount: number
  sums: Record<string, number>
}

export interface TopRow {
  section: string
  label: string
  value: number
}

export interface LayerDashboardResponse {
  lastUpload: UploadResult | null
  totalRows: number
  sectionCount: number
  numericColumns: ColumnDef[]
  totals: Record<string, number>
  bySection: SectionAggregate[]
  topRows: TopRow[]
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
  lastActive: string | null
}

export interface UserCreate {
  username: string
  name: string
  password: string
  role: Role
}
