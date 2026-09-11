/* Load a release's Excel folder into snapshots.

   Nothing is chosen from the local machine: the workbooks come from the path
   an admin configured. There is no merge-or-replace choice either — a load
   records a complete, read-only snapshot per *workbook*, so an earlier one is
   never rewritten and two files are never merged. The dialog asks the one
   thing the backend will not guess: which month the data describes. Ticking
   files still chooses what to read; each ticked file becomes its own
   snapshot. */
import { useEffect, useState } from 'react'
import { api, type SnapshotPeriod, type SnapshotRunResult, type SourceStatus } from '../api'
import { Modal } from './Modal'
import { QualityWarnings } from './QualityWarnings'
import { cx, fmt, timeAgo } from '../lib/format'
import { monthLabel, thisMonth } from '../lib/period'

function Bytes({ n }: { n: number }) {
  return <>{n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`}</>
}

const FIELD = 'bg-surface border border-grid rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-accent transition-colors'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

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

      {result && (
        <div className="space-y-3">
          <p className="text-[11.5px] text-muted">{monthLabel(result.period)}</p>
          {/* about the release rather than one workbook — two files holding
              the same rows, for one */}
          <QualityWarnings warnings={result.warnings} />
          {result.files.map(l => (
            <div key={`${l.layerId}:${l.file}`} className="rounded-lg border border-grid p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold truncate">
                  {l.fileName || l.layerName}
                </span>
                {l.created && (
                  <span className="text-[11px] text-muted shrink-0">snapshot #{l.sequence}</span>
                )}
              </div>
              <p className="text-[11px] text-muted">{l.layerName}</p>
              {l.error ? (
                <p className="text-[12px] text-crit-text mt-1">{l.error}</p>
              ) : !l.created ? (
                <p className="text-[12px] text-muted mt-1">
                  {l.renamedFrom && (
                    <b className="text-ink2 font-semibold">Renamed. </b>
                  )}
                  {l.reason}
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-ink2 mt-1">
                    {fmt(l.rowCount)} records
                    {l.duplicatesSkipped > 0 && ` · ${l.duplicatesSkipped} duplicates skipped`}
                  </p>
                  {l.diff && (
                    <p className="text-[12px] text-muted mt-0.5">
                      {l.diff.comparable
                        ? l.diff.comparedTo === null
                          ? 'First snapshot of this testing type.'
                          : `${l.diff.added} added · ${l.diff.changed} changed · ${l.diff.removed} removed vs #${l.diff.comparedTo}`
                        : l.diff.reason}
                    </p>
                  )}
                </>
              )}
              {l.file && l.file !== l.fileName && (
                <p className="text-[11px] text-muted mt-1">{l.file}</p>
              )}
              {/* reported whether or not a snapshot was written — an unchanged
                  workbook still has whatever is wrong with it */}
              <QualityWarnings warnings={l.warnings} className="mt-2" />
            </div>
          ))}
          <button onClick={onClose}
                  className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 transition">
            Done
          </button>
        </div>
      )}
    </Modal>
  )
}
