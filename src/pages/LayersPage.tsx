import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  api, type AutomationCoverageResponse, type CoverageResponse, type LayerInfo,
  type ReleaseInfo, type SourceStatus,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { useReleases, withRelease } from '../lib/useRelease'
import { monthLabel } from '../lib/period'
import { cx, fmt } from '../lib/format'
import { layerAccentVar } from '../lib/palette'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ReleaseSwitcher } from '../components/ReleaseSwitcher'
import { LoadDialog } from '../components/LoadDialog'
/* UPLOAD DISABLED: import { UploadDialog } from '../components/UploadDialog' */
import {
  AlertTriangleIcon, ArrowRightIcon, CheckIcon, FolderIcon,
  PlusIcon, RefreshIcon, TrashIcon,
} from '../components/icons'

/* ---------- Testing Pyramid rule ----------
   Checked within one release: a release owns its own layers, so its pyramid
   is judged on its own data and never against another release's.
   Every layer must hold strictly fewer test cases than the layer directly
   below it. Layers are compared by their `order` (bottom-first).

   The figure compared is test cases wherever both layers of a pair declare
   them — a regression row is a spec holding hundreds of cases and a feature
   row is one feature, so rows alone say little. Where either side has no
   test-count column the pair falls back to rows, and the message names the
   unit and the layer responsible: setting one layer's cases against the
   other's rows would manufacture a violation out of the units alone.

   A layer with 0 records has no data yet, so any comparison touching it is
   skipped rather than flagged. */
type Unit = 'test cases' | 'rows'

type PyramidRelation = {
  lower: LayerInfo
  upper: LayerInfo
  /** what was compared: test cases when both sides declare them, else rows */
  unit: Unit
  lowerValue: number
  upperValue: number
  /** true once both layers have data but the pyramid rule is broken */
  violated: boolean
  /** true when one side has no data yet, so the rule can't be checked */
  pending: boolean
  message: string
}

/** A layer's own headline figure: its test cases where every one of its files
    declares them, otherwise its rows — always with the word for which. */
function layerFigure(layer: LayerInfo): { value: number; unit: Unit } {
  return layer.testCount != null
    ? { value: layer.testCount, unit: 'test cases' }
    : { value: layer.recordCount, unit: 'rows' }
}

function buildPyramidRelations(layers: LayerInfo[]): PyramidRelation[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  const relations: PyramidRelation[] = []
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1]
    const upper = sorted[i]
    const byTests = lower.testCount != null && upper.testCount != null
    const unit: Unit = byTests ? 'test cases' : 'rows'
    const lowerValue = byTests ? lower.testCount! : lower.recordCount
    const upperValue = byTests ? upper.testCount! : upper.recordCount
    const pending = lower.recordCount === 0 || upper.recordCount === 0
    const violated = !pending && upperValue >= lowerValue
    const uncounted = [lower, upper].filter(l => l.testCount == null).map(l => l.name)
    const why = byTests ? ''
      : ` Compared by rows: ${uncounted.join(' and ')} ${uncounted.length > 1 ? 'have' : 'has'} no test-count column.`
    relations.push({
      lower, upper, unit, lowerValue, upperValue, violated, pending,
      message: `${upper.name} (${fmt(upperValue)} ${unit}) should have fewer ${unit} than ${lower.name} (${fmt(lowerValue)}).${why}`,
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
          <span className="ml-auto shrink-0 text-[11px] text-muted">{fmt(layerFigure(layer).value)} {layerFigure(layer).unit}</span>
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

function AddLayerModal({ appId, releaseId, releaseName, layers, onClose, onCreated }: {
  appId: string
  /** the layer is added to this release only */
  releaseId: string
  releaseName: string
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
      await api.createLayer(appId, releaseId, {
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
          Added to <b className="text-ink2">{releaseName}</b> only — every other release,
          and every other application, keeps its own layers.
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

/* Where this release's data comes from.

   There is one path to show. It is <application name>/<release name> under the
   Excel root unless this release overrides it, so in the normal case nobody
   configures anything here at all — the card just says which folder to create. */
/* Feature <-> System coverage, summarised.

   The two percentages belong on this page because they are a property of the
   release rather than of any one testing layer: neither the Feature card nor
   the System card can own a number that is about the gap between them. */
/* ---------- The status strip ----------
   One row of chips instead of three stacked banners. Each answers a different
   question about the release, and each is a link to the page that answers it
   properly. The point of putting them side by side is that none of them
   deserves a full-width row of its own — together they are a header, apart
   they were a wall. */

function Chip({ label, children, onClick, ariaLabel }: {
  label: string
  children: ReactNode
  onClick?: () => void
  ariaLabel?: string
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick() }}
      className={cx('flex-1 min-w-[150px] px-4 py-2.5 flex flex-col gap-0.5',
                    onClick && 'cursor-pointer hover:bg-accent-soft/40 transition-colors')}
    >
      <div className="text-[11px] text-muted">{label}</div>
      {children}
    </div>
  )
}

const chipValue = 'text-[17px] font-semibold tracking-tight tabular-nums'

/** Traceability between testing types, as one entry. Feature ↔ System is the
    only pair today; its two directions share one chip because they are one
    comparison read both ways, and a single click opens the page that holds
    every pair. Absent when the release has no pair to compare. */
function TraceabilityChip({ appId, releaseId, layers, reloadKey }: {
  appId: string
  releaseId: string
  layers: LayerInfo[]
  reloadKey: number
}) {
  const navigate = useNavigate()
  const pair = ['feature', 'system'].every(id => layers.some(l => l.id === id))
  const { data } = useData<CoverageResponse | null>(
    () => (pair && releaseId ? api.getCoverage(appId, releaseId) : Promise.resolve(null)),
    [appId, releaseId, pair, reloadKey],
  )
  if (!pair) return null

  const summary = data?.summary
  const blocked = data?.errorCode ? data.error : null
  const go = () => navigate(withRelease(`/apps/${appId}/traceability`, releaseId))

  return (
    <Chip label="Traceability" onClick={go} ariaLabel="Traceability between testing types">
      {blocked || !summary
        ? <div className="text-[13px] text-muted pt-0.5">{blocked ?? 'Checking…'}</div>
        : <>
            <div className={chipValue}>
              {summary.forwardCoveragePct.toFixed(1)}%
              <span className="text-muted font-normal mx-1.5">·</span>
              {summary.backwardCoveragePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-muted">Feature → System · System → Feature</div>
          </>}
    </Chip>
  )
}

/** A release-level figure: no single layer owns the count-weighted number. */
function AutomationChip({ appId, releaseId, reloadKey }: {
  appId: string
  releaseId: string
  reloadKey: number
}) {
  const navigate = useNavigate()
  const { data } = useData<AutomationCoverageResponse | null>(
    () => (releaseId ? api.getAutomationCoverage(appId, releaseId) : Promise.resolve(null)),
    [appId, releaseId, reloadKey],
  )
  const evident = data?.evident
  return (
    <Chip label="Automation"
          onClick={() => navigate(withRelease(`/apps/${appId}/benchmark`, releaseId))}
          ariaLabel="Automation coverage against the industry reference">
      {evident?.measured
        ? <div className={chipValue}>{evident.coveragePct?.toFixed(1)}%</div>
        : <div className="text-[13px] text-muted pt-0.5">
            {data ? 'not measured' : 'Checking…'}
          </div>}
    </Chip>
  )
}

/* ---------- The pyramid, drawn ----------
   The rule is about relative size, so it is worth a shape rather than a
   sentence. The trapezoids are the *rule*, not the data: fixed geometry that
   stays legible whatever the counts are. What is real is the colour, the count
   on every tier, and the comparison spelled out on each boundary that breaks —
   without those a reader could take the tidy shape for a healthy pyramid.

   A layer with no rows is grey rather than green: the rule cannot be checked
   against zero, which is not the same as passing it. */

const TIER_H = 54
const APEX_W = 90
const BASE_W = 460

function PyramidPanel({ layers, relationByUpperId, onOpen }: {
  /** bottom-first, as the pyramid is ordered */
  layers: LayerInfo[]
  relationByUpperId: Map<string, PyramidRelation>
  onOpen: (layerId: string) => void
}) {
  if (layers.length < 2) return null
  const n = layers.length
  const height = n * TIER_H
  const step = (BASE_W - APEX_W) / n
  const cx0 = BASE_W / 2

  // drawn tip-first, so the highest layer is the top trapezoid
  const tiers = [...layers].reverse().map((layer, i) => {
    const relation = relationByUpperId.get(layer.id)
    const violated = relation?.violated ?? false
    const empty = layer.recordCount === 0
    const wTop = APEX_W + step * i
    const wBot = APEX_W + step * (i + 1)
    const yTop = i * TIER_H
    const yBot = yTop + TIER_H
    return {
      layer, violated, empty, relation, yTop, yBot, wBot,
      points: [
        `${cx0 - wTop / 2},${yTop}`, `${cx0 + wTop / 2},${yTop}`,
        `${cx0 + wBot / 2},${yBot}`, `${cx0 - wBot / 2},${yBot}`,
      ].join(' '),
      fill: violated ? 'var(--critical)'
        : empty ? 'var(--axis)'
          : `var(${layerAccentVar(layer.order, n)})`,
    }
  })

  const broken = tiers.filter(t => t.violated)

  return (
    <Card className="mt-4 p-5 grid gap-8 lg:grid-cols-[minmax(0,440px)_1fr] items-center">
      <svg viewBox={`-8 -8 ${BASE_W + 150} ${height + 16}`} className="w-full h-auto"
           role="img"
           aria-label={broken.length === 0
             ? 'Testing pyramid: every layer holds fewer test cases than the one below it.'
             : `Testing pyramid: ${broken.length} layer(s) hold more test cases than the layer below.`}>
        {tiers.map(t => (
          <g key={t.layer.id} className="cursor-pointer"
             onClick={() => onOpen(t.layer.id)}>
            <polygon points={t.points} fill={t.fill}
                     stroke="var(--page)" strokeWidth="2" />
            <text x={cx0} y={t.yTop + TIER_H / 2 + 4} textAnchor="middle"
                  fontSize="12.5" fontWeight="600"
                  fill={t.empty ? 'var(--muted)' : '#ffffff'}
                  fontFamily="system-ui, sans-serif" pointerEvents="none">
              {t.layer.name.split(' ')[0]} · {fmt(layerFigure(t.layer).value)}
            </text>
            {!t.empty && (
              <text x={cx0} y={t.yTop + TIER_H / 2 + 17} textAnchor="middle"
                    fontSize="9.5" fill="#ffffff" fillOpacity="0.8"
                    fontFamily="system-ui, sans-serif" pointerEvents="none">
                {layerFigure(t.layer).unit}
              </text>
            )}
          </g>
        ))}
        {/* the comparison, on the boundary that breaks it */}
        {tiers.filter(t => t.violated && t.relation).map(t => (
          <g key={`b-${t.layer.id}`} fontFamily="system-ui, sans-serif" fontSize="10.5"
             fill="var(--crit-text)">
            <line x1={cx0 + t.wBot / 2} y1={t.yBot} x2={BASE_W + 6} y2={t.yBot - 8}
                  stroke="var(--crit-text)" strokeWidth="1" strokeDasharray="3 2" />
            <text x={BASE_W + 10} y={t.yBot - 5}>
              {fmt(t.relation!.upperValue)} ≥ {fmt(t.relation!.lowerValue)} {t.relation!.unit === 'test cases' ? 'tests' : 'rows'}
            </text>
          </g>
        ))}
      </svg>

      <div>
        <div className={cx('text-[15px] font-semibold tracking-tight',
                           broken.length > 0 && 'text-crit-text')}>
          {broken.length === 0
            ? 'The pyramid holds.'
            : broken.length === 1
              ? 'One layer is wider than the one below it.'
              : `${broken.length} layers are wider than the one below them.`}
        </div>
        <p className="text-[12.5px] text-muted mt-1 mb-3.5 leading-relaxed">
          Each layer should hold fewer test cases than the one below it. Where
          both layers of a pair declare a test count, that is what is compared;
          where either has none, rows are — and every figure says which.
        </p>
        <div>
          {[...layers].reverse().map(layer => {
            const relation = relationByUpperId.get(layer.id)
            const violated = relation?.violated ?? false
            const empty = layer.recordCount === 0
            return (
              <button key={layer.id} onClick={() => onOpen(layer.id)}
                      className="w-full grid grid-cols-[10px_1fr_auto] items-center gap-2.5
                                 py-1.5 border-b border-grid/60 last:border-0 text-left
                                 text-[12.5px] hover:text-accent transition-colors">
                <i className="w-2.5 h-2.5 rounded-sm shrink-0"
                   style={{ background: violated ? 'var(--critical)'
                     : empty ? 'var(--axis)'
                       : `var(${layerAccentVar(layer.order, layers.length)})` }} />
                <span className={cx(empty && 'text-muted')}>{layer.name}</span>
                <span className={cx('tabular-nums', violated ? 'text-crit-text' : 'text-muted')}>
                  {empty
                    ? 'no data — not checked'
                    : violated
                      ? `${fmt(relation!.upperValue)} ${relation!.unit} — should be under ${fmt(relation!.lowerValue)}`
                      : `${fmt(layerFigure(layer).value)} ${layerFigure(layer).unit}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function PathRow({ value, placeholder, canEdit, onSave }: {
  value: string
  placeholder: string
  canEdit: boolean
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-baseline gap-2 flex-wrap text-[11.5px]">
      {editing ? (
        <span className="flex flex-wrap items-center gap-2 flex-1">
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                 placeholder={placeholder} aria-label="Release folder"
                 className="flex-1 min-w-[180px] bg-surface border border-grid rounded-lg px-2.5 py-1.5 text-[12.5px] outline-none focus:border-accent transition-colors" />
          <button onClick={save} disabled={busy}
                  className="text-[12.5px] font-semibold bg-accent text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setDraft(value); setError(null) }}
                  className="text-[12.5px] text-muted px-2 py-1.5">Cancel</button>
        </span>
      ) : (
        canEdit && (
          <button onClick={() => { setDraft(value); setEditing(true) }}
                  className="text-[11.5px] font-semibold text-muted hover:text-accent transition-colors">
            Change folder
          </button>
        )
      )}
      {error && <span className="basis-full text-crit-text">{error}</span>}
    </div>
  )
}

/* Where the workbooks come from, on one line.

   This was a five-line card at the top of the page: the path, a sentence about
   how the folder is named, the change control, and the matched count. All of it
   is setup — it matters once, when a release is first pointed at a folder, and
   never again. So it reads as one quiet line under the title, and names the
   workbook that is missing rather than only counting the ones that are not. */
function SourceLine({ appId, release, source, canEdit, onSaved }: {
  appId: string
  release: ReleaseInfo | null
  source: SourceStatus | null
  canEdit: boolean
  onSaved: () => void
}) {
  if (!source || !release) return null
  const missing = source.layers.filter(l => l.files.length === 0)

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
      <FolderIcon size={13} className={cx('shrink-0', source.ok ? 'text-muted' : 'text-crit-text')} />
      <span className={cx('break-all', source.ok ? 'text-ink2' : 'text-crit-text')}>
        {source.ok ? source.resolvedPath : source.error ?? 'No Excel root folder is configured.'}
      </span>
      {source.ok && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {missing.length === 0
              ? `all ${source.layers.length} layers matched`
              : `${source.layers.length - missing.length} of ${source.layers.length} matched — `
                + `no ${missing.map(l => `${l.layerId}.xlsx`).join(', ')}`}
          </span>
        </>
      )}
      {source.ok && source.changedCount > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-accent">{source.changedCount} changed since the last load</span>
        </>
      )}
      {source.unmatchedFiles.length > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>ignored: {source.unmatchedFiles.map(f => f.relativePath).join(', ')}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <PathRow
        value={release.excelPath}
        placeholder={`leave blank for ${source.folder}`}
        canEdit={canEdit}
        onSave={async next => {
          await api.updateRelease(appId, release.id, { excelPath: next })
          onSaved()
        }}
      />
    </div>
  )
}

export function LayersPage() {
  const { appId = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: apps } = useData(() => api.getApplications(), [reloadKey])
  // which release is being viewed — everything below is scoped to it
  const { releases, active, activeId, select, loading: releasesLoading } =
    useReleases(appId, reloadKey)
  const { data: layers, loading, error } = useData(
    () => (activeId ? api.getLayers(appId, activeId) : Promise.resolve([] as LayerInfo[])),
    [appId, activeId, reloadKey],
  )
  const [syncFor, setSyncFor] = useState<LayerInfo | null>(null)
  const [syncAll, setSyncAll] = useState(false)
  /* UPLOAD DISABLED: const [uploadFor, setUploadFor] = useState<LayerInfo | null>(null) */
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<LayerInfo | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const app = apps?.find(a => a.id === appId)
  const appName = app?.name ?? appId
  const { data: source } = useData<SourceStatus | null>(
    () => (activeId ? api.getSource(appId, activeId) : Promise.resolve(null)),
    [appId, activeId, reloadKey],
  )
  const reload = () => setReloadKey(k => k + 1)

  // bottom-first (Unit → Integration → System → UI/E2E), same order the
  // pyramid rule is defined in, so cards and the connector line up
  const sortedLayers = useMemo(() => (layers ? [...layers].sort((a, b) => a.order - b.order) : []), [layers])
  const relations = useMemo(() => buildPyramidRelations(sortedLayers), [sortedLayers])
  const relationByUpperId = useMemo(() => new Map(relations.map(r => [r.upper.id, r])), [relations])
  const violations = useMemo(() => relations.filter(r => r.violated), [relations])

  function jumpToLayer(id: string) {
    cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashId(id)
    window.setTimeout(() => setFlashId(f => (f === id ? null : f)), 1500)
  }

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[{ label: 'Applications', to: '/apps' }, { label: appName }]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle lede="Pick a testing layer to browse this release's ingested data and dashboard, or refresh it from the configured Excel folder.">
          {appName} — Testing Layers
        </PageTitle>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ReleaseSwitcher appId={appId} releases={releases} active={active}
                           onSelect={select} onChanged={reload} />
          {activeId && (
            <button onClick={() => navigate(withRelease(`/apps/${appId}/report`, activeId))}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3.5 py-2 border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
              QA report
            </button>
          )}
          {hasRole('qa') && activeId && (
            <button onClick={() => setSyncAll(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
              <RefreshIcon size={13} /> Load from Excel
            </button>
          )}
          {hasRole('admin') && activeId && (
            <button onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3.5 py-2 border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
              <PlusIcon size={13} /> Add layer
            </button>
          )}
        </div>
      </div>

      {error && <EmptyState title="Could not load layers" hint={error} />}
      {!releasesLoading && releases?.length === 0 && (
        <EmptyState
          title="No releases yet"
          hint={hasRole('admin')
            ? 'Create a release from the Release menu above — each one keeps its own testing layers and data.'
            : 'An admin needs to create a release before data can be loaded.'}
        />
      )}

      <SourceLine appId={appId} release={active} source={source ?? null}
                  canEdit={hasRole('admin')} onSaved={reload} />

      {/* One strip, so that no single figure claims a row of its own. The
          violation count leads because it is the only thing here that is a
          finding rather than a reading. */}
      {!loading && activeId && sortedLayers.length > 0 && (
        <Card className="mt-4 flex flex-wrap items-stretch overflow-hidden divide-x divide-grid">
          {sortedLayers.length > 1 && (
            <button
              onClick={() => violations.length > 0 && jumpToLayer(violations[0].upper.id)}
              className={cx('flex items-center gap-2.5 px-4 py-2.5 text-left min-w-[230px]',
                            violations.length > 0
                              ? 'bg-critical/10 hover:bg-critical/15 transition-colors'
                              : 'bg-good/5')}
            >
              {violations.length === 0
                ? <CheckIcon size={14} className="shrink-0 text-good-text" />
                : <AlertTriangleIcon size={15} className="shrink-0 text-crit-text" />}
              <span>
                <span className={cx('block text-[14px] font-semibold',
                                    violations.length === 0 ? 'text-good-text' : 'text-crit-text')}>
                  {violations.length === 0
                    ? 'Pyramid holds'
                    : `${violations.length} pyramid violation${violations.length > 1 ? 's' : ''}`}
                </span>
                <span className="block text-[11px] text-muted">
                  {violations.length === 0
                    ? 'every layer is smaller than the one below'
                    : violations.map(v => v.upper.name.split(' ')[0]).join(' and ')}
                </span>
              </span>
            </button>
          )}
          <TraceabilityChip appId={appId} releaseId={activeId}
                         layers={sortedLayers} reloadKey={reloadKey} />
          <AutomationChip appId={appId} releaseId={activeId} reloadKey={reloadKey} />
          {source?.ok && (
            <Chip label="Workbooks matched">
              <div className={chipValue}>
                {source.layers.filter(l => l.files.length > 0).length}
                <span className="text-muted font-normal"> of {source.layers.length}</span>
              </div>
            </Chip>
          )}
        </Card>
      )}

      {!loading && (
        <PyramidPanel layers={sortedLayers} relationByUpperId={relationByUpperId}
                      onOpen={jumpToLayer} />
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
              onClick={() => navigate(withRelease(`/apps/${appId}/layers/${layer.id}`, activeId))}
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
                    {fmt(layerFigure(layer).value)}
                  </b>
                  {layer.testCount != null
                    ? `test cases · ${fmt(layer.recordCount)} rows`
                    : 'rows'}
                </div>
                <div className="text-right">
                  {layer.latestSnapshotAt
                    ? (
                      <>
                        <b className="block font-semibold text-ink">
                          {monthLabel(layer.latestPeriod)}
                        </b>
                        {layer.fileCount === 1
                          ? '1 file'
                          : `${fmt(layer.fileCount)} files`}
                        {' · '}
                        {layer.snapshotCount === 1
                          ? '1 snapshot'
                          : `${fmt(layer.snapshotCount)} snapshots`}
                      </>
                    )
                    : <span className="italic">no data loaded yet</span>}
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
                  Fewer {relation.unit} than {relation.lower.name} — pyramid rule followed
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
                    <RefreshIcon size={13} /> Load from Excel
                  </button>
                  {/* UPLOAD DISABLED
                  <button
                    onClick={e => { e.stopPropagation(); setUploadFor(layer) }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-lg py-2
                               border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors"
                  >
                    <UploadIcon size={13} /> Upload Excel
                  </button>
                  */}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {syncFor && (
        <LoadDialog appId={appId} releaseId={activeId} releaseName={active?.name ?? ''}
                    layerId={syncFor.id}
                    onClose={() => setSyncFor(null)} onLoaded={reload} />
      )}
      {syncAll && (
        <LoadDialog appId={appId} releaseId={activeId} releaseName={active?.name ?? ''}
                    onClose={() => setSyncAll(false)} onLoaded={reload} />
      )}
      {/* UPLOAD DISABLED
      {uploadFor && (
        <UploadDialog
          appId={appId}
          releaseId={activeId}
          releaseName={active?.name ?? ''}
          layerId={uploadFor.id}
          layerName={uploadFor.name}
          hasData={uploadFor.recordCount > 0}
          onClose={() => setUploadFor(null)}
          onUploaded={reload}
        />
      )}
      */}
      {adding && (
        <AddLayerModal appId={appId} releaseId={activeId} releaseName={active?.name ?? ''}
                       layers={sortedLayers}
                       onClose={() => setAdding(false)} onCreated={reload} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete layer?"
          confirmLabel="Delete layer"
          onClose={() => setDeleting(null)}
          onConfirm={async () => { await api.deleteLayer(appId, activeId, deleting.id); reload() }}
        >
          <b>{deleting.name}</b> will be permanently removed from{' '}
          <b>{active?.name ?? 'this release'}</b>, including its{' '}
          <b>{fmt(deleting.recordCount)}</b> current records and every snapshot behind them.
          Other releases keep their own copy of the layer. This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}
