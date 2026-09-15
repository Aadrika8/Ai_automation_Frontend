import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  api, type ColumnDef, type InventoryItem, type LayerDashboardResponse,
  type LayerFileInfo,
  type LayerInfo, type LayerRecordsResponse, type SnapshotInfo,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { useReleases, withRelease } from '../lib/useRelease'
import { loadedAtLabel, monthLabel } from '../lib/period'
import { cx, fmt } from '../lib/format'
import { layerAccentVar, layerColorVar } from '../lib/palette'
import { Breadcrumbs, Card, EmptyState, KpiTile, PageTitle, Segmented, Skeleton } from '../components/ui'
import { BarsChart } from '../components/charts/BarsChart'
import { StatusDonut } from '../components/charts/StatusDonut'
import { ReleaseSwitcher } from '../components/ReleaseSwitcher'
import { FileSelector, MERGED } from '../components/FileSelector'
import { LoadDialog } from '../components/LoadDialog'
import { SnapshotHistory } from '../components/SnapshotHistory'
import { QualityWarnings } from '../components/QualityWarnings'
/* UPLOAD DISABLED: import { UploadDialog } from '../components/UploadDialog' */
import { RefreshIcon, SearchIcon } from '../components/icons'

const PAGE_SIZE = 250

function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return typeof value === 'number' ? fmt(value) : value
}

function RecordsView({ records, loading, search, setSearch, page, setPage }: {
  records: LayerRecordsResponse | null
  loading: boolean
  search: string
  setSearch: (v: string) => void
  page: number
  setPage: (p: number) => void
}) {
  const pages = records ? Math.max(1, Math.ceil(records.total / records.pageSize)) : 1
  return (
    <div className="space-y-5">
      <label className="relative block max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search records…"
          className="w-full bg-surface border border-grid rounded-lg pl-9 pr-3 py-2 outline-none focus:border-accent transition-colors"
        />
      </label>
      {loading && <Skeleton className="h-64" />}
      {records && records.total === 0 && (
        <EmptyState title="No matching records" hint={search ? 'Try a different search term.' : undefined} />
      )}
      {records?.sections.map(section => (
        <Card key={section.name} className="overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pt-4 pb-3">
            <h3 className="font-semibold tracking-tight">{section.name}</h3>
            <span className="text-xs text-muted">{fmt(section.rowCount)} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  {records.columns.map(col => (
                    <th key={col.key} className={`px-5 py-2.5 font-semibold ${col.type === 'number' ? 'text-right' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i} className="border-b border-grid/60 last:border-0 hover:bg-accent-soft/40">
                    {records.columns.map(col => (
                      <td key={col.key}
                          className={`px-5 py-2 ${col.type === 'number' ? 'text-right tabular-nums font-medium' : 'text-ink2 whitespace-pre-line'}`}>
                        {cellText(row.data[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {records && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[12.5px]">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-grid disabled:opacity-40 hover:border-accent transition-colors">
            ← Previous
          </button>
          <span className="text-muted">Page {page} of {pages} · {fmt(records.total)} rows</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-grid disabled:opacity-40 hover:border-accent transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Run results ----------
   A sheet that records what happened when the tests ran gets a dashboard about
   that, rather than the count-and-group view. The pass rate is taken over what
   was executed (passed + failed); the tests nobody ran sit beside it instead of
   being folded into either side, because a run of 39 patterns that skipped 26
   cases has not passed them. Pass and fail carry the semantic colours, never
   the accent — the accent means "measured by us" everywhere else in the app. */

function pct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

/** One dimension value's composition: how much passed, how much failed. */
function PassFailRow({ label, passed, failed, notRun, widest }: {
  label: string
  passed: number
  failed: number
  notRun: number
  widest: number
}) {
  const executed = passed + failed
  const share = (n: number) => (widest > 0 ? (n / widest) * 100 : 0)
  return (
    <div className="grid grid-cols-[minmax(90px,1fr)_2.2fr_auto] items-center gap-3 text-[12px]">
      <div className="truncate text-ink2" title={label}>{label}</div>
      <div className="flex h-4 rounded-sm overflow-hidden bg-grid/50" role="img"
           aria-label={`${label}: ${passed} passed, ${failed} failed`}>
        <div style={{ width: `${share(passed)}%`, background: 'var(--good)' }} />
        <div style={{ width: `${share(failed)}%`, background: 'var(--critical)' }} />
        <div style={{ width: `${share(notRun)}%`, background: 'var(--axis)' }} />
      </div>
      <div className="tabular-nums text-right whitespace-nowrap">
        <span className="font-semibold">
          {executed > 0 ? `${((passed / executed) * 100).toFixed(0)}%` : '—'}
        </span>
        <span className="text-muted"> · {fmt(failed)} failed</span>
      </div>
    </div>
  )
}

function RunResultsView({ dash, onDimension }: {
  dash: LayerDashboardResponse
  onDimension: (key: string) => void
}) {
  const { profile } = dash
  const run = profile.runResults
  if (!run) return null

  const widest = Math.max(
    1, ...profile.byDimension.map(b => b.passed + b.failed + b.notRun))
  const dimension = profile.dimensions.find(d => d.key === profile.dimension)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <Card className="px-4.5 py-4">
          <div className="text-xs text-ink2">Pass rate</div>
          <div className="text-[27px] font-semibold tracking-tight mt-0.5"
               style={{ color: 'var(--good-text)' }}>
            {pct(run.passRatePct)}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            of {fmt(run.executed)} executed
          </div>
        </Card>
        <KpiTile label="Passed" value={run.passed} />
        <KpiTile label="Failed" value={run.failed}
                 sub={run.failedLabel ? `from ${run.failedLabel}` : undefined} />
        <KpiTile label="Not run" value={run.notRun}
                 sub={run.notRunLabel ? `from ${run.notRunLabel}` : undefined} />
        <KpiTile label="Planned" value={run.total}
                 sub={run.totalLabel ? `from ${run.totalLabel}` : undefined} />
      </div>

      {!run.reconciles && (
        <div className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
             style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}>
          <b>These columns do not add up.</b>{' '}
          <span className="text-ink2">
            {run.totalLabel} is {fmt(run.total)}, but passed + failed + not run comes to{' '}
            {fmt(run.passed + run.failed + run.notRun)} — a difference of{' '}
            {fmt(Math.abs(run.unaccounted))}. The rate above is over what was executed,
            so it is unaffected, but the sheet is worth a look.
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold tracking-tight mb-3">Outcome</h3>
          <StatusDonut
            centerBig={pct(run.passRatePct)}
            centerSmall="passed"
            parts={[
              { name: 'Passed', value: run.passed, color: 'var(--good)' },
              { name: 'Failed', value: run.failed, color: 'var(--critical)' },
              { name: 'Not run', value: run.notRun, color: 'var(--axis)' },
            ].filter(p => p.value > 0)}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
            <h3 className="font-semibold tracking-tight">
              By {dimension?.label.toLowerCase() ?? 'group'}
            </h3>
            {profile.dimensions.length > 1 && (
              <select
                value={profile.dimension}
                onChange={e => onDimension(e.target.value)}
                aria-label="Break the results down by"
                className="bg-surface border border-grid rounded-lg px-2 py-1 text-[12px] outline-none focus:border-accent">
                {profile.dimensions.map(d => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            )}
          </div>
          {profile.byDimension.length ? (
            <div className="space-y-2">
              {profile.byDimension.map(b => (
                <PassFailRow key={b.value} label={b.value} passed={b.passed}
                             failed={b.failed} notRun={b.notRun} widest={widest} />
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">
              No column in this sheet repeats its values often enough to group by.
            </p>
          )}
        </Card>
      </div>

      {profile.failingRows.length > 0 && (
        <Card className="overflow-hidden">
          <h3 className="font-semibold tracking-tight px-5 pt-4 pb-3">Where it failed</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  <th className="px-5 py-2.5 font-semibold">Run</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Failed</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Passed</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {profile.failingRows.map((row, i) => {
                  const executed = row.passed + row.failed
                  return (
                    <tr key={i} className="border-b border-grid/60 last:border-0">
                      <td className="px-5 py-2 font-medium">{row.label}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold"
                          style={{ color: 'var(--crit-text)' }}>{fmt(row.failed)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{fmt(row.passed)}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-ink2">
                        {executed > 0 ? `${((row.passed / executed) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------- Status ----------
   Some sheets record the outcome as a word against each row rather than as
   counts. The split is weighted by whatever the sheet counts, because a row is
   not a test: four rows carrying 12, 18, 9 and 14 test cases make three
   passing rows out of four read as 75% while the cases behind them are 83%.
   Which basis was used is always on screen. */

const STATUS_COLOR: Record<string, string> = {
  passing: 'var(--good)',
  failing: 'var(--critical)',
  pending: 'var(--warning)',
}

function StatusView({ dash }: { dash: LayerDashboardResponse }) {
  const { profile } = dash
  const s = profile.status
  if (!s) return null
  const weighted = s.basis === 'measure'
  const unit = weighted ? s.measureLabel.toLowerCase() : 'rows'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <Card className="px-4.5 py-4">
          <div className="text-xs text-ink2">Pass rate</div>
          <div className="text-[27px] font-semibold tracking-tight mt-0.5"
               style={{ color: 'var(--good-text)' }}>
            {pct(s.passRatePct)}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            of {fmt(s.decided)} {unit} decided
          </div>
        </Card>
        <KpiTile label="Passed" value={s.passed} sub={unit} />
        <KpiTile label="Failed" value={s.failed} sub={unit} />
        {s.pending > 0 && <KpiTile label="Pending" value={s.pending} sub={unit} />}
        <KpiTile label="Records" value={s.rowCount} />
      </div>

      <div className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-[12.5px]">
        <b className="text-accent">Read from {s.statusLabel}</b>{' '}
        <span className="text-ink2">
          {weighted
            ? `weighted by ${s.measureLabel} — each row counts for what it covers,
               not as one. Unweighted, the rate would be over ${fmt(s.rowCount)} rows.`
            : `counted by row — this sheet carries no measure to weight by.`}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold tracking-tight mb-3">{s.statusLabel}</h3>
          <StatusDonut
            centerBig={pct(s.passRatePct)}
            centerSmall="passed"
            parts={s.statuses.filter(b => b.measure > 0).map(b => ({
              name: b.value,
              value: b.measure,
              color: STATUS_COLOR[b.kind] ?? 'var(--axis)',
            }))}
          />
          {s.unrecognised > 0 && (
            <p className="text-[11.5px] text-muted mt-3">
              {fmt(s.unrecognised)} {unit} sit on a status this dashboard does not
              recognise as passing, failing or pending, so they are shown but left
              out of the rate.
            </p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <h3 className="font-semibold tracking-tight px-5 pt-4 pb-3">
            Every {s.statusLabel.toLowerCase()}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  <th className="px-5 py-2.5 font-semibold">Value</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Records</th>
                  <th className="px-5 py-2.5 font-semibold text-right">
                    {weighted ? s.measureLabel : 'Share'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.statuses.map(b => (
                  <tr key={b.value} className="border-b border-grid/60 last:border-0">
                    <td className="px-5 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: STATUS_COLOR[b.kind] ?? 'var(--axis)' }} />
                        <span className="font-medium">{b.value}</span>
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{fmt(b.rowCount)}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-semibold">
                      {weighted ? fmt(b.measure)
                        : `${((b.rowCount / Math.max(1, s.rowCount)) * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {profile.openRows.length > 0 && (
        <Card className="overflow-hidden">
          <h3 className="font-semibold tracking-tight px-5 pt-4 pb-3">Still open</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  <th className="px-5 py-2.5 font-semibold">Test</th>
                  <th className="px-5 py-2.5 font-semibold">{s.statusLabel}</th>
                  {weighted && (
                    <th className="px-5 py-2.5 font-semibold text-right">{s.measureLabel}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {profile.openRows.map((row, i) => (
                  <tr key={i} className="border-b border-grid/60 last:border-0">
                    <td className="px-5 py-2 font-medium">{row.label}</td>
                    <td className="px-5 py-2">{row.status}</td>
                    {weighted && (
                      <td className="px-5 py-2 text-right tabular-nums">{fmt(row.measure)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------- Inventory ----------
   A sheet with nothing to sum and nothing to score — the Feature workbook is
   thirteen features, each naming the work items behind it. What it can be
   asked is what it lists and how completely it is filled in, so the entry that
   names nothing is the headline rather than a row count nobody reads.

   Linkage is only shown when the sheet actually has a convention for it. One
   stray token in a description is not one. */

function ItemTable({ title, hint, items, linkFamily }: {
  title: string
  hint: string
  items: InventoryItem[]
  linkFamily: string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="text-[11.5px] text-muted mt-0.5">{hint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
              <th className="px-5 py-2.5 font-semibold">Identifier</th>
              <th className="px-5 py-2.5 font-semibold">Detail</th>
              {linkFamily && (
                <th className="px-5 py-2.5 font-semibold text-right">{linkFamily} ids</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-grid/60 last:border-0">
                <td className="px-5 py-2 font-medium whitespace-nowrap">{item.id}</td>
                <td className="px-5 py-2 text-ink2">{item.detail || '—'}</td>
                {linkFamily && (
                  <td className="px-5 py-2 text-right tabular-nums font-semibold">
                    {item.links || '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function InventoryView({ dash }: { dash: LayerDashboardResponse }) {
  const inv = dash.profile.inventory
  if (!inv) return null
  const linked = inv.linkFamily !== ''

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <KpiTile label={`${inv.family || 'Items'} listed`} value={inv.items}
                 sub={`read from ${inv.idLabel}`} />
        {linked && (
          <>
            <Card className="px-4.5 py-4">
              <div className="text-xs text-ink2">Linked</div>
              <div className="text-[27px] font-semibold tracking-tight mt-0.5"
                   style={{ color: inv.unlinked ? 'var(--ink)' : 'var(--good-text)' }}>
                {inv.linkedPct === null ? '—' : `${inv.linkedPct.toFixed(1)}%`}
              </div>
              <div className="text-[11.5px] text-muted mt-0.5">
                {fmt(inv.linked)} of {fmt(inv.items)} name a {inv.linkFamily} id
              </div>
            </Card>
            <KpiTile label={`${inv.linkFamily} ids named`} value={inv.links} />
            <KpiTile label="Naming none" value={inv.unlinked} />
          </>
        )}
        {inv.duplicates > 0 && <KpiTile label="Duplicate ids" value={inv.duplicates} />}
        {inv.unreadable > 0 && (
          <KpiTile label="No id readable" value={inv.unreadable}
                   sub={`rows where ${inv.idLabel} held no identifier`} />
        )}
      </div>

      {!linked && (
        <div className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-[12.5px]">
          <b className="text-accent">No linked work items in this sheet.</b>{' '}
          <span className="text-ink2">
            Nothing here names identifiers of another kind often enough to be a
            convention, so this is an inventory of {inv.items}{' '}
            {inv.family && `${inv.family} `}entries and nothing more is claimed.
          </span>
        </div>
      )}

      {linked && inv.unlinked > 0 && (
        <ItemTable
          title={`Naming no ${inv.linkFamily} id`}
          hint={`Every other entry in this sheet names the work behind it. These do not — either the link is missing or the work has not been raised.`}
          items={inv.unlinkedItems}
          linkFamily="" />
      )}

      {linked && (
        <ItemTable
          title={`Most ${inv.linkFamily} ids`}
          hint={`Where the work is concentrated: ${fmt(inv.links)} ${inv.linkFamily} ids across ${fmt(inv.linked)} entries.`}
          items={inv.mostLinked}
          linkFamily={inv.linkFamily} />
      )}
    </div>
  )
}

function DashboardView({ dash, loading, order, onDimension }: {
  dash: LayerDashboardResponse | null
  loading: boolean
  order: number
  onDimension: (key: string) => void
}) {
  // What was wrong with the workbook these figures came from. It sits above
  // whichever dashboard is drawn and never replaces one: the figures are still
  // the best available reading, and saying so beats an empty screen.
  const quality = <QualityWarnings warnings={dash?.warnings} />

  // A workbook that records outcomes gets a dashboard about them. Anything
  // else falls through to the count-and-group view below, unchanged.
  //
  // Deliberately not gated on `loading`: a refetch keeps the previous response,
  // so changing the breakdown updates the figures in place instead of dropping
  // the whole view — and the select the user just used — to a skeleton and back.
  if (dash?.profile?.kind === 'run_results') {
    return <div className="space-y-5">{quality}<RunResultsView dash={dash} onDimension={onDimension} /></div>
  }
  if (dash?.profile?.kind === 'status') {
    return <div className="space-y-5">{quality}<StatusView dash={dash} /></div>
  }
  if (dash?.profile?.kind === 'inventory') {
    return <div className="space-y-5">{quality}<InventoryView dash={dash} /></div>
  }
  const mergedNote = dash?.merged ? (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 text-[12.5px]">
      <b className="text-accent">
        Merged from {dash.mergedFiles.length} files
      </b>
      <span className="text-ink2">
        {dash.mergedFiles.map(f => f.fileName).join(' · ')} — current snapshot of
        each, added up for this view. The records themselves stay separate.
      </span>
    </div>
  ) : null
  if (loading || !dash) return <Skeleton className="h-80" />
  const measures: ColumnDef[] = dash.numericColumns
  // one file measures one thing: the rightmost numeric column, by the sheets'
  // own convention. Merged files may each measure something different, so the
  // chart follows the largest total rather than the last column.
  const primary: ColumnDef | undefined = dash.merged
    ? [...measures].sort(
        (a, b) => (dash.totals[b.key] ?? 0) - (dash.totals[a.key] ?? 0))[0]
    : measures[measures.length - 1]
  return (
    <div className="space-y-5">
      {quality}
      {mergedNote}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {/* merged data can hold several measures — showing only one would hide
            the rest, so every measure gets a tile */}
        {(dash.merged ? measures : primary ? [primary] : []).map(measure => (
          <KpiTile key={measure.key}
                   label={`Total ${measure.label.toLowerCase()}`}
                   value={dash.totals[measure.key] ?? 0} />
        ))}
        <KpiTile label="Records" value={dash.totalRows} />
        <KpiTile label="Sections" value={dash.sectionCount} />
        <Card className="px-4.5 py-4">
          <div className="text-xs text-ink2">{dash.merged ? 'Files' : 'Snapshot'}</div>
          <div className="text-[17px] font-semibold tracking-tight mt-1.5">
            {dash.merged
              ? fmt(dash.mergedFiles.length)
              : dash.snapshot ? monthLabel(dash.snapshot.period) : '—'}
          </div>
          {dash.merged ? (
            <div className="text-[11.5px] text-muted mt-0.5">
              merged at read time · not stored
            </div>
          ) : dash.snapshot && (
            <div className="text-[11.5px] text-muted mt-0.5">
              #{dash.snapshot.sequence} · {loadedAtLabel(dash.snapshot.createdAt)}
              {dash.snapshot.file && ` · ${dash.snapshot.file.split('/').pop()}`}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {primary && (
          <Card className="p-5">
            <h3 className="font-semibold tracking-tight mb-3">{primary.label} by section</h3>
            <BarsChart
              unitName={primary.label}
              data={dash.bySection.map(s => ({ label: s.section, value: s.sums[primary.key] ?? 0 }))}
            />
          </Card>
        )}
        <Card className="p-5">
          <h3 className="font-semibold tracking-tight mb-3">Records by section</h3>
          <StatusDonut
            centerBig={fmt(dash.totalRows)}
            centerSmall="records"
            parts={dash.bySection.map((s, i) => ({
              name: s.section, value: s.rowCount, color: `var(${layerColorVar(order + i)})`,
            }))}
          />
        </Card>
      </div>

      {dash.topRows.length > 0 && primary && (
        <Card className="overflow-hidden">
          <h3 className="font-semibold tracking-tight px-5 pt-4 pb-3">Largest test specs</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  <th className="px-5 py-2.5 font-semibold">Spec</th>
                  <th className="px-5 py-2.5 font-semibold">Section</th>
                  <th className="px-5 py-2.5 font-semibold text-right">{primary.label}</th>
                </tr>
              </thead>
              <tbody>
                {dash.topRows.map((row, i) => (
                  <tr key={i} className="border-b border-grid/60 last:border-0">
                    <td className="px-5 py-2 font-medium">{row.label}</td>
                    <td className="px-5 py-2 text-ink2">{row.section}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-semibold">{fmt(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export function LayerPage() {
  const { appId = '', layerId = '' } = useParams()
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const requestedView = params.get('view')
  const view = requestedView === 'data' || requestedView === 'history'
    ? requestedView : 'dashboard'
  // a snapshot named in the URL, or the current one; and which workbook's
  // dataset to read — the most recently loaded when none is named
  const snapshotParam = params.get('snapshot')
  const fileParam = params.get('file')
  // The dashboard opens on the merged total — every file's current snapshot
  // added together — unless a particular file or snapshot was asked for. A
  // testing type with one workbook answers as that workbook, so this is the
  // whole rule. Records and history stay per file either way.
  const mergedParam = params.get('merged') === '1'
  const wantMerged = view === 'dashboard'
    && (mergedParam || (!fileParam && !snapshotParam))

  const [reloadKey, setReloadKey] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loadingOpen, setLoadingOpen] = useState(false)
  /* UPLOAD DISABLED: const [uploading, setUploading] = useState(false) */

  // debounce the search box before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: apps } = useData(() => api.getApplications(), [])
  const appName = apps?.find(a => a.id === appId)?.name ?? appId
  // the release in ?release=, or the current one — layers and rows both hang off it
  const { releases, active, activeId, select } = useReleases(appId, reloadKey)
  const { data: layers } = useData(
    () => (activeId ? api.getLayers(appId, activeId) : Promise.resolve([] as LayerInfo[])),
    [appId, activeId, reloadKey],
  )
  const layer = layers?.find(l => l.id === layerId)
  // a layer added in one release need not exist in another
  const missingHere = layers != null && activeId !== '' && layer === undefined

  const { data: records, loading: recordsLoading, error } = useData<LayerRecordsResponse | null>(
    () => (activeId && !missingHere
      ? api.getLayerRecords(appId, activeId, layerId, {
          search: search || undefined, page, pageSize: PAGE_SIZE,
          file: (fileParam && !mergedParam) ? fileParam : undefined,
          snapshot: mergedParam ? undefined : (snapshotParam || undefined),
        })
      : Promise.resolve(null)),
    [appId, activeId, layerId, search, page, reloadKey, missingHere,
     snapshotParam, fileParam, mergedParam],
  )
  // which column a results dashboard breaks its figures down by. Empty means
  // "whatever the server picks"; a column this workbook lacks falls back there
  // too, so switching file or release can never strand the view on a dead key.
  const [dimension, setDimension] = useState('')
  const { data: dash, loading: dashLoading } = useData<LayerDashboardResponse | null>(
    () => (activeId && !missingHere
      // the breakdown travels with every dashboard read, merged or not — it
      // describes how to group the figures, not which snapshot to read
      ? api.getLayerDashboard(appId, activeId, layerId, {
          ...(wantMerged
            ? { merged: true }
            : { file: fileParam || undefined,
                snapshot: snapshotParam || undefined }),
          dimension: dimension || undefined,
        })
      : Promise.resolve(null)),
    [appId, activeId, layerId, reloadKey, missingHere, snapshotParam, fileParam,
     wantMerged, dimension],
  )
  // the server settles it: asking to merge one file returns that file
  const merged = view === 'dashboard' && (dash?.merged ?? false)
  const shown = records?.snapshot ?? dash?.snapshot ?? null
  // the file actually being read, as the server resolved it — the history and
  // the selector both follow it rather than guessing
  const shownFile = shown?.file ?? fileParam ?? null

  const { data: files } = useData<LayerFileInfo[] | null>(
    () => (activeId && !missingHere
      ? api.getLayerFiles(appId, activeId, layerId)
      : Promise.resolve(null)),
    [appId, activeId, layerId, reloadKey, missingHere],
  )
  const { data: snapshots, loading: historyLoading } = useData<SnapshotInfo[] | null>(
    () => (activeId && !missingHere
      ? api.getSnapshots(appId, activeId, layerId)
      : Promise.resolve(null)),
    [appId, activeId, layerId, reloadKey, missingHere],
  )

  function openSnapshot(snapshotId: string | null) {
    const next = new URLSearchParams(params)
    if (snapshotId) next.set('snapshot', snapshotId)
    else next.delete('snapshot')
    next.delete('view')
    setParams(next)
  }

  function openFile(file: string) {
    const next = new URLSearchParams(params)
    // a snapshot id belongs to the file it came from, so drop it either way
    next.delete('snapshot')
    if (file === MERGED) {
      next.set('merged', '1')
      next.delete('file')
      next.delete('view')          // merged figures live on the dashboard
    } else {
      next.delete('merged')
      next.set('file', file)
    }
    setParams(next)
  }

  // an empty state is only right when nothing is loaded at all — a search
  // that matches nothing is a different message
  const hasData = useMemo(
    () => (records ? records.total > 0 || search !== '' : false),
    [records, search],
  )
  const reload = () => setReloadKey(k => k + 1)

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appName, to: withRelease(`/apps/${appId}`, activeId) },
        { label: active ? `${layer?.name ?? layerId} · ${active.name}` : (layer?.name ?? layerId) },
      ]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <i className="w-2.5 h-10 rounded-full"
             style={{ background: `var(${layerAccentVar(layer?.order ?? 0, layers?.length ?? 1)})` }} />
          <PageTitle lede={layer?.desc}>{layer?.name ?? layerId}</PageTitle>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ReleaseSwitcher appId={appId} releases={releases} active={active}
                           onSelect={select} onChanged={reload} />
          {hasRole('qa') && !missingHere && (
            <button onClick={() => setLoadingOpen(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
              <RefreshIcon size={13} /> Load from Excel
            </button>
          )}
          {/* UPLOAD DISABLED
          {hasRole('qa') && !missingHere && (
            <button onClick={() => setUploading(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3.5 py-2 border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
              <UploadIcon size={13} /> Upload Excel
            </button>
          )}
          */}
          {/* deleting is per snapshot now — it lives in the History tab, where
              you can see which load you are removing */}
        </div>
      </div>

      <div className="mt-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <Segmented
          options={[{ label: 'Dashboard', value: 'dashboard' }, { label: 'Data', value: 'data' },
                    { label: 'History', value: 'history' }]}
          value={view}
          onChange={v => {
            const next = new URLSearchParams(params)
            if (v === 'dashboard') next.delete('view')
            else next.set('view', v)
            setParams(next, { replace: true })
          }}
        />
        {/* history covers every file at once, so a file picker would change
            nothing there */}
        {view !== 'history' && (
          <FileSelector files={files} activeFile={shownFile} merged={merged}
                        allowMerged={view === 'dashboard'} onSelect={openFile} />
        )}
      </div>

      {missingHere && (
        <EmptyState
          title={`${layerId} is not a testing layer in ${active?.name ?? 'this release'}`}
          hint="Releases keep their own testing layers. Switch release, or pick a layer from this one."
        />
      )}
      {!missingHere && error && <EmptyState title="Could not load this layer" hint={error} />}
      {/* History explains itself when empty, so it stays reachable even
          before anything has been loaded */}
      {!missingHere && !error && records && !hasData && view !== 'history' ? (
        <EmptyState
          title={`No data loaded yet for ${active?.name ?? 'this release'}`}
          hint={hasRole('qa')
            ? 'Refresh from Excel to read this layer’s workbook from this release’s folder.'
            : 'A QA engineer or admin needs to load this release from its Excel folder.'}
        />
      ) : !missingHere && !error && (
        <>
          {shown && !shown.isCurrent && !merged && view !== 'history' && (
            <div className={cx('flex flex-wrap items-center gap-2 mb-5 rounded-lg px-3.5 py-2.5',
                               'bg-accent-soft text-[12.5px]')}>
              <b className="text-accent">
                Viewing snapshot #{shown.sequence} of {shown.file.split('/').pop()} —{' '}
                {monthLabel(shown.period)}
              </b>
              <span className="text-ink2">
                loaded {loadedAtLabel(shown.createdAt)}. This is history, not the
                current state.
              </span>
              <button onClick={() => openSnapshot(null)}
                      className="ml-auto font-semibold text-accent hover:underline">
                Back to current
              </button>
            </div>
          )}
          {view === 'data' && (
            <>
              {mergedParam && (
                <div className="mb-5 rounded-lg bg-accent-soft px-3.5 py-2.5 text-[12.5px] text-ink2">
                  <b className="text-accent">Records are read one file at a time.</b>{' '}
                  Merging totals the dashboard figures only — the rows below are{' '}
                  {records?.snapshot?.file.split('/').pop() ?? 'the most recent file'}.
                  Pick another above, or switch to Dashboard for the merged totals.
                </div>
              )}
              <RecordsView records={records} loading={recordsLoading} search={searchInput}
                           setSearch={setSearchInput} page={page} setPage={setPage} />
            </>
          )}
          {view === 'dashboard' && (
            <DashboardView dash={dash} loading={dashLoading} order={layer?.order ?? 0}
                           onDimension={setDimension} />
          )}
          {view === 'history' && (
            <SnapshotHistory appId={appId} releaseId={activeId}
                             snapshots={snapshots} loading={historyLoading}
                             activeId={snapshotParam} activeFile={shownFile}
                             onOpen={openSnapshot} onChanged={reload} />
          )}
        </>
      )}

      {loadingOpen && (
        <LoadDialog appId={appId} releaseId={activeId} releaseName={active?.name ?? ''}
                    layerId={layerId}
                    onClose={() => setLoadingOpen(false)} onLoaded={reload} />
      )}
      {/* UPLOAD DISABLED
      {uploading && (
        <UploadDialog appId={appId} releaseId={activeId} releaseName={active?.name ?? ''}
                      layerId={layerId} layerName={layer?.name ?? layerId}
                      hasData={(layer?.recordCount ?? 0) > 0}
                      onClose={() => setUploading(false)} onUploaded={reload} />
      )}
      */}
    </div>
  )
}
