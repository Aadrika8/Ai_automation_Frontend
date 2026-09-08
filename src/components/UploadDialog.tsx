/* UPLOAD DISABLED
   The app reads each release's folder on disk; nothing is uploaded from a
   browser. This dialog is kept intact so the flow can be restored by
   uncommenting it together with api.uploadLayerExcel and its call sites.

import { useState } from 'react'
import { api, type UploadResult } from '../api'
import { cx, fmt } from '../lib/format'
import { FileDrop } from './FileDrop'
import { Modal } from './Modal'
import { CheckIcon } from './icons'

type UploadMode = 'merge' | 'replace'

const MODES: Array<{ value: UploadMode; label: string; desc: string }> = [
  {
    value: 'merge',
    label: 'Merge with existing data',
    desc: 'Matching rows are updated, new rows added; rows missing from the file are kept.',
  },
  {
    value: 'replace',
    label: 'Replace all data',
    desc: 'This release\u2019s rows for the layer are wiped first — the file becomes its entire dataset.',
  },
]

/** Excel upload flow for one layer of one release: pick mode + file → ingest
    → result summary. The file only ever lands in the given release. *\/
export function UploadDialog({
  appId, releaseId, releaseName, layerId, layerName, hasData, onClose, onUploaded,
}: {
  appId: string
  releaseId: string
  releaseName: string
  layerId: string
  layerName: string
  /** whether the layer already holds records — the merge/replace choice only matters then *\/
  hasData: boolean
  onClose: () => void
  onUploaded: () => void
}) {
  const [mode, setMode] = useState<UploadMode>('merge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.uploadLayerExcel(appId, releaseId, layerId, file,
                                          hasData ? mode : 'merge'))
      onUploaded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Upload Excel — ${layerName} · ${releaseName}`} onClose={onClose}>
      {result ? (
        <div className="anim-rise">
          <div className="flex items-center gap-2 text-good-text font-semibold text-[13.5px]">
            <CheckIcon size={14} /> {result.fileName} ingested
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[12.5px]">
            {[
              ['Rows read', result.totalRows],
              ['New records', result.inserted],
              ['Updated', result.updated],
              ['Unchanged', result.unchanged],
              ['Duplicates skipped', result.duplicatesSkipped],
              ['Sections', result.sections.length],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-grid pb-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold tabular-nums">{fmt(value as number)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 transition"
            >
              Done
            </button>
            <button
              onClick={() => { setResult(null); setError(null) }}
              className="px-4 rounded-lg border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors"
            >
              Upload another
            </button>
          </div>
        </div>
      ) : (
        <>
          {hasData && (
            <div className="space-y-1.5 mb-4">
              <span className="text-xs font-medium text-ink2">This layer already has data — how should the new file be applied?</span>
              {MODES.map(m => (
                <label key={m.value}
                       className={cx('flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                                     mode === m.value ? 'border-accent bg-accent-soft/50' : 'border-grid hover:border-accent')}>
                  <input type="radio" name="upload-mode" checked={mode === m.value}
                         onChange={() => setMode(m.value)} className="mt-0.5 accent-(--accent)" />
                  <span>
                    <span className="block text-[13px] font-semibold">{m.label}</span>
                    <span className="block text-[11.5px] text-muted">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <FileDrop onFile={upload} busy={busy} />
          {error && (
            <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2 mt-3">{error}</div>
          )}
          <p className="text-[11.5px] text-muted mt-3">
            Loaded into <b className="text-ink2">{releaseName}</b> only. Duplicate rows inside
            the file are skipped automatically.
          </p>
        </>
      )}
    </Modal>
  )
}

*/
export {}
