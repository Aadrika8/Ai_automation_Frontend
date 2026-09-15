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
  releaseCount: number
  /** rows across every release */
  recordCount: number
  /** the release the app opens on */
  currentRelease: string
  currentReleaseId: string
}

export interface AppCreate {
  name: string
  tag?: string
  desc?: string
  icon?: string
  /** the first release, created with the app and carrying the default pyramid */
  releaseName?: string
}

export interface AppUpdate {
  name?: string
  tag?: string
  desc?: string
  icon?: string
}

/** One version of an application under test. Releases roll roughly every six
    months; each keeps its own layers, Excel schema and data for good. */
export interface ReleaseInfo {
  id: string
  name: string
  desc: string
  /** Override for this release's folder, relative to settings.excelRoot.
      Blank — the normal case — means "<application name>/<release name>". */
  excelPath: string
  /** the release the UI opens by default — exactly one per application */
  current: boolean
  order: number
  layerCount: number
  recordCount: number
  createdAt: string | null
  lastUploadAt: string | null
}

export interface ReleaseCreate {
  name: string
  desc?: string
  excelPath?: string
  /** copy another release's layer structure — never its data or columns */
  copyLayersFrom?: string | null
  makeCurrent?: boolean
}

export interface ReleaseUpdate {
  name?: string
  desc?: string
  excelPath?: string
  /** true promotes this release to the current one */
  current?: boolean
}

export interface SourceFileInfo {
  name: string
  relativePath: string
  sizeBytes: number
  modifiedAt: string
  layerId: string | null
  changed: boolean
  error: string | null
}

export interface LayerSource {
  layerId: string
  layerName: string
  /** every workbook feeding this testing type; each becomes its own dataset */
  files: SourceFileInfo[]
  changed: boolean
  lastSyncedAt: string | null
  lastSyncedFile: string | null
}

export interface SourceStatus {
  root: string
  /** the one relative path this release reads, and whether it was set by hand
      or derived from the application and release names */
  folder: string
  customFolder: boolean
  resolvedPath: string
  releaseId: string
  releaseName: string
  ok: boolean
  errorCode: string | null
  error: string | null
  layers: LayerSource[]
  unmatchedFiles: SourceFileInfo[]
  changedCount: number
}

export interface SnapshotRequest {
  /** omitted = the current month */
  period?: SnapshotPeriod
  /** omitted = every testing type with exactly one matched workbook */
  layers?: Array<{ layerId: string; files: string[] }>
}

/** The outcome for one workbook. A load reports one of these per file. */
export interface SnapshotFileResult {
  layerId: string
  layerName: string
  file: string
  fileName: string
  /** false when the data was unchanged, or the load failed */
  created: boolean
  snapshotId: string | null
  sequence: number | null
  rowCount: number
  totalRows: number
  duplicatesSkipped: number
  diff: SnapshotDiff | null
  /** reported whether or not a snapshot was written: a workbook that has not
      changed since its last load still has whatever is wrong with it */
  warnings: QualityWarning[]
  /** the workbook this one used to be called, when a load recognised a rename
      and carried its history across rather than starting a second dataset */
  renamedFrom: string
  /** why nothing was written, when nothing was */
  reason: string | null
  error: string | null
}

export interface SnapshotRunResult {
  createdAt: string
  releaseId: string
  period: SnapshotPeriod
  files: SnapshotFileResult[]
  /** findings about the release as a whole rather than one workbook */
  warnings: QualityWarning[]
}

/** The month a snapshot describes — chosen when it is loaded. */
export interface SnapshotPeriod {
  year: number
  month: number
}

/** One workbook that went into a snapshot. */
export interface SnapshotSource {
  relativePath: string
  fileName: string
  fileHash: string
  sizeBytes: number
  modifiedAt: string | null
  rowsRead: number
  duplicatesSkipped: number
}

/** How a snapshot differs from the one before it. `comparable` is false when
    the two were keyed differently, so rows cannot be matched up. */
export interface SnapshotDiff {
  comparable: boolean
  comparedTo: number | null
  added: number
  changed: number
  removed: number
  reason: string | null
}

/** One workbook feeding a testing type, with the state of its current
    snapshot. Files are listed side by side and never added together. */
export interface LayerFileInfo {
  /** path relative to the release folder — the dataset's identity */
  file: string
  fileName: string
  snapshotId: string
  sequence: number
  period: SnapshotPeriod | null
  /** exact date and time this file was last loaded */
  loadedAt: string | null
  rowCount: number
  columnCount: number
  snapshotCount: number
  /** a pre-split load, kept as history */
  combined: boolean
}

/** Something wrong with one workbook, judged on its own — never a comparison
    with an earlier load. `problem` means data was lost or a figure is now
    wrong; `notice` means worth a look. Neither ever blocks a load. */
export interface QualityWarning {
  code: string
  severity: 'problem' | 'notice'
  message: string
}

/** One complete, read-only reading of ONE workbook. */
export interface SnapshotInfo {
  id: string
  layerId: string
  /** the workbook this snapshot was taken from */
  file: string
  sequence: number
  period: SnapshotPeriod
  rowCount: number
  totalRows: number
  duplicatesSkipped: number
  columns: ColumnDef[]
  sections: string[]
  identityKeys: string[]
  sources: SnapshotSource[]
  diff: SnapshotDiff | null
  /** what was wrong with the workbook when it was read. Snapshots taken
      before the check carry none. */
  warnings: QualityWarning[]
  /** true only for snapshots migrated from before files were kept separate */
  combined: boolean
  createdAt: string
  createdBy: string
  /** the newest snapshot of its testing type — what the app shows by default */
  isCurrent: boolean
}

export interface LayerInfo {
  id: string
  name: string
  short: string
  desc: string
  order: number
  /** rows held now, summed across this type's files — for the testing
      pyramid only; no combined dataset exists */
  recordCount: number
  /** test cases held now, from each file's total-test-count column; null
      when any of this type's files has none, so it is never a partial sum */
  testCount: number | null
  fileCount: number
  snapshotCount: number
  latestSnapshotAt: string | null
  latestPeriod: SnapshotPeriod | null
  latestSources: string[]
}

export interface LayerCreate {
  name: string
  short?: string
  desc?: string
  /** pyramid slot, bottom-first: 0 = base (most tests). Omitted = tip. */
  order?: number
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
  /** the schema of the snapshot being read, which may differ from any other */
  columns: ColumnDef[]
  snapshot: SnapshotInfo | null
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

/** What a results sheet said, and which of its columns said it. */
export interface RunResultsSummary {
  passed: number
  failed: number
  notRun: number
  /** passed + failed — the denominator the pass rate is taken over */
  executed: number
  /** what was planned, from the sheet's own total column */
  total: number
  passRatePct: number | null
  executedPct: number | null
  basisLabel: string
  /** false when the sheet's own total disagrees with passed + failed + not-run */
  reconciles: boolean
  unaccounted: number
  passedColumn: string
  passedLabel: string
  failedColumn: string
  failedLabel: string
  notRunColumn: string
  notRunLabel: string
  totalColumn: string
  totalLabel: string
}

export interface DimensionOption {
  key: string
  label: string
  distinct: number
}

export interface DimensionBucket {
  value: string
  rowCount: number
  passed: number
  failed: number
  notRun: number
  executed: number
  passRatePct: number | null
}

export interface FailingRow {
  label: string
  passed: number
  failed: number
  total: number
}

export interface StatusBucket {
  value: string
  /** passing | failing | pending | '' when the sheet uses a word we don't know */
  kind: string
  rowCount: number
  measure: number
}

/** An outcome recorded as a word against each row, weighted by what the row is
    worth — three passing rows of four is 75%, but the 44 test cases behind them
    out of 53 is 83%. */
export interface StatusSummary {
  statusColumn: string
  statusLabel: string
  measureColumn: string
  measureLabel: string
  basis: 'measure' | 'row_count'
  passed: number
  failed: number
  pending: number
  unrecognised: number
  /** passed + failed — the denominator the rate is taken over */
  decided: number
  total: number
  passRatePct: number | null
  rowCount: number
  statuses: StatusBucket[]
}

export interface OpenRow {
  label: string
  status: string
  measure: number
}

export interface InventoryItem {
  id: string
  detail: string
  links: number
}

/** A sheet that lists things rather than counting them: what it lists, and how
    completely each entry names the work behind it. */
export interface InventorySummary {
  idColumn: string
  idLabel: string
  /** the prefix the identifiers share, discovered rather than configured */
  family: string
  items: number
  unreadable: number
  duplicates: number
  /** the family of the supporting ids, '' when the sheet carries no links */
  linkFamily: string
  linked: number
  unlinked: number
  links: number
  linkedPct: number | null
  unlinkedItems: InventoryItem[]
  mostLinked: InventoryItem[]
}

/** Which dashboard this workbook's shape earned. `volume` is the count-and-group
    view every layer used to get; a more specific kind means the sheet carried
    something that view could not show. */
export interface DashboardProfile {
  kind: 'volume' | 'run_results' | 'status' | 'inventory'
  reason: string
  runResults: RunResultsSummary | null
  status: StatusSummary | null
  inventory: InventorySummary | null
  dimensions: DimensionOption[]
  dimension: string
  byDimension: DimensionBucket[]
  failingRows: FailingRow[]
  openRows: OpenRow[]
}

export interface LayerDashboardResponse {
  /** the one snapshot being read; null when the metrics are merged */
  snapshot: SnapshotInfo | null
  /** true when these figures add up several files' current snapshots. The
      merge happens at read time — no combined records are stored. */
  merged: boolean
  mergedFiles: LayerFileInfo[]
  totalRows: number
  sectionCount: number
  numericColumns: ColumnDef[]
  totals: Record<string, number>
  bySection: SectionAggregate[]
  topRows: TopRow[]
  /** what kind of data this workbook holds, and so what to draw for it */
  profile: DashboardProfile
  /** what was wrong with the workbook these figures came from */
  warnings: QualityWarning[]
}

export interface AppSettings {
  /** parent folder holding one sub-folder per application — the only setting */
  excelRoot: string
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

/* --- traceability: Feature <-> System coverage -------------------------- */

/** Where one testing layer keeps the identifier the two sides share.

    Empty means the rule: the first column of whichever workbook the row came
    from. A column key is an override for a sheet whose first column is
    unusable, and is ignored by any file that does not have it. */
export interface TraceKeyConfig {
  column: string
}

/** Which column one workbook's identifier was actually read from. */
export interface TraceFileRead {
  fileName: string
  column: string
  columnLabel: string
}

/** What reading the first column produced for one layer. With the source
    fixed by rule, the question is no longer "which column?" but "did that
    column give us identifiers?" — which only real extracted values answer. */
export interface TraceSideRead {
  /** the prefix these ids share ("FL"), discovered from the data */
  family: string
  /** every column these workbooks carry — the identifier picker's options.
      The first column is the default, not a rule: plenty of sheets open with
      a serial number and keep the identifier in the second. */
  columns: ColumnDef[]
  files: TraceFileRead[]
  extracted: string[]
  distinctIds: number
  matchedRows: number
  totalRows: number
  unresolvedRows: number
  /** share of ids with no alphabetic prefix — a first column of bare 1, 2, 3 */
  numericRatio: number
}

export interface TraceConfig {
  /** false when nothing has been saved — the values are then what the
      first-column rule produced, which is usable as it stands */
  configured: boolean
  featureLayer: string
  systemLayer: string
  /** regex pulling ids out of a cell; empty means the built-in token */
  pattern: string
  layers: Record<string, TraceKeyConfig>
  /** what the rule in force actually read, per layer */
  read: Record<string, TraceSideRead>
  updatedAt: string | null
  updatedBy: string
}

export interface TraceConfigUpdate {
  pattern: string
  layers: Record<string, TraceKeyConfig>
}

export interface TracePreview {
  layerId: string
  column: string
  pattern: string
  read: TraceSideRead
}

export type CoverageStatus =
  | 'covered'
  | 'missing_in_system'
  | 'missing_in_feature'
  | 'unresolved'

/** One ingested row, as it appears on its side of the comparison. */
export interface CoverageSideRow {
  section: string
  data: Record<string, CellValue>
  file: string
  fileName: string
  snapshotId: string
}

/** A supporting identifier, and the cell it was read out of. The id alone
    does not say what it refers to: `CS-4312` means nothing until you can see
    it sitting in "CS-4312 - GPU: Support Blackwell Technology". The list stays
    scannable and the text is there when it is asked for. */
export interface RelatedId {
  id: string
  text: string
}

export interface CoverageEntry {
  /** stable list key: the folded id, or a synthetic one for an unreadable row */
  key: string
  /** the id spelled as the sheet spells it */
  id: string
  status: CoverageStatus
  /** the same id more than once on a side — reported alongside the coverage
      verdict rather than replacing it */
  duplicate: boolean
  /** occurrences on each side, counting a forward-filled group as one */
  featureCount: number
  systemCount: number
  feature: CoverageSideRow | null
  system: CoverageSideRow | null
  /** ids of the supporting family the FEATURE row mentions — the CS ids.
      Evidence shown beside the gap, never a key: an entry missing from
      feature has no feature row to read them from, so this stays empty. */
  relatedIds: RelatedId[]
  /** which side an unresolved row came from */
  side: string
}

export interface CoverageSummary {
  featureTotal: number
  systemTotal: number
  covered: number
  missingInSystem: number
  missingInFeature: number
  duplicates: number
  unresolved: number
  /** the prefix the key ids share ("FL"), discovered from the first column */
  family: string
  /** the prefix the supporting ids share ("CS") — lets the table name its
      column honestly instead of hardcoding a value nothing here should know */
  relatedFamily: string
  /** Feature -> System: every feature planned has a system requirement */
  forwardCoveragePct: number
  /** System -> Feature: every system scope item is represented at feature level */
  backwardCoveragePct: number
}

/** Which data one side of the comparison was read from. */
export interface CoverageLayerInfo {
  layerId: string
  layerName: string
  rowCount: number
  files: string[]
  snapshotIds: string[]
  latestPeriod: SnapshotPeriod | null
  missing: boolean
  /** the column each of this layer's workbooks was read for identifiers */
  idColumns: TraceFileRead[]
  family: string
}

/** Something that would make these figures misleading at face value. Never
    stops the comparison: a report that refuses to run teaches nobody
    anything; one that runs and says why it looks odd can be acted on. */
export interface CoverageWarning {
  code: 'family_mismatch' | 'numeric_key_column'
  side: string
  message: string
}

/** A feature row naming a feature id its own workbook does not list. Read
    from the row's text and never matched on, so it moves no coverage figure. */
export interface OutsideReference {
  /** the row's own id */
  id: string
  /** the id its text names */
  names: string
  /** the cell it is named in */
  text: string
  fileName: string
}

/** A feature row whose text names another row of the same workbook. The
    row is matched on its own id; if that is the stale half, the match belongs
    to the id its text names. */
export interface IdMismatch {
  /** the row's own id — the one it is matched on */
  id: string
  /** the other row's id, named in its text */
  names: string
  /** the cell it is named in */
  text: string
  fileName: string
}

export interface CoverageResponse {
  configured: boolean
  /** set when the comparison could not run — an unloaded layer, say, or a
      saved column this release's workbooks no longer have */
  errorCode: string | null
  error: string | null
  config: TraceConfig | null
  feature: CoverageLayerInfo | null
  system: CoverageLayerInfo | null
  summary: CoverageSummary
  entries: CoverageEntry[]
  warnings: CoverageWarning[]
  /** feature rows naming a feature id their workbook does not list */
  outsideReferences: OutsideReference[]
  /** feature rows whose text names another row of the same workbook */
  idMismatches: IdMismatch[]
}

/* --- benchmark: automation coverage ------------------------------------ */

/** One published study behind the reference. Provenance travels with the
    number: a figure whose publisher sells automation tooling reads
    differently from one that does not. */
export interface BenchmarkSource {
  value: number
  label: string
  publisher: string
  publisherKind: string
  sample: string
  year: number
}

/** The industry side — curated, never computed, never merged with Evident's. */
export interface AutomationReference {
  metric: string
  scope: string
  low: number
  high: number
  /** the range is the spread of the sources, not a published figure */
  synthesised: boolean
  selfReported: boolean
  lifeScienceSpecific: boolean
  sources: BenchmarkSource[]
  caveats: string[]
}

export interface AutomationLayer {
  layerId: string
  name: string
  /** false when the workbooks carry no automated count — not the same as zero */
  measured: boolean
  reason: string
  automated: number
  total: number
  coveragePct: number | null
  /** "test_count" or "row_count" — which measure the share was taken over */
  basis: string
  basisLabel: string
  rowCount: number
  automatedColumn: string
  automatedLabel: string
  totalColumn: string
  totalLabel: string
}

/** Evident's side — counts added across layers, then divided. */
export interface AutomationMeasurement {
  measured: boolean
  automated: number
  total: number
  coveragePct: number | null
  basis: string
  unmeasuredLayers: string[]
  layers: AutomationLayer[]
}

/** Whole points only: the reference is a spread of self-reported estimates. */
export interface ReferenceDistance {
  position: 'below' | 'within' | 'above' | 'unmeasured'
  points: number | null
}

export interface AutomationCoverageResponse {
  releaseId: string
  releaseName: string
  latestPeriod: SnapshotPeriod | null
  evident: AutomationMeasurement
  reference: AutomationReference
  distance: ReferenceDistance
}

/** One release's automation coverage, and its change from the last one. */
export interface AutomationTrendPoint {
  releaseId: string
  releaseName: string
  order: number
  current: boolean
  measured: boolean
  automated: number
  total: number
  coveragePct: number | null
  basis: string
  unmeasuredLayers: string[]
  latestPeriod: SnapshotPeriod | null
  /** change in percentage points from the previous *measured* release */
  deltaPct: number | null
  comparedTo: string
}

/** Release history beside the industry reference. The history is the
    comparison that holds: measured against measured, same definition and same
    counting rules. */
export interface AutomationTrendResponse {
  appId: string
  /** oldest release first, so the series reads left to right */
  points: AutomationTrendPoint[]
  reference: AutomationReference
  measuredReleases: number
}

/* --- release QA report ---------------------------------------------------- */

/** One point in the report, and the pages it came from. */
export interface ReportPoint {
  text: string
  /** pyramid | traceability | automation | layer:<id> */
  sources: string[]
  /** a line the app added from the data because the draft left it out */
  added?: boolean
}

export interface ReportRisk extends ReportPoint {
  severity: 'high' | 'medium' | 'low'
}

export interface QAReportBody {
  summary: string
  findings: ReportPoint[]
  gaps: ReportPoint[]
  risks: ReportRisk[]
  recommendations: ReportPoint[]
}

export interface SavedReport {
  id: string
  createdAt: string
  createdBy: string
  model: string
  releaseName: string
  /** the month the release's data describes, "2026-09" */
  period: string
  /** layer id -> name, to label a layer source */
  layerNames: Record<string, string>
  report: QAReportBody
  /** figures the report uses that the release's data does not hold */
  unverified: string[]
  /** what every report must cover and this one left out */
  notCovered: string[]
  /** what the draft left out and the app added from the data */
  addedFromData: string[]
}

export interface ReportResponse {
  /** false when the server has no OpenAI key */
  configured: boolean
  model: string
  report: SavedReport | null
  /** the data has changed since the report was written */
  stale: boolean
}
