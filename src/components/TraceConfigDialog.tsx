/* How Feature and System rows are matched, for one release.

   The identifier is not chosen here any more. It comes from the first column
   of each workbook — per file, because the sheets do not agree on much: one
   release's has a header row naming its columns, the next has none at all and
   its columns are only "Column 1", "Column 2". A rule survives that; a saved
   column name does not.

   So this dialog's first job is to *show* what the rule read: the column each
   file was read from, the family the ids turned out to share, and real values
   pulled out of the data. Its second job is the escape hatch — naming a column
   for a workbook that defeats the rule. Overriding it blind is how a coverage
   report ends up quietly measuring the wrong thing, so the preview moves with
   the choice and nothing is saved until you say so. */
import { useEffect, useState } from 'react'
import { api, type TraceConfig, type TracePreview, type TraceSideRead } from '../api'
import { cx } from '../lib/format'
import { Modal } from './Modal'
import { AlertTriangleIcon, SpinnerIcon } from './icons'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">
        {label}
      </span>
      <span className={cx('text-[13px] font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  )
}

/** What one layer's read produced. The numbers matter more than the settings:
    a column nobody can read identifiers out of is the whole failure mode. */
function SideRead({ read, busy }: { read: TraceSideRead | null; busy: boolean }) {
  if (!read) {
    return (
      <p className="text-[12px] text-muted">
        {busy ? 'Reading…' : 'No data loaded for this layer.'}
      </p>
    )
  }
  const none = read.distinctIds === 0
  return (
    <div className={cx('space-y-3', busy && 'opacity-50 transition-opacity')}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Ids found" value={String(read.distinctIds)}
              tone={none ? 'text-crit-text' : undefined} />
        <Stat label="Rows read" value={`${read.matchedRows}/${read.totalRows}`} />
        <Stat label="Family" value={read.family || '—'} />
      </div>

      <div className="text-[11.5px] text-ink2 space-y-1">
        {read.files.map(f => (
          <div key={f.fileName} className="truncate">
            <span className="text-muted">{f.fileName}</span> →{' '}
            <span className="font-semibold">{f.columnLabel}</span>
          </div>
        ))}
      </div>

      {none ? (
        <p className="flex items-start gap-1.5 text-[11.5px] text-crit-text">
          <span className="mt-px shrink-0"><AlertTriangleIcon /></span>
          Nothing readable came out of this column. Coverage cannot be computed
          from it.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {read.extracted.slice(0, 8).map(id => (
            <span key={id}
                  className="rounded-md border border-grid bg-page px-1.5 py-0.5 text-[11px] font-mono text-ink2">
              {id}
            </span>
          ))}
        </div>
      )}

      {read.unresolvedRows > 0 && (
        <p className="text-[11.5px] text-muted">
          {read.unresolvedRows} row{read.unresolvedRows === 1 ? '' : 's'} yielded no
          identifier — those are absent from both directions.
        </p>
      )}
      {read.numericRatio >= 0.9 && read.distinctIds > 0 && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-ink2">
          <span className="text-warning mt-px shrink-0"><AlertTriangleIcon /></span>
          These ids are plain numbers — the sign of a serial-number column.
          Pick the column that holds the real identifier.
        </p>
      )}
    </div>
  )
}

function SidePanel({
  appId, releaseId, layer, title, columnOptions, column, onColumn, pattern,
}: {
  appId: string
  releaseId: string
  layer: string
  title: string
  columnOptions: Array<{ key: string; label: string }>
  column: string
  onColumn: (column: string) => void
  pattern: string
}) {
  const [preview, setPreview] = useState<TracePreview | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let live = true
    setBusy(true)
    const timer = setTimeout(() => {
      api.getTracePreview(appId, releaseId, { layer, column, pattern })
        .then(p => { if (live) { setPreview(p); setBusy(false) } })
        .catch(() => { if (live) setBusy(false) })
    }, 250)
    return () => { live = false; clearTimeout(timer) }
  }, [appId, releaseId, layer, column, pattern])

  return (
    <section className="border border-grid rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <SideRead read={preview?.read ?? null} busy={busy} />
      <label className="block pt-1">
        <span className="text-[11.5px] text-ink2">Identifier column</span>
        <select
          value={column}
          onChange={e => onColumn(e.target.value)}
          className={cx(FIELD, 'mt-1 text-[12px]')}
        >
          <option value="">First column of each file (default)</option>
          {columnOptions.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <span className="block text-[11px] text-muted mt-1">
          The first column is only the default — pick the column that actually
          holds the identifier when a sheet opens with a serial number. A choice
          is ignored by any file that does not have that column, which falls
          back to its first.
        </span>
      </label>
    </section>
  )
}

export function TraceConfigDialog({ appId, releaseId, config, onClose, onSaved }: {
  appId: string
  releaseId: string
  config: TraceConfig
  onClose: () => void
  onSaved: () => void
}) {
  const feature = config.featureLayer
  const system = config.systemLayer

  const [columns, setColumns] = useState<Record<string, string>>({
    [feature]: config.layers[feature]?.column ?? '',
    [system]: config.layers[system]?.column ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Every column the layer's workbooks carry. Listing only the columns already
     being read would make the control useless — the whole reason to open it is
     that the default picked the wrong one, which is exactly what happens to a
     sheet whose first column is a serial number. */
  const optionsFor = (layer: string) => {
    const read = config.read[layer]
    const seen = new Map<string, string>()
    for (const c of read?.columns ?? []) seen.set(c.key, c.label || c.key)
    for (const f of read?.files ?? []) if (!seen.has(f.column)) seen.set(f.column, f.columnLabel)
    const chosen = columns[layer]
    if (chosen && !seen.has(chosen)) seen.set(chosen, chosen)
    return [...seen].map(([key, label]) => ({ key, label }))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.saveTraceConfig(appId, releaseId, {
        // carried through untouched: the pattern is the built-in rule, not a
        // setting, so saving a column override must not silently drop it
        pattern: config.pattern,
        layers: {
          [feature]: { column: columns[feature] },
          [system]: { column: columns[system] },
        },
      })
      onSaved()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const panels: Array<[string, string]> = [
    [feature, 'Feature testing'], [system, 'System testing'],
  ]

  return (
    <Modal title="Matching Feature to System" onClose={onClose} size="lg">
      <p className="text-[12.5px] text-ink2 -mt-2 mb-4">
        The two sheets are matched on one identifier, read from the first column
        of each workbook. Ids of any other family a feature row mentions are
        shown beside the gap as supporting detail and are never matched on.
        Everything below is an override — leave it alone unless a workbook
        defeats the rule.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {panels.map(([layer, title]) => (
          <SidePanel
            key={layer}
            appId={appId}
            releaseId={releaseId}
            layer={layer}
            title={title}
            columnOptions={optionsFor(layer)}
            column={columns[layer] ?? ''}
            onColumn={v => setColumns(c => ({ ...c, [layer]: v }))}
            pattern={config.pattern}
          />
        ))}
      </div>

      {error && <p className="text-[12px] text-crit-text mt-3">{error}</p>}

      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-3.5 py-2 rounded-lg border border-grid text-[12.5px] hover:border-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="px-3.5 py-2 rounded-lg bg-accent text-white text-[12.5px] font-semibold disabled:opacity-40 flex items-center gap-2"
        >
          {busy && <SpinnerIcon />}
          Save
        </button>
      </div>
    </Modal>
  )
}
