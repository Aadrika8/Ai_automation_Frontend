import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AppSummary } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { fmt } from '../lib/format'
import { Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AppIconFor, ArrowRightIcon, PlusIcon, TrashIcon } from '../components/icons'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'
const ICONS = ['scope', 'people', 'ruler']

function AddAppModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [desc, setDesc] = useState('')
  const [icon, setIcon] = useState('scope')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createApp({ name: name.trim(), tag: tag.trim(), desc: desc.trim(), icon })
      onCreated()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add application" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-ink2">Name</span>
          <input className={`${FIELD} mt-1`} value={name} onChange={e => setName(e.target.value)}
                 placeholder="e.g. PRECiV" autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Tagline (optional)</span>
          <input className={`${FIELD} mt-1`} value={tag} onChange={e => setTag(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Description (optional)</span>
          <input className={`${FIELD} mt-1`} value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        <div>
          <span className="text-xs font-medium text-ink2">Icon</span>
          <div className="flex gap-2 mt-1.5">
            {ICONS.map(i => (
              <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i}
                      className={`w-11 h-11 rounded-[11px] grid place-items-center border transition-colors
                                  ${icon === i ? 'bg-accent-soft text-accent border-accent' : 'border-grid text-muted hover:border-accent'}`}>
                <AppIconFor icon={i} />
              </button>
            ))}
          </div>
        </div>
        {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()}
                className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Creating…' : 'Create application'}
        </button>
      </form>
    </Modal>
  )
}

export function ApplicationsPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: apps, loading, error } = useData(() => api.getApplications(), [reloadKey])
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<AppSummary | null>(null)

  return (
    <div className="anim-rise">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle lede="Select a product to explore its testing layers and quality dashboards.">
          Applications
        </PageTitle>
        {hasRole('admin') && (
          <button onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
            <PlusIcon size={13} /> Add application
          </button>
        )}
      </div>
      {error && <EmptyState title="Could not load applications" hint={error} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mt-7">
        {loading && [0, 1, 2].map(i => <Skeleton key={i} className="h-72" />)}
        {apps?.map(app => (
          <Card
            key={app.id}
            className="p-6 flex flex-col gap-3.5 text-left cursor-pointer transition-all duration-200
                       hover:-translate-y-0.5 hover:shadow-lift hover:border-accent group"
            onClick={() => navigate(`/apps/${app.id}`)}
          >
            <div className="flex items-start justify-between">
              <span className="w-11 h-11 rounded-[11px] grid place-items-center bg-accent-soft text-accent">
                <AppIconFor icon={app.icon} />
              </span>
              {hasRole('admin') && (
                <button
                  onClick={e => { e.stopPropagation(); setDeleting(app) }}
                  aria-label={`Delete ${app.name}`}
                  className="p-1.5 rounded-md text-muted hover:text-crit-text hover:bg-critical/10 transition-colors"
                >
                  <TrashIcon size={13} />
                </button>
              )}
            </div>
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">{app.name}</h2>
              <div className="text-xs text-muted mt-0.5">{app.tag}</div>
            </div>
            <p className="text-[13px] text-ink2 flex-1">{app.desc}</p>
            <div className="flex gap-5 border-t border-grid pt-3.5 text-xs text-muted">
              <div><b className="block text-base font-semibold text-ink">{fmt(app.layerCount)}</b>testing layers</div>
              <div><b className="block text-base font-semibold text-ink">{fmt(app.recordCount)}</b>ingested records</div>
            </div>
            <span className="flex items-center gap-1.5 text-accent font-semibold text-[13px]">
              View Testing Layers
              <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        ))}
      </div>
      {adding && <AddAppModal onClose={() => setAdding(false)} onCreated={() => setReloadKey(k => k + 1)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete application?"
          confirmLabel="Delete application"
          onClose={() => setDeleting(null)}
          onConfirm={async () => { await api.deleteApp(deleting.id); setReloadKey(k => k + 1) }}
        >
          <b>{deleting.name}</b> will be permanently removed, including its{' '}
          <b>{fmt(deleting.layerCount)}</b> layers and <b>{fmt(deleting.recordCount)}</b> ingested
          records. This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}
