/* Load a release's Excel folder into snapshots.

   Nothing is chosen from the local machine: the workbooks come from the path
   an admin configured. There is no merge-or-replace choice either — a load
   records a complete, read-only snapshot per *workbook*, so an earlier one is
   never rewritten and two files are never merged. The dialog asks the one
   thing the backend will not guess: which month the data describes. Ticking
   files still chooses what to read; each ticked file becomes its own
   snapshot. */
import { useEffect, useState } from 'react'
import {
  api, type SnapshotFileResult, type SnapshotPeriod, type SnapshotRunResult, type SourceStatus,
} from '../api'
import { Modal } from './Modal'
import { AlertTriangleIcon } from './icons'
import { Callout, WarningCallout } from './QualityWarnings'
import { warningLabel } from '../lib/warnings'
import { cx, fmt, timeAgo } from '../lib/format'
import { monthLabel, thisMonth } from '../lib/period'

function Bytes({ n }: { n: number }) {
  return <>{n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`}</>
}

const FIELD = 'bg-surface border border-grid rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-accent transition-colors'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

/* ---------- what the load did ----------
   A load reports one line per workbook, and most are unchanged and clean. So
   the dialog leads with three counts — read, new snapshots, to look at — and
   lists the workbooks by what they need: failed, problems, new snapshots,
   notices, and below a rule the ones with nothing to report. A warning shows
   twice: its short name on the row's pill, its full text in a callout. */

type Outcome = 'failed' | 'problem' | 'new' | 'notice' | 'renamed' | 'unchanged'

/** List order. A new snapshot outranks a notice: it is what the load was for,
    and a notice is by definition something that cost nothing. */
const ORDER: Record<Outcome, number> = {
  failed: 0, problem: 1, new: 2, notice: 3, renamed: 4, unchanged: 5,
}

/** The one thing a row's pill says. A warning outranks what happened to the
    snapshot, because the snapshot's state is also on the line under the name. */
function outcomeOf(f: SnapshotFileResult): Outcome {
  if (f.error) return 'failed'
  if (f.warnings.some(w => w.severity === 'problem')) return 'problem'
  if (f.warnings.length > 0) return 'notice'
  if (f.created) return 'new'
  return f.renamedFrom ? 'renamed' : 'unchanged'
}

function folderOf(file: string): string {
  const cut = file.lastIndexOf('/')
  return cut >= 0 ? file.slice(0, cut + 1) : ''
}

/** What happened to the snapshot, in the words under the file name. Left out
    where the pill already says it. */
function snapshotLine(f: SnapshotFileResult, outcome: Outcome): string {
  if (f.error) return 'not loaded'
  if (f.created) {
    const d = f.diff
    const counts = !d ? `${fmt(f.rowCount)} records`
      : !d.comparable ? (d.reason ?? '')
        : d.comparedTo === null ? 'first snapshot of this workbook'
          : `${d.added} added · ${d.changed} changed · ${d.removed} removed vs #${d.comparedTo}`
    return outcome === 'new' ? counts : `snapshot #${f.sequence} · ${counts}`
  }
  if (f.renamedFrom) {
    const was = f.renamedFrom.slice(f.renamedFrom.lastIndexOf('/') + 1)
    return `was ${was}, history carried across`
  }
  if (outcome === 'unchanged') return ''
  const since = f.reason?.match(/#(\d+)/)?.[1]
  return since ? `no change since #${since}` : (f.reason ?? '')
}

const PILL = 'inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

function OutcomePill({ f, outcome }: { f: SnapshotFileResult; outcome: Outcome }) {
  // the worst finding names the pill; the rest are counted, and all of them
  // are written out in the callouts underneath
  const worst = f.warnings.find(w => w.severity === 'problem') ?? f.warnings[0]
  const more = f.warnings.length > 1 ? ` +${f.warnings.length - 1}` : ''
  switch (outcome) {
    case 'failed':
      return <span className={cx(PILL, 'bg-critical/10 text-crit-text')}><AlertTriangleIcon size={11} />Failed</span>
    case 'problem':
      return <span className={cx(PILL, 'bg-critical/10 text-crit-text')}><AlertTriangleIcon size={11} />{warningLabel(worst.code)}{more}</span>
    case 'notice':
      return <span className={cx(PILL, 'bg-warning/15 text-warn-text')}>{warningLabel(worst.code)}{more}</span>
    case 'new':
      return <span className={cx(PILL, 'bg-accent-soft text-accent')}>New · #{f.sequence}</span>
    case 'renamed':
      return <span className={cx(PILL, 'bg-muted/15 text-muted')}>Renamed</span>
    default:
      return <span className={cx(PILL, 'bg-muted/15 text-muted')}>No change</span>
  }
}

function Tile({ value, label, dot }: { value: string; label: string; dot: string }) {
  return (
    <div className="min-w-0 px-3 py-2.5 border-l border-grid first:border-l-0">
      <div className="flex items-center gap-1.5 text-[20px] font-semibold tracking-tight tabular-nums">
        <i className={cx('w-[7px] h-[7px] rounded-full shrink-0', dot)} />
        {value}
      </div>
      <div className="text-[11.5px] text-muted leading-tight">{label}</div>
    </div>
  )
}

function LoadResults({ result, onClose }: { result: SnapshotRunResult; onClose: () => void }) {
  const rows = result.files
    .map((f, i) => ({ f, i, outcome: outcomeOf(f) }))
    .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || a.i - b.i)

  const total = result.files.length
  const read = result.files.filter(f => !f.error).length
  const created = result.files.filter(f => f.created).length
  const flagged = rows.filter(r => r.f.error || r.f.warnings.length > 0).length + result.warnings.length
  const anyProblem = rows.some(r => r.outcome === 'failed' || r.outcome === 'problem')
    || result.warnings.some(w => w.severity === 'problem')
  const anyWarning = result.warnings.length > 0 || rows.some(r => r.f.warnings.length > 0)

  const note = created > 0
    ? `${created} snapshot${created === 1 ? '' : 's'} saved.${anyWarning ? ' Warnings never stop a load.' : ''}`
    : read === total
      ? `Nothing new was written: ${total === 1 ? 'the workbook matches its' : `all ${total} match their`} last snapshot.`
      : 'Nothing new was written.'

  // the rule sits above the first row with nothing to report, when there are
  // rows above it to separate from
  const firstQuiet = rows.findIndex(r => r.outcome === 'renamed' || r.outcome === 'unchanged')

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-muted">{monthLabel(result.period)}</p>

      <div className="grid grid-cols-3 border border-grid rounded-lg overflow-hidden">
        <Tile value={`${read} / ${total}`} label="workbooks read"
              dot={read < total ? 'bg-critical' : 'bg-good'} />
        <Tile value={fmt(created)} label={created === 1 ? 'new snapshot' : 'new snapshots'}
              dot={created > 0 ? 'bg-accent' : 'bg-grid'} />
        <Tile value={fmt(flagged)} label="to look at"
              dot={anyProblem ? 'bg-critical' : flagged > 0 ? 'bg-warning' : 'bg-good'} />
      </div>

      {/* about the release rather than one workbook — two files holding the
          same rows, for one */}
      {result.warnings.map(w => <WarningCallout key={w.code} warning={w} />)}

      <div>
        {rows.map(({ f, outcome }, n) => {
          const quiet = outcome === 'renamed' || outcome === 'unchanged'
          const attention = !!f.error || f.warnings.length > 0
          const line = [f.layerName, snapshotLine(f, outcome)].filter(Boolean).join(' · ')
          return (
            <div key={`${f.layerId}:${f.file}`}>
              {n === firstQuiet && n > 0 && <div className="h-px bg-grid mx-1 my-1.5" />}
              <div className={cx('rounded-xl px-2.5 py-2', attention && 'bg-ink/[0.035]')}>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className={cx('text-[13px] truncate',
                                       quiet ? 'font-medium text-ink2' : 'font-semibold')}>
                      <span className="text-muted font-normal">{folderOf(f.file)}</span>
                      {f.fileName || f.layerName}
                    </div>
                    <div className="text-[11.5px] text-muted">{line}</div>
                  </div>
                  <OutcomePill f={f} outcome={outcome} />
                </div>
                {f.error && <Callout problem title="Couldn’t load">{f.error}</Callout>}
                {/* reported whether or not a snapshot was written — an
                    unchanged workbook still has whatever is wrong with it */}
                {f.warnings.map(w => <WarningCallout key={w.code} warning={w} />)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-grid">
        <p className="flex-1 text-[11.5px] text-muted leading-snug">{note}</p>
        <button onClick={onClose}
                className="bg-accent text-white font-semibold rounded-lg px-5 py-2 hover:brightness-110 transition">
          Done
        </button>
      </div>
    </div>
  )
}

export function LoadDialog({ appId, releaseId, releaseName, layerId, onClose, onLoaded }: {
  appId: string
  releaseId: string
  releaseName: string
  /** limit the load to one testing type; omitted loads every matched one */
  layerId?: string
  onClose: () => void
  onLoaded: () => void
}) {
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [period, setPeriod] = useState<SnapshotPeriod>(thisMonth)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SnapshotRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSource(appId, releaseId)
      .then(s => {
        setStatus(s)
        // default selection: every workbook matched to each testing type
        setPicked(Object.fromEntries(s.layers.map(l => [l.layerId, l.files.map(f => f.relativePath)])))
      })
      .catch(e => setLoadError((e as Error).message))
  }, [appId, releaseId])

  const layers = (status?.layers ?? []).filter(l => (layerId ? l.layerId === layerId : true))
  const withFiles = layers.filter(l => l.files.length > 0)
  const changed = withFiles.filter(l => l.changed)

  function toggle(layer: string, file: string) {
    setPicked(prev => {
      const current = prev[layer] ?? []
      return {
        ...prev,
        [layer]: current.includes(file) ? current.filter(f => f !== file) : [...current, file],
      }
    })
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const chosen = withFiles
        .map(l => ({ layerId: l.layerId, files: picked[l.layerId] ?? [] }))
        .filter(c => c.files.length > 0)
      setResult(await api.createSnapshots(appId, releaseId, { period, layers: chosen }))
      onLoaded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={layerId ? `Load this testing type — ${releaseName}`
                          : `Load ${releaseName} from Excel`} onClose={onClose}>
      {loadError && <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{loadError}</p>}

      {status && !status.ok && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{status.error}</p>
          <p className="text-[11.5px] text-muted">
            An admin can correct the root folder in Settings, or this release’s folder on the
            application’s layers page.
          </p>
        </div>
      )}

      {status?.ok && !result && (
        <div className="space-y-4">
          <div className="text-[11.5px] text-muted">
            Reading <b className="text-ink2">{releaseName}</b> from{' '}
            <code className="text-ink2 break-all">{status.resolvedPath}</code>
          </div>

          <div>
            <span className="text-xs font-medium text-ink2">Which month does this data describe?</span>
            <div className="flex gap-2 mt-1.5">
              <select className={FIELD} value={period.month} aria-label="Month"
                      onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
              <input className={`${FIELD} w-24`} type="number" min={2000} max={2999}
                     aria-label="Year" value={period.year}
                     onChange={e => setPeriod(p => ({ ...p, year: Number(e.target.value) }))} />
            </div>
            <span className="text-[11.5px] text-muted mt-1 block">
              Snapshots are grouped by month. Loading this month again with changed data adds
              another snapshot — it never overwrites this one.
            </span>
          </div>

          {withFiles.length === 0 && (
            <p className="text-[12.5px] text-muted">
              No workbook in this release’s folder matches {layerId ? 'this testing type' : 'any testing type'}.
              Name each file after its type — <code>regression.xlsx</code>, <code>feature.xlsx</code> —
              or put it in a folder named after the type.
            </p>
          )}

          {withFiles.map(layer => (
            <div key={layer.layerId} className="rounded-lg border border-grid p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{layer.layerName}</span>
                <span className={cx('text-[11px]', layer.changed ? 'text-accent' : 'text-muted')}>
                  {layer.changed ? 'changed since the last snapshot' : 'unchanged'}
                </span>
              </div>
              {layer.files.length > 1 && (
                <p className="text-[11.5px] text-ink2 bg-accent-soft rounded-md px-2 py-1.5 mt-1.5">
                  {layer.files.length} workbooks feed this testing type. Each is loaded as
                  its own dataset with its own snapshot — they are never combined.
                </p>
              )}
              <div className="mt-1.5 space-y-1">
                {layer.files.map(file => (
                  <label key={file.relativePath}
                         className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input type="checkbox" disabled={!!file.error}
                           checked={(picked[layer.layerId] ?? []).includes(file.relativePath)}
                           onChange={() => toggle(layer.layerId, file.relativePath)} />
                    <span className="truncate">{file.relativePath}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">
                      <Bytes n={file.sizeBytes} /> · {timeAgo(file.modifiedAt)}
                    </span>
                  </label>
                ))}
              </div>
              {layer.files.some(f => f.error) && (
                <p className="text-[11.5px] text-crit-text mt-1.5">
                  {layer.files.find(f => f.error)?.error}
                </p>
              )}
              {layer.lastSyncedAt && (
                <p className="text-[11px] text-muted mt-1.5">
                  Last snapshot {timeAgo(layer.lastSyncedAt)} from {layer.lastSyncedFile}
                </p>
              )}
            </div>
          ))}

          {status.unmatchedFiles.length > 0 && !layerId && (
            <p className="text-[11.5px] text-muted">
              Ignored (no matching testing type): {status.unmatchedFiles.map(f => f.relativePath).join(', ')}
            </p>
          )}

          {withFiles.length > 0 && changed.length === 0 && (
            <p className="text-[11.5px] text-muted">
              Nothing has changed since the last snapshot. Loading anyway records nothing.
            </p>
          )}

          {error && <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={run} disabled={busy || withFiles.length === 0}
                  className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
            {busy ? 'Reading…' : `Create snapshot — ${monthLabel(period)}`}
          </button>
        </div>
      )}

      {result && <LoadResults result={result} onClose={onClose} />}
    </Modal>
  )
}
