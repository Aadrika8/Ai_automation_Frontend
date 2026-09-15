/* Which workbook you are looking at.

   A testing type can be fed by several Excel files, and they are never merged
   — each is its own dataset with its own records, columns, metrics and
   history. This picks between them. It stays out of the way when a testing
   type has only one file, which is the usual case. */
import { useEffect, useRef, useState } from 'react'
import type { LayerFileInfo } from '../api'
import { cx, fmt } from '../lib/format'
import { loadedAtLabel, monthLabel } from '../lib/period'
import { ChevronDownIcon, CheckIcon } from './icons'

/** The merged entry's value — every file's current snapshot, added up. */
export const MERGED = '__merged__'

export function FileSelector({ files, activeFile, merged, allowMerged, onSelect }: {
  files: LayerFileInfo[] | null
  /** the file being viewed, as the server resolved it */
  activeFile: string | null
  /** whether the merged view is the one showing */
  merged?: boolean
  /** the merged total is a dashboard figure; other views read one file */
  allowMerged?: boolean
  onSelect: (file: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // one file needs no choosing — name it and leave it at that
  if (!files || files.length === 0) return null
  const active = files.find(f => f.file === activeFile) ?? files[0]
  const showMerged = allowMerged && files.length > 1
  const totalRows = files.reduce((sum, f) => sum + f.rowCount, 0)
  if (files.length === 1) {
    return (
      <span className="text-[12px] text-muted">
        <span className="text-ink2 font-medium">{active.fileName}</span>
        {' · '}{monthLabel(active.period)} · {loadedAtLabel(active.loadedAt)}
      </span>
    )
  }

  return (
    <div className="relative" ref={root}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose which Excel file to view"
        className={cx(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors',
          open ? 'border-accent text-accent'
               : 'border-grid text-ink2 hover:border-accent hover:text-accent',
        )}
      >
        <span className="text-[11px] font-medium text-muted uppercase tracking-wide">File</span>
        {merged ? `All ${files.length} files` : active.fileName}
        <span className="text-[11px] font-normal text-muted">
          {fmt(merged ? totalRows : active.rowCount)} records
        </span>
        <ChevronDownIcon size={13} className={cx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="listbox" aria-label="Excel files"
             className="absolute right-0 z-30 mt-1.5 w-[340px] rounded-xl border border-grid bg-surface shadow-lift p-1.5 anim-rise">
          <p className="text-[11px] text-muted px-2.5 py-1.5">
            Each file is stored as its own dataset. Merging only adds the
            current figures up for the dashboard.
          </p>
          {showMerged && (
            <button
              role="option"
              data-merged="true"
              aria-selected={!!merged}
              onClick={() => { onSelect(MERGED); setOpen(false) }}
              className={cx(
                'w-full text-left rounded-lg px-2.5 py-2 mb-1 transition-colors border border-dashed',
                merged ? 'bg-accent-soft border-accent' : 'border-grid hover:bg-accent-soft/50',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cx('text-[13px] font-semibold', merged && 'text-accent')}>
                  All {files.length} files — merged
                </span>
                {merged && <CheckIcon size={10} className="shrink-0 text-accent" />}
              </span>
              <span className="block text-[11px] text-muted">
                {fmt(totalRows)} records totalled · dashboard metrics only
              </span>
            </button>
          )}
          <div className="max-h-72 overflow-y-auto">
            {files.map(file => {
              const selected = !merged && file.file === active.file
              return (
                <button
                  key={file.file}
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onSelect(file.file); setOpen(false) }}
                  className={cx(
                    'w-full text-left rounded-lg px-2.5 py-2 transition-colors',
                    selected ? 'bg-accent-soft' : 'hover:bg-accent-soft/50',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cx('text-[13px] font-semibold truncate',
                                        selected && 'text-accent')}>
                      {file.fileName}
                    </span>
                    {selected && <CheckIcon size={10} className="shrink-0 text-accent" />}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {fmt(file.rowCount)} records · {file.columnCount} columns
                    {file.snapshotCount > 1 && ` · ${file.snapshotCount} snapshots`}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {monthLabel(file.period)} · loaded {loadedAtLabel(file.loadedAt)}
                  </span>
                  {file.file !== file.fileName && (
                    <span className="block text-[10.5px] text-muted truncate">{file.file}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
