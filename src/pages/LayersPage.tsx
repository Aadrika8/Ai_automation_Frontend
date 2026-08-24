import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type LayerInfo, type SourceStatus } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { cx, fmt, timeAgo } from '../lib/format'
import { layerAccentVar } from '../lib/palette'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SyncDialog } from '../components/SyncDialog'
import { UploadDialog } from '../components/UploadDialog'
import {
  AlertTriangleIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, FolderIcon, PlusIcon,
  RefreshIcon, TrashIcon, UploadIcon,
} from '../components/icons'

/* ---------- Testing Pyramid rule ----------
   Every layer must have strictly fewer test cases than the layer directly
   below it (Unit > Integration > System > UI/E2E). Layers are compared by
   their `order` (bottom-first). A layer with 0 records means no data has
   been uploaded yet, so any comparison touching it is skipped rather than
   flagged — the rule only applies once both sides have real data. */
type PyramidRelation = {
  lower: LayerInfo
  upper: LayerInfo
  /** true once both layers have data but the pyramid rule is broken */
  violated: boolean
  /** true when one side has no data yet, so the rule can't be checked */
  pending: boolean
  message: string
}

function buildPyramidRelations(layers: LayerInfo[]): PyramidRelation[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  const relations: PyramidRelation[] = []
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1]
    const upper = sorted[i]
    const pending = lower.recordCount === 0 || upper.recordCount === 0
    const violated = !pending && upper.recordCount >= lower.recordCount
    relations.push({
      lower,
      upper,
      violated,
      pending,
      message: `${upper.name} (${fmt(upper.recordCount)}) should have fewer test cases than ${lower.name} (${fmt(lower.recordCount)}).`,
    })
  }
  return relations
}

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

/* Where a new layer sits in the pyramid. Rendered tip-first so the list reads
   like the pyramid itself — narrow top (fewest tests) down to the wide base —
   with a clickable slot between every pair of existing layers. The chosen slot
   becomes the new layer's `order`, and the backend shifts everything above it
   up by one. */
function PyramidPositionPicker({ layers, value, onChange, newName }: {
  /** existing layers, already sorted bottom-first */
  layers: LayerInfo[]
  value: number
  onChange: (position: number) => void
  newName: string
}) {
  const rows: ReactNode[] = []

  for (let slot = layers.length; slot >= 0; slot--) {
    const selected = value === slot
    const edge = slot === layers.length ? 'tip · fewest tests'
      : slot === 0 ? 'base · most tests'
        : ''
    rows.push(
      <button
        key={`slot-${slot}`}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`Insert ${slot === 0 ? 'at the base of the pyramid' : slot === layers.length
          ? 'at the tip of the pyramid' : `above ${layers[slot - 1].name}`}`}
        onClick={() => onChange(slot)}
        className={cx(
          'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] border border-dashed transition-colors',
          selected
            ? 'border-accent bg-accent-soft text-accent font-semibold'
            : 'border-transparent text-muted hover:border-grid hover:text-ink2',
        )}
      >
        <PlusIcon size={10} className="shrink-0" />
        <span className="truncate">{selected ? (newName.trim() || 'New layer') : 'Insert here'}</span>
        {edge && <span className="ml-auto shrink-0 text-[10.5px] font-normal text-muted">{edge}</span>}
      </button>,
    )

    if (slot > 0) {
      const layer = layers[slot - 1]
      rows.push(
        <div key={layer.id} className="flex items-center gap-2 px-2 py-1.5">
          <i className="w-1.5 h-4 rounded-full shrink-0"
             style={{ background: `var(${layerAccentVar(slot - 1, layers.length)})` }} />
          <span className="text-[12px] font-medium truncate">{layer.name}</span>
          <span className="ml-auto shrink-0 text-[11px] text-muted">{fmt(layer.recordCount)} records</span>
        </div>,
      )
    }
  }

  return (
    <div role="radiogroup" aria-label="Position in the testing pyramid"
         className="rounded-lg border border-grid p-1.5 max-h-60 overflow-y-auto">
      {rows}
    </div>
  )
}

function AddLayerModal({ appId, layers, onClose, onCreated }: {
  appId: string
  /** existing layers, sorted bottom-first */
  layers: LayerInfo[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [desc, setDesc] = useState('')
  // default to the tip: a brand-new layer has no data, so the safest guess is
  // the position that used to be automatic (appended on top)
  const [position, setPosition] = useState(layers.length)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createLayer(appId, {
        name: name.trim(), short: short.trim(), desc: desc.trim(), order: position,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const below = position > 0 ? layers[position - 1] : null
  const above = position < layers.length ? layers[position] : null

  return (
    <Modal title="Add testing layer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[11.5px] text-muted">
          Added to this application only — other applications keep their own layers.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Name</span>
          <input className={`${FIELD} mt-1`} value={name} onChange={e => setName(e.target.value)}
                 placeholder="e.g. Smoke testing" autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Short label (optional)</span>
          <input className={`${FIELD} mt-1`} value={short} onChange={e => setShort(e.target.value)}
                 placeholder="e.g. Smoke" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Description (optional)</span>
          <input className={`${FIELD} mt-1`} value={desc} onChange={e => setDesc(e.target.value)} />
        </label>

        {/* a brand-new application has nothing to position against yet */}
        {layers.length > 0 && (
          <div>
            <span className="text-xs font-medium text-ink2">Position in the testing pyramid</span>
            <p className="text-[11.5px] text-muted mt-0.5 mb-1.5">
              Pick where this layer belongs — every layer must hold fewer test cases than the one below it.
            </p>
            <PyramidPositionPicker layers={layers} value={position} onChange={setPosition} newName={name} />
            <p className="text-[11.5px] text-muted mt-1.5">
              Expected to have{' '}
              {below && <>fewer test cases than <b className="text-ink2">{below.name}</b></>}
              {below && above && ' and '}
              {above && <>more test cases than <b className="text-ink2">{above.name}</b></>}
              .
            </p>
          </div>
        )}

        {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()}
                className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Creating…' : 'Create layer'}
        </button>
      </form>
    </Modal>
  )
}

/* Where this application's data comes from. Shows the resolved folder and
   what was discovered in it; admins can correct the relative path inline. */
function ExcelSourceCard({ appId, source, canEdit, excelPath, onSaved }: {
  appId: string
  source: SourceStatus | null
  canEdit: boolean
  excelPath: string
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(excelPath)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.updateApp(appId, { excelPath: value.trim() })
      setEditing(false)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!source) return null
  const matched = source.layers.filter(l => l.files.length > 0)

  return (
    <Card className="mt-6 p-4">
      <div className="flex items-start gap-2.5">
        <FolderIcon size={15} className={cx('mt-0.5 shrink-0', source.ok ? 'text-muted' : 'text-crit-text')} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold">Excel source</div>
          {!editing && (
            <p className="text-[11.5px] text-muted mt-0.5 break-all">
              {source.ok
                ? source.resolvedPath
                : source.error ?? 'The Excel folder is not configured.'}
            </p>
          )}
          {editing && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input autoFocus value={value} onChange={e => setValue(e.target.value)}
                     placeholder="folder name under the Excel root, e.g. cellsens"
                     className="flex-1 min-w-[200px] bg-surface border border-grid rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none focus:border-accent transition-colors" />
              <button onClick={save} disabled={busy}
                      className="text-[12.5px] font-semibold bg-accent text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setValue(excelPath) }}
                      className="text-[12.5px] text-muted px-2 py-1.5">Cancel</button>
            </div>
          )}
          {error && <p className="text-[11.5px] text-crit-text mt-1">{error}</p>}
          {source.ok && !editing && (
            <p className="text-[11.5px] text-muted mt-1">
              {matched.length} of {source.layers.length} layers matched to a workbook
              {source.changedCount > 0 && ` · ${source.changedCount} changed since the last refresh`}
              {source.unmatchedFiles.length > 0 &&
                ` · ignored: ${source.unmatchedFiles.map(f => f.relativePath).join(', ')}`}
            </p>
          )}
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setValue(excelPath); setEditing(true) }}
                  className="shrink-0 text-[12px] font-semibold text-muted hover:text-accent transition-colors">
            Change
          </button>
        )}
      </div>
    </Card>
  )
}

export function LayersPage() {
  const { appId = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: apps } = useData(() => api.getApplications(), [reloadKey])
  const { data: layers, loading, error } = useData(() => api.getLayers(appId), [appId, reloadKey])
  const [syncFor, setSyncFor] = useState<LayerInfo | null>(null)
  const [syncAll, setSyncAll] = useState(false)
  const [uploadFor, setUploadFor] = useState<LayerInfo | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<LayerInfo | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const app = apps?.find(a => a.id === appId)
  const appName = app?.name ?? appId
  const { data: source } = useData(() => api.getSource(appId), [appId, reloadKey])
  const reload = () => setReloadKey(k => k + 1)

  // bottom-first (Unit → Integration → System → UI/E2E), same order the
  // pyramid rule is defined in, so cards and the connector line up
  const sortedLayers = useMemo(() => (layers ? [...layers].sort((a, b) => a.order - b.order) : []), [layers])
  const relations = useMemo(() => buildPyramidRelations(sortedLayers), [sortedLayers])
  const relationByUpperId = useMemo(() => new Map(relations.map(r => [r.upper.id, r])), [relations])
  const violations = useMemo(() => relations.filter(r => r.violated), [relations])

  function jumpToLayer(id: string) {
    setSummaryOpen(true)
    cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashId(id)
    window.setTimeout(() => setFlashId(f => (f === id ? null : f)), 1500)
  }

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[{ label: 'Applications', to: '/apps' }, { label: appName }]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle lede="Pick a testing layer to browse its ingested data and dashboard, or refresh it from the configured Excel folder.">
          {appName} — Testing Layers
        </PageTitle>
        <div className="flex items-center gap-2.5">
          {hasRole('qa') && (
            <button onClick={() => setSyncAll(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
              <RefreshIcon size={13} /> Refresh from Excel
            </button>
          )}
          {hasRole('admin') && (
            <button onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3.5 py-2 border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
              <PlusIcon size={13} /> Add layer
            </button>
          )}
        </div>
      </div>

      {error && <EmptyState title="Could not load layers" hint={error} />}

      <ExcelSourceCard appId={appId} source={source ?? null} canEdit={hasRole('admin')}
                       excelPath={app?.excelPath ?? ''} onSaved={reload} />

      {!loading && sortedLayers.length > 1 && (
        <Card className="mt-6 overflow-hidden">
          <button
            onClick={() => setSummaryOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4.5 py-3.5 text-left"
          >
            {violations.length === 0 ? (
              <CheckIcon size={13} className="shrink-0 text-good-text" />
            ) : (
              <AlertTriangleIcon size={14} className="shrink-0 text-crit-text" />
            )}
            <div className="flex-1 min-w-0">
              <div className={cx('text-[12.5px] font-semibold', violations.length === 0 ? 'text-good-text' : 'text-crit-text')}>
                Testing Pyramid Status — {violations.length === 0
                  ? 'Pyramid structure is healthy'
                  : `${violations.length} violation${violations.length > 1 ? 's' : ''} found`}
              </div>
              {/* small bottom→top connector: fewer tests expected at each step up */}
              <div className="flex items-center flex-wrap gap-1 mt-1.5 text-[11px] text-muted">
                {sortedLayers.map((layer, i) => (
                  <span key={layer.id} className="flex items-center gap-1">
                    {i > 0 && (
                      <ChevronDownIcon
                        size={12}
                        className={cx(
                          '-rotate-90 shrink-0',
                          relationByUpperId.get(layer.id)?.violated
                            ? 'text-crit-text'
                            : relationByUpperId.get(layer.id)?.pending
                              ? 'text-axis'
                              : 'text-good-text',
                        )}
                      />
                    )}
                    <span className={cx(
                      'font-medium',
                      relationByUpperId.get(layer.id)?.violated && 'text-crit-text',
                    )}>
                      {layer.name.split(' ')[0]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <ChevronDownIcon size={14} className={cx('shrink-0 text-muted transition-transform', summaryOpen && 'rotate-180')} />
          </button>
          {summaryOpen && (
            <div className="border-t border-grid px-4.5 py-3 space-y-2">
              {violations.length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  Every layer has fewer test cases than the one below it. Unit &gt; Integration &gt; System &gt; UI/E2E.
                </p>
              ) : violations.map(v => (
                <button
                  key={v.upper.id}
                  onClick={() => jumpToLayer(v.upper.id)}
                  className="w-full flex items-center justify-between gap-3 text-left text-[12.5px] px-3 py-2 rounded-lg
                             bg-critical/10 text-crit-text hover:bg-critical/15 transition-colors"
                >
                  <span>{v.message}</span>
                  <ArrowRightIcon className="shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 mt-6">
        {loading && [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        {sortedLayers.map(layer => {
          const relation = relationByUpperId.get(layer.id)
          const violated = relation?.violated ?? false
          return (
            <Card
              key={layer.id}
              ref={el => { if (el) cardRefs.current.set(layer.id, el); else cardRefs.current.delete(layer.id) }}
              className={cx(
                'p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-lift group',
                violated ? 'hover:border-critical' : 'hover:border-accent',
                flashId === layer.id && 'pyramid-flash',
              )}
              style={violated ? { borderColor: 'var(--critical)', boxShadow: '0 0 0 1px var(--critical) inset' } : undefined}
              onClick={() => navigate(`/apps/${appId}/layers/${layer.id}`)}
            >
              <div className="flex items-center gap-2.5">
                <i className="w-2.5 h-8 rounded-full shrink-0"
                   style={{ background: violated ? 'var(--critical)'
                     : `var(${layerAccentVar(layer.order, sortedLayers.length)})` }} />
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold tracking-tight">{layer.name}</h2>
                  <div className="text-[11px] text-muted">{layer.short}</div>
                </div>
                {hasRole('admin') && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleting(layer) }}
                    aria-label={`Delete ${layer.name}`}
                    className="p-1.5 rounded-md text-muted hover:text-crit-text hover:bg-critical/10 transition-colors"
                  >
                    <TrashIcon size={13} />
                  </button>
                )}
                <ArrowRightIcon className={cx(
                  'text-muted transition-transform group-hover:translate-x-0.5',
                  violated ? 'group-hover:text-crit-text' : 'group-hover:text-accent',
                )} />
              </div>
              <p className="text-[12.5px] text-ink2 flex-1">{layer.desc}</p>

              <div className="flex items-center justify-between border-t border-grid pt-3 text-xs text-muted">
                <div>
                  <b className={cx('block text-base font-semibold', violated ? 'text-crit-text' : 'text-ink')}>
                    {fmt(layer.recordCount)}
                  </b>
                  records
                </div>
                <div className="text-right">
                  {layer.lastUploadAt
                    ? <><b className="block font-semibold text-ink">{timeAgo(layer.lastUploadAt)}</b>{layer.lastUploadFile}</>
                    : <span className="italic">no data uploaded yet</span>}
                </div>
              </div>

              {/* pyramid relationship to the layer directly below this one */}
              {relation && relation.violated && (
                <div className="rounded-lg bg-critical/10 border border-critical/30 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-crit-text">
                    <AlertTriangleIcon size={12} className="shrink-0" /> Testing Pyramid Warning
                  </div>
                  <p className="text-[12px] text-crit-text mt-0.5">{relation.message}</p>
                </div>
              )}
              {relation && !relation.violated && !relation.pending && (
                <div className="flex items-center gap-1.5 text-[11.5px] text-good-text">
                  <CheckIcon size={10} className="shrink-0" />
                  Fewer test cases than {relation.lower.name} — pyramid rule followed
                </div>
              )}
              {relation && relation.pending && (
                <div className="text-[11.5px] text-muted italic">
                  Pyramid check pending — waiting on data for {relation.lower.recordCount === 0 ? relation.lower.name : relation.upper.name}
                </div>
              )}

              {hasRole('qa') && (
                <div className="flex gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setSyncFor(layer) }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-lg py-2
                               border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors"
                  >
                    <RefreshIcon size={13} /> Refresh from Excel
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setUploadFor(layer) }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-lg py-2
                               border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors"
                  >
                    <UploadIcon size={13} /> Upload Excel
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {syncFor && (
        <SyncDialog appId={appId} layerId={syncFor.id}
                    onClose={() => setSyncFor(null)} onSynced={reload} />
      )}
      {syncAll && (
        <SyncDialog appId={appId} onClose={() => setSyncAll(false)} onSynced={reload} />
      )}
      {uploadFor && (
        <UploadDialog
          appId={appId}
          layerId={uploadFor.id}
          layerName={uploadFor.name}
          hasData={uploadFor.recordCount > 0}
          onClose={() => setUploadFor(null)}
          onUploaded={reload}
        />
      )}
      {adding && (
        <AddLayerModal appId={appId} layers={sortedLayers}
                       onClose={() => setAdding(false)} onCreated={reload} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete layer?"
          confirmLabel="Delete layer"
          onClose={() => setDeleting(null)}
          onConfirm={async () => { await api.deleteLayer(appId, deleting.id); reload() }}
        >
          <b>{deleting.name}</b> will be permanently removed, including its{' '}
          <b>{fmt(deleting.recordCount)}</b> ingested records and upload history.
          This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}
