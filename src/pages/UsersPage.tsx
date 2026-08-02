import { api, type Role } from '../api'
import { useData } from '../lib/useData'
import { cx } from '../lib/format'
import { Card, PageTitle, Skeleton } from '../components/ui'

const ROLE_STYLE: Record<Role, string> = {
  admin: 'text-accent bg-accent-soft',
  qa: 'text-good-text bg-good/10',
  manager: 'text-ink2 bg-muted/10',
}
const ROLE_DESC: Record<Role, string> = {
  admin: 'Full access — dashboards, drill-down, settings, users',
  qa: 'Dashboards plus test-case drill-down, failures and runs',
  manager: 'High-level dashboards and reports only',
}

export function UsersPage() {
  const { data: users, loading } = useData(() => api.getUsers(), [])

  return (
    <div className="anim-rise max-w-3xl">
      <PageTitle lede="Who can sign in and what each role can see. User management becomes editable with the backend.">
        Users
      </PageTitle>

      {loading && <Skeleton className="h-72 mt-6" />}
      {users && (
        <Card className="p-2 mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted">
                  {['User', 'Username', 'Role', 'Access', 'Last active'].map(h => (
                    <th key={h} className="font-semibold px-3 py-2.5 border-b border-grid">{h}</th>
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
                    <td className="px-3 py-2.5 border-b border-grid text-xs text-muted whitespace-nowrap">{u.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
