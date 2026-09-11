/* Every snapshot of a testing type, across all of its files, newest load
   first.

   This is the durable record: each row is a complete reading of one workbook
   that will not change, so the differences between consecutive readings of the
   same file are the story — what was added, what changed, what disappeared
   from the sheet. Files are shown together here but never merged: a diff only
   ever compares a file with its own previous snapshot. */
import { useState } from 'react'
import { api, type SnapshotInfo } from '../api'
import { useAuth } from '../auth/AuthContext'
import { cx, fmt } from '../lib/format'
import { layerColorVar } from '../lib/palette'
import { loadedAtLabel, monthLabel } from '../lib/period'
import { Card, EmptyState } from './ui'
import { ConfirmDialog } from './ConfirmDialog'
import { WarningBadge, WarningLine } from './QualityWarnings'
import { TrashIcon } from './icons'

/** File names alone are ambiguous once two folders hold a `Regression_Test.xlsx`,
    so the path is shown wherever the basename is not unique. */
function fileLabels(snapshots: SnapshotInfo[]): Map<string, string> {
  const paths = [...new Set(snapshots.map(s => s.file))]
  const counts = new Map<string, number>()
  for (const path of paths) {
    const base = path.split('/').pop() ?? path
    counts.set(base, (counts.get(base) ?? 0) + 1)
  }
  return new Map(paths.map(path => {
    const base = path.split('/').pop() ?? path
    return [path, (counts.get(base) ?? 0) > 1 ? path : base]
  }))
}


function DiffLine({ snapshot }: { snapshot: SnapshotInfo }) {
  const diff = snapshot.diff
  if (!diff) return null
  if (!diff.comparable) {
    return <span className="text-muted">{diff.reason ?? 'Not comparable with the previous snapshot.'}</span>
  }
  if (diff.comparedTo === null) {
    return <span className="text-muted">First snapshot — {fmt(diff.added)} records.</span>
  }
  if (!diff.added && !diff.changed && !diff.removed) {
    return <span className="text-muted">No row changes vs #{diff.comparedTo}.</span>
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      {diff.added > 0 && <span className="text-good-text">+{fmt(diff.added)} added</span>}
      {diff.changed > 0 && <span className="text-accent">{fmt(diff.changed)} changed</span>}
      {diff.removed > 0 && <span className="text-crit-text">−{fmt(diff.removed)} removed</span>}
      <span className="text-muted">vs #{diff.comparedTo}</span>
    </span>
  )
}

/** A bar per snapshot in load order, coloured by which file it came from —
    the files sit side by side rather than being added together. */
function Trend({ snapshots, labels }: {
  snapshots: SnapshotInfo[]
  labels: Map<string, string>
}) {
  const ordered = [...snapshots].reverse()
  const peak = Math.max(...ordered.map(s => s.rowCount), 1)
  const fileNames = [...new Set(ordered.map(s => s.file))]
  if (ordered.length < 2) return null
  const tone = (file: string) =>
    `var(${layerColorVar(fileNames.indexOf(file))})`
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-semibold tracking-tight">Records over time</h3>
        {fileNames.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted">
            {fileNames.map(file => (
              <span key={file} className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-sm" style={{ background: tone(file) }} />
                {labels.get(file) ?? file}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2 mt-4">
        {ordered.map(s => (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-[10.5px] text-muted tabular-nums">{fmt(s.rowCount)}</span>
            <div className="w-full h-24 flex items-end">
              <div
                className="w-full rounded-t transition-[height]"
                style={{ height: `${Math.max(3, (s.rowCount / peak) * 100)}%`,
                         background: tone(s.file),
                         opacity: s.isCurrent ? 1 : 0.45 }}
                title={`${labels.get(s.file) ?? s.file} · #${s.sequence} · `
                       + `${monthLabel(s.period)} · ${fmt(s.rowCount)} records`}
              />
            </div>
            <span className="text-[10px] text-muted truncate w-full text-center">
              #{s.sequence} · {monthLabel(s.period)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function SnapshotHistory({ appId, releaseId, snapshots, loading,
                                  activeId, activeFile, onOpen, onChanged }: {
  appId: string
  releaseId: string
  snapshots: SnapshotInfo[] | null
  loading: boolean
  /** the snapshot currently being viewed, if not the latest */
  activeId: string | null
  /** the file the other views are reading — every file has a current
      snapshot, so this is what says which one is on screen */
  activeFile: string | null
  onOpen: (snapshotId: string | null) => void
  onChanged: () => void
}) {
  const { hasRole } = useAuth()
  const [deleting, setDeleting] = useState<SnapshotInfo | null>(null)
  const fileCount = new Set((snapshots ?? []).map(s => s.file)).size
  const labels = fileLabels(snapshots ?? [])

  if (loading) return <div className="text-[13px] text-muted">Loading history…</div>
  if (!snapshots || snapshots.length === 0) {
    return (
      <EmptyState
        title="Nothing loaded yet"
        hint="Each load records a snapshot here, with what changed since the one before it."
      />
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-muted">
        Every load of this testing type, newest first
        {fileCount > 1 && <> across <b className="text-ink2">{fileCount} files</b></>}.
        Each snapshot is one workbook, and a diff compares a file only with its
        own previous load. Select a row to open it.
      </p>
      <Trend snapshots={snapshots} labels={labels} />

      <div className="space-y-2.5">
        {snapshots.map(snapshot => {
          // without an explicit snapshot, only the current one of the file
          // being read counts as on screen — every file has a current
          const viewing = activeId
            ? snapshot.id === activeId
            : snapshot.isCurrent && snapshot.file === activeFile
          return (
            <Card
              key={snapshot.id}
              role="button"
              tabIndex={0}
              ariaCurrent={viewing}
              ariaLabel={`Open snapshot ${snapshot.sequence} of `
                         + `${labels.get(snapshot.file) ?? snapshot.file}, `
                         + `${monthLabel(snapshot.period)}`}
              onClick={() => onOpen(snapshot.isCurrent ? null : snapshot.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(snapshot.isCurrent ? null : snapshot.id)
                }
              }}
              className={cx(
                'p-4 flex flex-wrap items-start gap-x-5 gap-y-3 cursor-pointer transition-colors',
                viewing ? 'border-accent bg-accent-soft/30' : 'hover:border-accent',
              )}>
              <div className="flex flex-col gap-0.5 min-w-[112px]">
                <span className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold tracking-tight">
                    {monthLabel(snapshot.period)}
                  </span>
                  {snapshot.isCurrent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-good-text bg-good-text/10 rounded px-1.5 py-0.5"
                          title="the current snapshot of this file">
                      current
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted truncate">
                  {labels.get(snapshot.file) ?? snapshot.file} · #{snapshot.sequence}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 flex-1 min-w-[200px] text-[12.5px]">
                <span className="font-semibold tabular-nums">
                  {fmt(snapshot.rowCount)} records
                  <span className="font-normal text-muted">
                    {' '}· {snapshot.columns.length} columns
                    {snapshot.duplicatesSkipped > 0 &&
                      ` · ${fmt(snapshot.duplicatesSkipped)} duplicates skipped`}
                  </span>
                </span>
                <DiffLine snapshot={snapshot} />
                {/* a problem is still true later, so it keeps its block; a
                    notice shrinks to a count once the load is history */}
                {snapshot.warnings?.filter(w => w.severity === 'problem')
                  .map(w => <WarningLine key={w.code} warning={w} />)}
                {snapshot.warnings?.some(w => w.severity === 'notice') && (
                  <WarningBadge
                    warnings={snapshot.warnings.filter(w => w.severity === 'notice')} />
                )}
                <span className="text-[11px] text-muted truncate">
                  {loadedAtLabel(snapshot.createdAt)}
                  {snapshot.createdBy && ` · by ${snapshot.createdBy}`}
                  {snapshot.combined && ' · combined load, kept as history'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {hasRole('admin') && (
                  <button
                    onClick={event => { event.stopPropagation(); setDeleting(snapshot) }}
                    aria-label={`Delete snapshot ${snapshot.sequence} of `
                                + `${labels.get(snapshot.file) ?? snapshot.file}`}
                    className="p-1.5 rounded-md text-muted hover:text-crit-text hover:bg-critical/10 transition-colors"
                  >
                    <TrashIcon size={13} />
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete this snapshot?"
          confirmLabel={`Delete snapshot #${deleting.sequence}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteSnapshot(appId, releaseId, deleting.id)
            if (activeId === deleting.id) onOpen(null)
            onChanged()
          }}
        >
          Snapshot <b>#{deleting.sequence}</b> of{' '}
          <b>{labels.get(deleting.file) ?? deleting.file}</b>{' '}
          ({monthLabel(deleting.period)}) and its{' '}
          <b>{fmt(deleting.rowCount)}</b> records will be permanently removed.
          {' '}Every other snapshot — including the other files of this testing
          type — keeps its data, and the corrected workbook can be loaded as a new
          snapshot afterwards.
        </ConfirmDialog>
      )}
    </div>
  )
}
