import { useState, type FormEvent } from 'react'
import { api, type ManagedUser, type Role } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { cx, timeAgo } from '../lib/format'
import { Card, PageTitle, Skeleton } from '../components/ui'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlusIcon, TrashIcon } from '../components/icons'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

const ROLE_STYLE: Record<Role, string> = {
  admin: 'text-accent bg-accent-soft',
  qa: 'text-good-text bg-good/10',
  manager: 'text-ink2 bg-muted/10',
}
const ROLE_DESC: Record<Role, string> = {
  admin: 'Full access — data, uploads, apps & layers, settings, users',
  qa: 'Browse layer data and dashboards, upload Excel sheets',
  manager: 'Read-only access to layer data and dashboards',
}
const ROLES: Role[] = ['manager', 'qa', 'admin']

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('qa')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createUser({ username: username.trim(), name: name.trim(), password, role })
      onCreated()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-ink2">Username</span>
          <input className={`${FIELD} mt-1`} value={username} onChange={e => setUsername(e.target.value)}
                 placeholder="e.g. rverma" autoComplete="off" autoFocus />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Full name</span>
          <input className={`${FIELD} mt-1`} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink2">Password</span>
          <input className={`${FIELD} mt-1`} type="password" value={password}
                 onChange={e => setPassword(e.target.value)} autoComplete="new-password"
                 placeholder="at least 6 characters" />
        </label>
        <div>
          <span className="text-xs font-medium text-ink2">Role</span>
          <div className="space-y-1.5 mt-1.5">
            {ROLES.map(r => (
              <label key={r}
                     className={cx('flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                                   role === r ? 'border-accent bg-accent-soft/50' : 'border-grid hover:border-accent')}>
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)}
                       className="mt-0.5 accent-(--accent)" />
                <span>
                  <span className="block text-[13px] font-semibold capitalize">{r}</span>
                  <span className="block text-[11.5px] text-muted">{ROLE_DESC[r]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit"
                disabled={busy || username.trim().length < 3 || !name.trim() || password.length < 6}
                className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
          {busy ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const { user: me } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: users, loading } = useData(() => api.getUsers(), [reloadKey])
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ManagedUser | null>(null)

  const reload = () => setReloadKey(k => k + 1)

  return (
    <div className="anim-rise max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle lede="Who can sign in and what each role can see.">
          Users
        </PageTitle>
        <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
          <PlusIcon size={13} /> Add user
        </button>
      </div>

      {loading && <Skeleton className="h-72 mt-6" />}
      {users && (
        <Card className="p-2 mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted">
                  {['User', 'Username', 'Role', 'Access', 'Last active', ''].map((h, i) => (
                    <th key={i} className="font-semibold px-3 py-2.5 border-b border-grid">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username} className="hover:bg-accent-soft/60 transition-colors">
                    <td className="px-3 py-2.5 border-b border-grid">
                      <span className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-accent text-white grid place-items-center text-[10px] font-bold uppercase">
                          {u.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </span>
                        <span className="font-semibold">{u.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-grid text-ink2 font-mono text-xs">{u.username}</td>
                    <td className="px-3 py-2.5 border-b border-grid">
                      <span className={cx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', ROLE_STYLE[u.role])}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-grid text-xs text-muted">{ROLE_DESC[u.role]}</td>
                    <td className="px-3 py-2.5 border-b border-grid text-xs text-muted whitespace-nowrap">{timeAgo(u.lastActive)}</td>
                    <td className="px-3 py-2.5 border-b border-grid text-right">
                      {u.username === me?.username ? (
                        <span className="text-[11px] text-muted italic whitespace-nowrap">you</span>
                      ) : (
                        <button onClick={() => setDeleting(u)} aria-label={`Delete ${u.username}`}
                                className="p-1.5 rounded-md text-muted hover:text-crit-text hover:bg-critical/10 transition-colors">
                          <TrashIcon size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding && <AddUserModal onClose={() => setAdding(false)} onCreated={reload} />}
      {deleting && (
        <ConfirmDialog
          title="Delete user?"
          confirmLabel="Delete user"
          onClose={() => setDeleting(null)}
          onConfirm={async () => { await api.deleteUser(deleting.username); reload() }}
        >
          <b>{deleting.name}</b> (<span className="font-mono text-xs">{deleting.username}</span>) will
          no longer be able to sign in. This does not affect any data they uploaded.
        </ConfirmDialog>
      )}
    </div>
  )
}
