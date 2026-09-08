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
  AlertTriangleIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, FolderIcon, LinkIcon,
  PlusIcon, RefreshIcon, RulerIcon, TrashIcon,
} from '../components/icons'

/* ---------- Testing Pyramid rule ----------
   Checked within one release: a release owns its own layers, so its pyramid
   is judged on its own data and never against another release's.
   Every layer must have strictly fewer test cases than the layer directly
   below it (Unit > Integration > System > UI/E2E). Layers are compared by
   their `order` (bottom-first). A layer with 0 records means no data has
   been loaded yet, so any comparison touching it is skipped rather than
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
function CoverageCard({ appId, releaseId, layers, reloadKey }: {
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
  const gaps = summary ? summary.missingInSystem + summary.missingInFeature : 0
  const clean = Boolean(summary) && gaps === 0 && !blocked

  const figure = (label: string, value: number) => (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums">{value.toFixed(1)}%</div>
    </div>
  )

  return (
    <Card
      className="mt-6 p-4.5 flex flex-wrap items-center gap-x-6 gap-y-3 cursor-pointer
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:border-accent"
      role="button"
      tabIndex={0}
      onClick={() => navigate(withRelease(`/apps/${appId}/coverage`, releaseId))}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(withRelease(`/apps/${appId}/coverage`, releaseId)) }}
      ariaLabel="Feature to System coverage"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-[210px]">
        <LinkIcon className="shrink-0 text-accent" />
        <div>
          <div className="text-[12.5px] font-semibold">Feature ↔ System coverage</div>
          <div className="text-[11px] text-muted">
            {blocked ?? (clean
              ? 'Every feature is verified, and every system item is planned'
              : summary
                ? `${fmt(gaps)} gap${gaps === 1 ? '' : 's'} across both directions`
                : 'Checking…')}
          </div>
        </div>
      </div>
      {summary && !blocked && (
        <div className="flex items-center gap-6">
          {figure('Feature → System', summary.forwardCoveragePct)}
          {figure('System → Feature', summary.backwardCoveragePct)}
        </div>
      )}
      <ArrowRightIcon className="text-muted" />
    </Card>
  )
}

/* Automation coverage, summarised.

   A release-level property like the coverage card above it: no single testing
   layer owns the count-weighted figure, and the industry reference it sits
   beside belongs to none of them either. */
function BenchmarkCard({ appId, releaseId, reloadKey }: {
  appId: string
  releaseId: string
  reloadKey: number
}) {
  const navigate = useNavigate()
  const { data } = useData<AutomationCoverageResponse | null>(
    () => (releaseId ? api.getAutomationCoverage(appId, releaseId) : Promise.resolve(null)),
    [appId, releaseId, reloadKey],
  )
  const go = () => navigate(withRelease(`/apps/${appId}/benchmark`, releaseId))
  const evident = data?.evident
  const reference = data?.reference

  return (
    <Card
      className="mt-4 p-4.5 flex flex-wrap items-center gap-x-6 gap-y-3 cursor-pointer
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:border-accent"
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') go() }}
      ariaLabel="Automation coverage against the industry reference"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-[210px]">
        <RulerIcon className="shrink-0 text-accent" />
        <div>
          <div className="text-[12.5px] font-semibold">Automation coverage</div>
          <div className="text-[11px] text-muted">
            {!data ? 'Checking…'
              : evident?.measured
                ? `against a surveyed range of ${reference?.low}–${reference?.high}%`
                : 'not measured — no automated-test count in the workbooks'}
          </div>
        </div>
      </div>
      {evident?.measured && (
        <div>
          <div className="text-[11px] text-muted">Evident</div>
          <div className="text-[15px] font-semibold tabular-nums">{evident.coveragePct?.toFixed(1)}%</div>
        </div>
      )}
      <ArrowRightIcon className="text-muted" />
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

function ExcelSourceCard({ appId, release, source, canEdit, onSaved }: {
  appId: string
  release: ReleaseInfo | null
  source: SourceStatus | null
  canEdit: boolean
  onSaved: () => void
}) {
  if (!source || !release) return null
  const matched = source.layers.filter(l => l.files.length > 0)

  return (
    <Card className="mt-6 p-4">
      <div className="flex items-start gap-2.5">
        <FolderIcon size={15} className={cx('mt-0.5 shrink-0', source.ok ? 'text-muted' : 'text-crit-text')} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-[12.5px] font-semibold">
            Excel source — {release.name}
          </div>
          <p className={cx('text-[11.5px] break-all', source.ok ? 'text-muted' : 'text-crit-text')}>
            {source.ok
              ? source.resolvedPath
              : source.error ?? 'No Excel root folder is configured.'}
          </p>
          <p className="text-[11.5px] text-muted">
            {source.customFolder
              ? <>Reading <code className="text-ink2">{source.folder}</code> under the Excel root.</>
              : <>Named after the application and the release. Put this release's
                 workbooks in <code className="text-ink2">{source.folder}</code>, one per
                 layer — <code>regression.xlsx</code>, <code>acceptance.xlsx</code>.</>}
          </p>
          <PathRow
            value={release.excelPath}
            placeholder={`leave blank for ${source.folder}`}
            canEdit={canEdit}
            onSave={async next => {
              await api.updateRelease(appId, release.id, { excelPath: next })
              onSaved()
            }}
          />
          {source.ok && (
            <p className="text-[11.5px] text-muted">
              {matched.length} of {source.layers.length} layers matched to a workbook
              {source.changedCount > 0 && ` · ${source.changedCount} changed since the last refresh`}
              {source.unmatchedFiles.length > 0 &&
                ` · ignored: ${source.unmatchedFiles.map(f => f.relativePath).join(', ')}`}
            </p>
          )}
        </div>
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
  const [summaryOpen, setSummaryOpen] = useState(false)
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
    setSummaryOpen(true)
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

      <ExcelSourceCard appId={appId} release={active} source={source ?? null}
                       canEdit={hasRole('admin')} onSaved={reload} />

      {!loading && activeId && (
        <CoverageCard appId={appId} releaseId={activeId}
                      layers={sortedLayers} reloadKey={reloadKey} />
      )}

      {!loading && activeId && (
        <BenchmarkCard appId={appId} releaseId={activeId} reloadKey={reloadKey} />
      )}

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
                    {fmt(layer.recordCount)}
                  </b>
                  records
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
