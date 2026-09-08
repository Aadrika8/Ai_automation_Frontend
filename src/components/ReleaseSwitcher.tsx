/* The release control: which version of the application you are looking at.
   Releases roll roughly every six months and each keeps its own layers, Excel
   schema and rows for good, so switching here swaps the entire view — never
   the data. Creating and deleting releases lives in the same menu, since
   there is no separate releases page. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, type ReleaseInfo } from '../api'
import { useAuth } from '../auth/AuthContext'
import { cx, fmt, timeAgo } from '../lib/format'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { CheckIcon, ChevronDownIcon, PlusIcon, TrashIcon } from './icons'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

/** Mirrors the backend's slugify, so the folder hint matches the real id. */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

function NewReleaseModal({ appId, releases, onClose, onCreated }: {
  appId: string
  releases: ReleaseInfo[]
  onClose: () => void
  onCreated: (release: ReleaseInfo) => void
}) {
  const current = releases.find(r => r.current) ?? releases[0]
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [excelPath, setExcelPath] = useState('')
  // a new release almost always tests the same layers as the one before it
  const [copyFrom, setCopyFrom] = useState<string>(current?.id ?? '')
  const [makeCurrent, setMakeCurrent] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const slug = slugify(name)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await api.createRelease(appId, {
        name: name.trim(),
        desc: desc.trim(),
        excelPath: excelPath.trim(),
        copyLayersFrom: copyFrom || null,
        makeCurrent,
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="New release" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[11.5px] text-muted">
          Starts empty. Every release keeps its own data, so loading this one never
          changes what earlier releases hold.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Version</span>
          <input className={`${FIELD} mt-1`} value={name} onChange={e => setName(e.target.value)}
                 placeholder="e.g. v4.5" autoFocus />
          {slug && (
            <span className="text-[11.5px] text-muted mt-1 block">
              Address: <code className="text-ink2">?release={slug}</code>
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Description (optional)</span>
          <input className={`${FIELD} mt-1`} value={desc} onChange={e => setDesc(e.target.value)}
                 placeholder="e.g. Release under test" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Excel folder (optional)</span>
          <input className={`${FIELD} mt-1`} value={excelPath}
                 onChange={e => setExcelPath(e.target.value)}
                 placeholder={slug ? `defaults to ${slug}` : 'defaults to the version slug'} />
          <span className="text-[11.5px] text-muted mt-1 block">
            Folder inside the application's folder holding this release's workbooks.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-ink2">Testing layers</span>
          <select className={`${FIELD} mt-1`} value={copyFrom}
                  onChange={e => setCopyFrom(e.target.value)}>
            <option value="">Default pyramid (Unit → Regression → Feature → System → Acceptance)</option>
            {releases.map(r => (
              <option key={r.id} value={r.id}>Same layers as {r.name}</option>
            ))}
          </select>
          <span className="text-[11.5px] text-muted mt-1 block">
            Only the layer structure is copied — no rows and no column definitions, since
            this release's Excel files may have a different shape.
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={makeCurrent} className="mt-0.5 accent-(--accent)"
                 onChange={e => setMakeCurrent(e.target.checked)} />
          <span>
            <span className="block text-[13px] font-semibold">Make this the current release</span>
            <span className="block text-[11.5px] text-muted">
              The application opens on it. Earlier releases stay readable.
            </span>
          </span>
        </label>

        {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()}
                className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Creating…' : 'Create release'}
        </button>
      </form>
    </Modal>
  )
}

export function ReleaseSwitcher({ appId, releases, active, onSelect, onChanged }: {
  appId: string
  releases: ReleaseInfo[] | null
  active: ReleaseInfo | null
  onSelect: (releaseId: string) => void
  /** a release was created, promoted or deleted — reload the page's data */
  onChanged: () => void
}) {
  const { hasRole } = useAuth()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ReleaseInfo | null>(null)
  const [busy, setBusy] = useState(false)
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

  async function promote(release: ReleaseInfo) {
    setBusy(true)
    try {
      await api.updateRelease(appId, release.id, { current: true })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  if (!releases) return null

  return (
    <div className="relative" ref={root}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch release"
        className={cx(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors',
          open ? 'border-accent text-accent' : 'border-grid text-ink2 hover:border-accent hover:text-accent',
        )}
      >
        <span className="text-[11px] font-medium text-muted uppercase tracking-wide">Release</span>
        {active?.name ?? '—'}
        {active?.current && (
          <span className="text-[10.5px] font-semibold text-good-text bg-good-text/10 rounded px-1.5 py-0.5">
            current
          </span>
        )}
        <ChevronDownIcon size={13} className={cx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="listbox" aria-label="Releases"
             className="absolute right-0 z-30 mt-1.5 w-[320px] rounded-xl border border-grid bg-surface shadow-lift p-1.5 anim-rise">
          <div className="max-h-72 overflow-y-auto">
            {releases.length === 0 && (
              <p className="text-[12px] text-muted px-2.5 py-3">
                No releases yet. Create one to start loading data.
              </p>
            )}
            {releases.map(release => {
              const selected = release.id === active?.id
              return (
                <div key={release.id}
                     className={cx('group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors',
                                   selected ? 'bg-accent-soft' : 'hover:bg-accent-soft/50')}>
                  <button
                    role="option"
                    aria-selected={selected}
                    onClick={() => { onSelect(release.id); setOpen(false) }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={cx('text-[13px] font-semibold truncate',
                                          selected && 'text-accent')}>{release.name}</span>
                      {release.current && (
                        <CheckIcon size={10} className="shrink-0 text-good-text" />
                      )}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {fmt(release.recordCount)} records · {release.layerCount} layers
                      {release.lastUploadAt && ` · loaded ${timeAgo(release.lastUploadAt)}`}
                    </span>
                    {release.desc && (
                      <span className="block text-[11px] text-muted truncate">{release.desc}</span>
                    )}
                  </button>
                  {hasRole('admin') && (
                    <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {!release.current && (
                        <button
                          onClick={() => promote(release)}
                          disabled={busy}
                          title="Make this the current release"
                          aria-label={`Make ${release.name} the current release`}
                          className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-soft transition-colors"
                        >
                          <CheckIcon size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleting(release); setOpen(false) }}
                        title="Delete this release"
                        aria-label={`Delete release ${release.name}`}
                        className="p-1.5 rounded-md text-muted hover:text-crit-text hover:bg-critical/10 transition-colors"
                      >
                        <TrashIcon size={11} />
                      </button>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {hasRole('admin') && (
            <button
              onClick={() => { setAdding(true); setOpen(false) }}
              className="w-full flex items-center gap-1.5 mt-1 pt-2 border-t border-grid px-2.5 py-2 text-[12.5px] font-semibold text-accent hover:bg-accent-soft rounded-lg transition-colors"
            >
              <PlusIcon size={12} /> New release
            </button>
          )}
        </div>
      )}

      {adding && (
        <NewReleaseModal
          appId={appId}
          releases={releases}
          onClose={() => setAdding(false)}
          onCreated={created => { onSelect(created.id); onChanged() }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete release?"
          confirmLabel="Delete release"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteRelease(appId, deleting.id)
            if (deleting.id === active?.id) {
              const next = releases.find(r => r.id !== deleting.id)
              if (next) onSelect(next.id)
            }
            onChanged()
          }}
        >
          <b>{deleting.name}</b> and its <b>{fmt(deleting.recordCount)}</b> ingested records
          across <b>{deleting.layerCount}</b> testing layers will be permanently removed.
          Other releases keep their own data. This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  )
}
