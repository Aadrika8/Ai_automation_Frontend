import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type LayerInfo } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { fmt, timeAgo } from '../lib/format'
import { layerColorVar } from '../lib/palette'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { UploadDialog } from '../components/UploadDialog'
import { ArrowRightIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/icons'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

function AddLayerModal({ appId, onClose, onCreated }: {
  appId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createLayer(appId, { name: name.trim(), desc: desc.trim() })
      onCreated()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add testing layer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-ink2">Name</span>
          <input className={`${FIELD} mt-1`} value={name} onChange={e => setName(e.target.value)}
                 placeholder="e.g. Smoke testing" autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Description (optional)</span>
          <input className={`${FIELD} mt-1`} value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()}
                className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Creating…' : 'Create layer'}
        </button>
      </form>
    </Modal>
  )
}

export function LayersPage() {
  const { appId = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: apps } = useData(() => api.getApplications(), [reloadKey])
  const { data: layers, loading, error } = useData(() => api.getLayers(appId), [appId, reloadKey])
  const [uploadFor, setUploadFor] = useState<LayerInfo | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<LayerInfo | null>(null)

  const appName = apps?.find(a => a.id === appId)?.name ?? appId
  const reload = () => setReloadKey(k => k + 1)

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[{ label: 'Applications', to: '/apps' }, { label: appName }]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle lede="Pick a testing layer to browse its ingested data and dashboard, or upload a new Excel sheet.">
          {appName} — Testing Layers
        </PageTitle>
        {hasRole('admin') && (
          <button onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
            <PlusIcon size={13} /> Add layer
          </button>
        )}
      </div>

      {error && <EmptyState title="Could not load layers" hint={error} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 mt-6">
        {loading && [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        {layers?.map(layer => (
          <Card
            key={layer.id}
            className="p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200
                       hover:-translate-y-0.5 hover:shadow-lift hover:border-accent group"
            onClick={() => navigate(`/apps/${appId}/layers/${layer.id}`)}
          >
            <div className="flex items-center gap-2.5">
              <i className="w-2.5 h-8 rounded-full shrink-0"
                 style={{ background: `var(${layerColorVar(layer.order)})` }} />
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
              <ArrowRightIcon className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
            <p className="text-[12.5px] text-ink2 flex-1">{layer.desc}</p>
            <div className="flex items-center justify-between border-t border-grid pt-3 text-xs text-muted">
              <div>
                <b className="block text-base font-semibold text-ink">{fmt(layer.recordCount)}</b>
                records
              </div>
              <div className="text-right">
                {layer.lastUploadAt
                  ? <><b className="block font-semibold text-ink">{timeAgo(layer.lastUploadAt)}</b>{layer.lastUploadFile}</>
                  : <span className="italic">no data uploaded yet</span>}
              </div>
            </div>
            {hasRole('qa') && (
              <button
                onClick={e => { e.stopPropagation(); setUploadFor(layer) }}
                className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-lg py-2
                           border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors"
              >
                <UploadIcon size={13} /> Upload Excel
              </button>
            )}
          </Card>
        ))}
      </div>

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
      {adding && <AddLayerModal appId={appId} onClose={() => setAdding(false)} onCreated={reload} />}
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
