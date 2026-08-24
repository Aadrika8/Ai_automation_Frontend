/* Reload layer data from the configured Excel folder.
   Replaces the old upload dialog: nothing is chosen from the local machine,
   the workbooks come from the path an admin configured. The dialog exists to
   ask the two questions the backend refuses to guess — merge or replace, and
   which workbooks to use when several map to the same layer. */
import { useEffect, useState } from 'react'
import { api, type SourceStatus, type SyncResult } from '../api'
import { Modal } from './Modal'
import { timeAgo } from '../lib/format'

type Mode = 'merge' | 'replace'

function Bytes({ n }: { n: number }) {
  return <>{n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`}</>
}

export function SyncDialog({ appId, layerId, onClose, onSynced }: {
  appId: string
  /** limit the sync to one layer; omitted syncs every matched layer */
  layerId?: string
  onClose: () => void
  onSynced: () => void
}) {
  const [status, setStatus] = useState<SourceStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('merge')
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSource(appId)
      .then(s => {
        setStatus(s)
        // default selection: every workbook matched to each layer
        setPicked(Object.fromEntries(s.layers.map(l => [l.layerId, l.files.map(f => f.relativePath)])))
      })
      .catch(e => setLoadError((e as Error).message))
  }, [appId])

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
      const res = await api.syncFromSource(appId, { mode, layers: chosen })
      setResult(res)
      onSynced()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={layerId ? 'Reload this layer from Excel' : 'Reload data from Excel'} onClose={onClose}>
      {loadError && <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{loadError}</p>}

      {status && !status.ok && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{status.error}</p>
          <p className="text-[11.5px] text-muted">
            An admin can correct the root folder in Settings, or this application’s folder on its layers page.
          </p>
        </div>
      )}

      {status?.ok && !result && (
        <div className="space-y-4">
          <div className="text-[11.5px] text-muted">
            Reading from <code className="text-ink2 break-all">{status.resolvedPath}</code>
          </div>

          {withFiles.length === 0 && (
            <p className="text-[12.5px] text-muted">
              No workbook in this folder matches {layerId ? 'this layer' : 'any layer'}. Name each file
              after its layer — <code>regression.xlsx</code>, <code>feature.xlsx</code> — or put it in a
              folder named after the layer.
            </p>
          )}

          {withFiles.map(layer => (
            <div key={layer.layerId} className="rounded-lg border border-grid p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{layer.layerName}</span>
                <span className="text-[11px] text-muted">
                  {layer.changed ? 'changed since last sync' : 'unchanged'}
                </span>
              </div>
              {layer.conflict && (
                <p className="text-[11.5px] text-ink2 bg-accent-soft rounded-md px-2 py-1.5 mt-1.5">
                  {layer.files.length} workbooks match this layer. Tick the ones to load — several
                  ticked are merged into this single layer.
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
                  Last loaded {timeAgo(layer.lastSyncedAt)} from {layer.lastSyncedFile}
                </p>
              )}
            </div>
          ))}

          {status.unmatchedFiles.length > 0 && !layerId && (
            <p className="text-[11.5px] text-muted">
              Ignored (no matching layer): {status.unmatchedFiles.map(f => f.relativePath).join(', ')}
            </p>
          )}

          {withFiles.length > 0 && (
            <div>
              <span className="text-xs font-medium text-ink2">
                {changed.length > 0
                  ? `${changed.length} workbook${changed.length > 1 ? 's have' : ' has'} changed. How should the changes be applied?`
                  : 'How should the data be applied?'}
              </span>
              <div className="mt-1.5 space-y-1.5">
                {([
                  { value: 'merge' as Mode, label: 'Merge',
                    desc: 'Update rows that changed, add new ones, keep rows no longer in the file.' },
                  { value: 'replace' as Mode, label: 'Replace',
                    desc: 'Wipe the layer first, so the workbook becomes the whole dataset.' },
                ]).map(opt => (
                  <label key={opt.value}
                         className={`flex gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors
                                     ${mode === opt.value ? 'border-accent bg-accent-soft' : 'border-grid'}`}>
                    <input type="radio" className="mt-0.5" checked={mode === opt.value}
                           onChange={() => setMode(opt.value)} />
                    <span>
                      <span className="text-[13px] font-semibold block">{opt.label}</span>
                      <span className="text-[11.5px] text-muted">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={run} disabled={busy || withFiles.length === 0}
                  className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
            {busy ? 'Reading…' : mode === 'replace' ? 'Replace with Excel data' : 'Merge Excel data'}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.layers.map(l => (
            <div key={l.layerId} className="rounded-lg border border-grid p-2.5">
              <div className="text-[13px] font-semibold">{l.layerName}</div>
              {l.error
                ? <p className="text-[12px] text-crit-text mt-1">{l.error}</p>
                : (
                  <p className="text-[12px] text-muted mt-1">
                    {l.inserted} added · {l.updated} updated · {l.unchanged} unchanged
                    {l.duplicatesSkipped > 0 && ` · ${l.duplicatesSkipped} duplicates skipped`}
                  </p>
                )}
              <p className="text-[11px] text-muted mt-1">{l.files.join(', ')}</p>
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
