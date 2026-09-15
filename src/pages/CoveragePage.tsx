/* Feature <-> System coverage, both directions, for one release.

   Two validations are being answered here, and they are two readings of one
   comparison rather than two reports:

     Feature -> System   every feature planned for this release is covered by
                         a system requirement
     System  -> Feature  every item in system scope is represented at feature
                         level

   The shared key is the identifier in the first column of each workbook, and
   it is the *only* key. Ids of any other family the feature row mentions —
   the CS ids — ride along as supporting evidence.

   The two directions are not mirror images, so they are not one table. A
   feature-side gap carries its supporting ids; a system-side gap has no
   feature row to read any from, and its table has no such column at all.
   Folding both into one grid would print an always-empty cell against half
   the rows and imply we had looked. */
import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  api, type CoverageEntry, type CoverageLayerInfo, type CoverageResponse,
  type CoverageStatus, type RelatedId,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { useReleases, withRelease } from '../lib/useRelease'
import { monthLabel } from '../lib/period'
import { cx, fmt } from '../lib/format'
import {
  Breadcrumbs, Card, EmptyState, KpiTile, PageTitle, Skeleton,
} from '../components/ui'
import { ReleaseSwitcher } from '../components/ReleaseSwitcher'
import { TraceConfigDialog } from '../components/TraceConfigDialog'
import {
  AlertTriangleIcon, SearchIcon, SlidersIcon,
} from '../components/icons'

type Tab = 'missing_in_system' | 'missing_in_feature' | 'covered' | 'outside' | 'quality'

const STATUS_LABEL: Record<CoverageStatus, string> = {
  covered: 'Covered',
  missing_in_system: 'Missing in System',
  missing_in_feature: 'Missing in Feature',
  unresolved: 'Unreadable id',
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'missing_in_system', label: STATUS_LABEL.missing_in_system },
  { key: 'missing_in_feature', label: STATUS_LABEL.missing_in_feature },
  { key: 'covered', label: STATUS_LABEL.covered },
  { key: 'outside', label: 'Outside references' },
  { key: 'quality', label: 'Data quality' },
]

/** A coverage figure keeps its decimal: 66.7% and 67% are different answers,
    and KpiTile's count-up animation rounds to whole numbers. */
function PctTile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="px-4.5 py-4">
      <div className="text-xs text-ink2">{label}</div>
      <div className="text-[27px] font-semibold tracking-tight mt-0.5 tabular-nums">
        {value.toFixed(1)}%
      </div>
      <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
    </Card>
  )
}

/** One direction as a part-to-whole bar. Two bars answer the page's two
    questions directly, in the proportions the numbers actually have — which a
    pair of percentages alone does not show. */
function DirectionBar({ label, covered, missing, pct, missingColor }: {
  label: string; covered: number; missing: number; pct: number; missingColor: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.25rem] items-center gap-3">
      <div className="text-[12.5px] text-ink2 font-medium">{label}</div>
      <div className="flex gap-0.5 h-4" role="img"
           aria-label={`${covered} covered, ${missing} missing`}>
        {covered > 0 && (
          <div className="h-full rounded-l bg-good first:rounded-l last:rounded-r"
               style={{ flex: covered }} />
        )}
        {missing > 0 && (
          <div className="h-full rounded-r first:rounded-l"
               style={{ flex: missing, background: missingColor }} />
        )}
      </div>
      <div className="text-[13px] font-semibold text-right tabular-nums">
        {pct.toFixed(1)}%
      </div>
    </div>
  )
}

const flat = (v: unknown) => String(v).replace(/\s+/g, ' ').trim()

/** The row's own text: what a reviewer needs to recognise the thing.

    Two cells are left out. The identifier column, because the id is already
    the row's first cell and printing it twice buries the description it was
    extracted from. And any cell a supporting id was read out of, because
    that text is what the chip beside it opens to show — printing it here as
    well is the wall of text the chips exist to avoid. */
function rowSummary(row: CoverageEntry['feature'], idColumn: string,
                    related: RelatedId[] = []): string {
  if (!row) return ''
  const shownElsewhere = new Set(related.map(r => flat(r.text)))
  return Object.entries(row.data)
    .filter(([key, v]) => key !== idColumn && v !== null && v !== undefined
      && flat(v) !== '' && !shownElsewhere.has(flat(v)))
    .map(([, v]) => String(v))
    .join(' · ')
}

/* A heading names the rows under it, so it is short. Anything longer came
   from the parser reading a lone data cell as a section title — real sheets
   do that — and printing it against every row beneath would say those rows
   belong to a feature they have nothing to do with. */
const HEADING_MAX = 40
function sectionOf(row: CoverageEntry['feature']): string {
  const section = row?.section ?? ''
  if (!section || section === 'General' || section.length > HEADING_MAX) return ''
  return section
}

function Provenance({ side, label }: { side: CoverageLayerInfo | null; label: string }) {
  if (!side) return null
  return (
    <span>
      <b className="text-ink2">{label}</b>{' '}
      {fmt(side.rowCount)} rows from {side.files.length} file{side.files.length === 1 ? '' : 's'}
      {side.latestPeriod && <> · {monthLabel(side.latestPeriod)}</>}
    </span>
  )
}

/** Which column each workbook was read for its identifier. Without it a
    reader has no way to tell a real gap from a misread sheet. */
function KeySource({ side, label }: { side: CoverageLayerInfo | null; label: string }) {
  if (!side || !side.idColumns.length) return null
  return (
    <span>
      <b className="text-ink2">{label}</b>{' '}
      {side.idColumns.map(f => `${f.fileName} → ${f.columnLabel}`).join(' · ')}
      {side.family && <> · ids start {side.family}</>}
    </span>
  )
}

function Warnings({ items }: { items: CoverageResponse['warnings'] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-2">
      {items.map(w => (
        <div key={w.code + w.side}
             className="flex items-start gap-2.5 rounded-lg border border-warning/45 bg-warning/12 px-3.5 py-2.5 text-[12.5px] text-ink2">
          <span className="text-warning mt-px shrink-0"><AlertTriangleIcon /></span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  )
}

/* Supporting ids, as ids. The cell each one came from is what makes it
   mean anything — `CS-4312` says nothing until you see it sitting in
   "CS-4312 - GPU: Support Blackwell Technology" — but printing that text
   against every chip turns a table you scan into a wall you read. So the
   chips stay terse and one opens on click. */
function Chips({ ids }: { ids: RelatedId[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!ids.length) {
    return <span className="text-muted text-[11.5px]">none on this row</span>
  }
  const shown = ids.find(r => r.id === open)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {ids.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(o => (o === r.id ? null : r.id))}
            aria-expanded={r.id === open}
            title={r.text || undefined}
            className={cx(
              'rounded-md border px-1.5 py-0.5 text-[11px] whitespace-nowrap transition-colors',
              r.id === open
                ? 'border-accent bg-accent-soft text-ink font-semibold'
                : 'border-grid bg-page text-ink2 hover:border-accent',
            )}
          >
            {r.id}
          </button>
        ))}
      </div>
      {shown && (
        <p className="text-[11.5px] text-ink2 leading-snug border-l-2 border-accent pl-2">
          {shown.text || <span className="text-muted">no text beside this id</span>}
        </p>
      )}
    </div>
  )
}

function IdCell({ entry }: { entry: CoverageEntry }) {
  return (
    <td className="px-4 py-2.5 font-semibold whitespace-nowrap align-top">
      {entry.id || <span className="text-muted font-normal">no id</span>}
      {entry.duplicate && (
        <span
          className="ml-1.5 text-warning align-middle"
          title={`Appears ${entry.featureCount}× in feature, ${entry.systemCount}× in system. A group filled down from one row counts as one.`}
        >
          <AlertTriangleIcon />
        </span>
      )}
    </td>
  )
}

function RowCell({ row, idColumn, related }: {
  row: CoverageEntry['feature']; idColumn: string; related?: RelatedId[]
}) {
  if (!row) return <td className="px-4 py-2.5 text-muted">—</td>
  const summary = rowSummary(row, idColumn, related)
  const section = sectionOf(row)
  return (
    <td className="px-4 py-2.5 max-w-[26rem] align-top">
      <div className="truncate">
        {summary || (
          <span className="text-muted">
            the row carries no cells beyond its id
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted truncate">
        {row.fileName}{section && <> · {section}</>}
      </div>
    </td>
  )
}

function Table({ head, note, children }: {
  head: string[]; note: string; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-grid">
              {head.map(h => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 bg-accent-soft/40 border-t border-grid text-[11.5px] text-ink2">
        {note}
      </p>
    </Card>
  )
}

const TR = 'border-b border-grid/60 last:border-0 hover:bg-accent-soft/40'

export function CoveragePage() {
  const { appId = '' } = useParams()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { releases, active, activeId, select } = useReleases(appId, reloadKey)

  const { data, loading, error } = useData<CoverageResponse | null>(
    () => (activeId ? api.getCoverage(appId, activeId) : Promise.resolve(null)),
    [appId, activeId, reloadKey],
  )

  const [tab, setTab] = useState<Tab>('missing_in_system')
  const [search, setSearch] = useState('')
  const [configuring, setConfiguring] = useState(false)

  // a fresh [] each render would defeat the memos below
  const entries = useMemo(() => data?.entries ?? [], [data])
  const summary = data?.summary
  // feature rows naming a feature id their workbook does not list; an
  // older backend sends none
  const outside = useMemo(() => data?.outsideReferences ?? [], [data])
  // feature rows whose text names another row of the same workbook — an
  // id problem, so it sits with the other data-quality entries
  const mismatches = useMemo(() => data?.idMismatches ?? [], [data])

  /* The identifier column, per file, so the tables can leave the id out of
     the description they print beside it. */
  const idColumns = useMemo(() => {
    const map: Record<string, string> = {}
    for (const side of [data?.feature, data?.system]) {
      for (const f of side?.idColumns ?? []) map[f.fileName] = f.column
    }
    return map
  }, [data])
  const idColumnOf = useCallback(
    (row: CoverageEntry['feature']) => (row && idColumns[row.fileName]) || '',
    [idColumns],
  )

  const counts = useMemo<Record<Tab, number>>(() => ({
    missing_in_system: entries.filter(e => e.status === 'missing_in_system').length,
    missing_in_feature: entries.filter(e => e.status === 'missing_in_feature').length,
    covered: entries.filter(e => e.status === 'covered').length,
    outside: outside.length,
    quality: entries.filter(e => e.duplicate || e.status === 'unresolved').length
      + mismatches.length,
  }), [entries, outside, mismatches])

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entries.filter(e => {
      const inTab = tab === 'quality'
        ? e.duplicate || e.status === 'unresolved'
        : e.status === tab
      if (!inTab) return false
      if (!needle) return true
      return e.id.toLowerCase().includes(needle)
        || e.relatedIds.some(r => r.id.toLowerCase().includes(needle))
        || rowSummary(e.feature, idColumnOf(e.feature), e.relatedIds)
             .toLowerCase().includes(needle)
        || rowSummary(e.system, idColumnOf(e.system)).toLowerCase().includes(needle)
    })
  }, [entries, tab, search, idColumnOf])

  const shownOutside = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return outside
    return outside.filter(r => [r.id, r.names, r.text, r.fileName]
      .some(v => v.toLowerCase().includes(needle)))
  }, [outside, search])

  const shownMismatches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return mismatches
    return mismatches.filter(r => [r.id, r.names, r.text, r.fileName]
      .some(v => v.toLowerCase().includes(needle)))
  }, [mismatches, search])

  const gaps = (summary?.missingInSystem ?? 0) + (summary?.missingInFeature ?? 0)
  const relatedLabel = summary?.relatedFamily
    ? `Related ${summary.relatedFamily} ids` : 'Related ids'

  const empty = <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">
    Nothing matches this search.
  </td></tr>

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appId, to: withRelease(`/apps/${appId}`, activeId) },
        { label: 'Traceability' },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <PageTitle lede="How this release's testing types trace to one another, checked on the identifier in each workbook's first column.">
          Traceability
        </PageTitle>
        <div className="flex items-center gap-2">
          <ReleaseSwitcher
            appId={appId}
            releases={releases}
            active={active}
            onSelect={select}
            onChanged={() => setReloadKey(k => k + 1)}
          />
          {hasRole('admin') && data?.config && (
            <button
              onClick={() => setConfiguring(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-grid text-[12.5px] hover:border-accent transition-colors"
            >
              <SlidersIcon /> Matching
            </button>
          )}
        </div>
      </div>

      {loading && <Skeleton className="h-96" />}
      {error && <EmptyState title="Could not load coverage" hint={error} />}

      {!loading && data?.errorCode && (
        <EmptyState
          title={
            data.errorCode === 'no_data' ? 'Nothing to compare yet'
              : data.errorCode === 'no_ids' ? 'No identifiers could be read'
              : 'Coverage cannot be computed'
          }
          hint={data.error ?? undefined}
        />
      )}

      {!loading && data && !data.errorCode && summary && (
        <div className="space-y-5">
          {/* one section per pair of testing types; Feature ↔ System is the
              only pair today */}
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Feature ↔ System</h2>
            <p className="text-[12.5px] text-muted mt-0.5 max-w-[72ch]">
              Every feature planned for this release should be covered by a system
              requirement, and every item in system scope should be represented at
              feature level. Both directions are checked.
            </p>
          </div>
          <Warnings items={data.warnings} />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
            <PctTile
              label="Features with a system test"
              value={summary.forwardCoveragePct}
              sub={`${fmt(summary.covered)} of ${fmt(summary.featureTotal)} features verified`}
            />
            <PctTile
              label="System items in the feature plan"
              value={summary.backwardCoveragePct}
              sub={`${fmt(summary.covered)} of ${fmt(summary.systemTotal)} system items planned`}
            />
            <KpiTile
              label="Gaps"
              value={gaps}
              sub={gaps === 0 ? 'both directions complete'
                : `${fmt(summary.missingInSystem)} one way · ${fmt(summary.missingInFeature)} the other`}
            />
            <KpiTile
              label="Data quality"
              value={summary.duplicates + summary.unresolved + mismatches.length}
              sub={`${fmt(summary.duplicates)} duplicate · ${fmt(summary.unresolved)} unreadable`
                + (mismatches.length ? ` · ${fmt(mismatches.length)} id mismatch` : '')}
            />
          </div>

          <Card className="p-5 space-y-4">
            <DirectionBar
              label="Feature → System"
              covered={summary.covered} missing={summary.missingInSystem}
              pct={summary.forwardCoveragePct} missingColor="var(--critical)"
            />
            <DirectionBar
              label="System → Feature"
              covered={summary.covered} missing={summary.missingInFeature}
              pct={summary.backwardCoveragePct} missingColor="var(--warning)"
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-3 border-t border-grid text-[11.5px] text-ink2">
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-good" />
                Covered · {fmt(summary.covered)}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-critical" />
                {STATUS_LABEL.missing_in_system} · {fmt(summary.missingInSystem)}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm bg-warning" />
                {STATUS_LABEL.missing_in_feature} · {fmt(summary.missingInFeature)}
              </span>
            </div>
            <p className="text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
              <Provenance side={data.feature} label="Feature:" />
              <Provenance side={data.system} label="System:" />
            </p>
            <p className="text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
              <KeySource side={data.feature} label="Read from:" />
              <KeySource side={data.system} label="and:" />
            </p>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map(t => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={t.key === tab}
                  onClick={() => setTab(t.key)}
                  className={cx(
                    'text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors',
                    t.key === tab
                      ? 'bg-accent text-white border-accent font-semibold'
                      : 'border-grid text-ink2 hover:border-accent',
                  )}
                >
                  {t.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative block">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search ids and rows"
                  className="w-56 bg-surface border border-grid rounded-lg pl-9 pr-3 py-2 text-[12.5px] outline-none focus:border-accent transition-colors"
                />
              </label>
            </div>
          </div>

          {/* Feature -> System: the feature row, and the supporting ids that
              row names. They are evidence for the gap, never matched on. */}
          {tab === 'missing_in_system' && (
            <Table
              head={['ID', 'Feature', relatedLabel, 'Status']}
              note={`${relatedLabel} are read from the same feature row and shown as supporting information — click one to see the text beside it in the sheet. They are not traceability keys: none of them is compared against System.`}
            >
              {shown.length ? shown.map(e => (
                <tr key={e.key} className={TR}>
                  <IdCell entry={e} />
                  <RowCell row={e.feature} idColumn={idColumnOf(e.feature)}
                           related={e.relatedIds} />
                  <td className="px-4 py-2.5 align-top w-[15rem]">
                    <Chips ids={e.relatedIds} />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-critical/12 text-crit-text">
                      {STATUS_LABEL.missing_in_system}
                    </span>
                  </td>
                </tr>
              )) : empty}
            </Table>
          )}

          {/* System -> Feature: no supporting-id column at all. The id has no
              feature row to read them from, and nothing is guessed at. */}
          {tab === 'missing_in_feature' && (
            <Table
              head={['ID', 'System requirement', 'Source', 'Status']}
              note="No supporting-id column here: this id has no feature row, so there is nothing to read them from and nothing is inferred."
            >
              {shown.length ? shown.map(e => (
                <tr key={e.key} className={TR}>
                  <IdCell entry={e} />
                  <td className="px-4 py-2.5 max-w-[26rem] align-top truncate">
                    {rowSummary(e.system, idColumnOf(e.system))
                      || <span className="text-muted">(no other cells)</span>}
                  </td>
                  <td className="px-4 py-2.5 align-top text-[11.5px] text-muted">
                    {e.system?.fileName}
                    {sectionOf(e.system) && <> · {sectionOf(e.system)}</>}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-warning/18 text-ink2">
                      {STATUS_LABEL.missing_in_feature}
                    </span>
                  </td>
                </tr>
              )) : empty}
            </Table>
          )}

          {tab === 'covered' && (
            <Table
              head={['ID', 'Feature', 'System', relatedLabel]}
              note="Both sides present. Supporting ids still come from the feature row only."
            >
              {shown.length ? shown.map(e => (
                <tr key={e.key} className={TR}>
                  <IdCell entry={e} />
                  <RowCell row={e.feature} idColumn={idColumnOf(e.feature)}
                           related={e.relatedIds} />
                  <RowCell row={e.system} idColumn={idColumnOf(e.system)} />
                  <td className="px-4 py-2.5 align-top w-[13rem]">
                    <Chips ids={e.relatedIds} />
                  </td>
                </tr>
              )) : empty}
            </Table>
          )}

          {/* A feature row naming a feature id its own workbook does not list.
              Nothing is wrong with the file — FL-5786 naming FL-5651 reads as
              the earlier feature it follows on from — so it is not one of the
              workbook's warnings; it is a question about this release's scope.
              Never matched on, so it moves no figure above. */}
          {tab === 'outside' && (
            <Table
              head={['ID', 'Refers to', 'Where it says so', 'File']}
              note="Read from the feature rows' own text and never counted as a match or a gap. If these are earlier features the work follows on from, nothing is wrong; if they belong in this release, they are missing from it."
            >
              {shownOutside.length ? shownOutside.map((r, i) => (
                <tr key={`${r.fileName}:${r.id}:${r.names}:${i}`} className={TR}>
                  <td className="px-4 py-2.5 align-top font-semibold whitespace-nowrap">{r.id}</td>
                  <td className="px-4 py-2.5 align-top whitespace-nowrap">
                    <span className="rounded-md bg-warning/15 text-warn-text px-1.5 py-0.5 text-[12px] font-semibold">
                      {r.names}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-top text-ink2">{r.text}</td>
                  <td className="px-4 py-2.5 align-top text-[11.5px] text-muted whitespace-nowrap">{r.fileName}</td>
                </tr>
              )) : outside.length ? empty : (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No feature row refers to a feature its workbook does not list.
                </td></tr>
              )}
            </Table>
          )}

          {/* An unreadable id is absent from *both* directions, which is
              precisely how a coverage report reaches 100% while being wrong.
              It stays visible rather than being quietly dropped. */}
          {tab === 'quality' && (
            <Table
              head={['ID', 'Problem', 'Where', 'Effect on coverage']}
              note="A group filled down from one row counts as one occurrence, not a duplicate — that is the parser carrying a sparse leading column, not the sheet repeating itself."
            >
              {/* problems first: the row is matched on its first column, and
                  if that id is the stale half the match is someone else's */}
              {shownMismatches.map((r, i) => (
                <tr key={`mm:${r.fileName}:${r.id}:${r.names}:${i}`} className={TR}>
                  <td className="px-4 py-2.5 align-top font-semibold whitespace-nowrap">{r.id}</td>
                  <td className="px-4 py-2.5 align-top">
                    Its text names {r.names}, a separate row in this workbook
                    <span className="block text-[11.5px] text-muted mt-0.5">“{r.text}”</span>
                  </td>
                  <td className="px-4 py-2.5 align-top text-[11.5px] text-muted">{r.fileName} · feature</td>
                  <td className="px-4 py-2.5 align-top">
                    Matched as {r.id}. If that id is the stale half, the match and this
                    row’s links belong to {r.names}.
                  </td>
                </tr>
              ))}
              {shown.length ? shown.map(e => {
                const row = e.feature ?? e.system
                const side = e.feature ? 'feature' : 'system'
                return (
                  <tr key={e.key} className={TR}>
                    <IdCell entry={e} />
                    <td className="px-4 py-2.5 align-top">
                      {e.status === 'unresolved'
                        ? 'First column holds no identifier'
                        : `Appears ${Math.max(e.featureCount, e.systemCount)}× in ${e.featureCount > 1 ? 'feature' : 'system'}`}
                    </td>
                    <td className="px-4 py-2.5 align-top text-[11.5px] text-muted">
                      {row?.fileName} · {side}
                      {sectionOf(row) && <> · {sectionOf(row)}</>}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      {e.status === 'unresolved'
                        ? 'Excluded from both directions.'
                        : 'Counted once. Flagged, not excluded.'}
                    </td>
                  </tr>
                )
              }) : shownMismatches.length ? null : empty}
            </Table>
          )}
        </div>
      )}

      {configuring && data?.config && (
        <TraceConfigDialog
          appId={appId}
          releaseId={activeId}
          config={data.config}
          onClose={() => setConfiguring(false)}
          onSaved={() => setReloadKey(k => k + 1)}
        />
      )}
    </>
  )
}
