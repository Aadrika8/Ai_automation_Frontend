import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/ui'
import { PyramidLogo } from '../components/icons'

const DEMO_USERS = [
  { u: 'manager', p: 'manager123', label: 'Manager' },
  { u: 'qa', p: 'qa123', label: 'QA' },
  { u: 'admin', p: 'admin123', label: 'Admin' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/apps'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // honor the deep-link target here too — this render races navigate(from)
  // after login, and both must agree on the destination
  if (user) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

  return (
    <div className="min-h-screen grid place-items-center px-6 py-10">
      <div className="w-full max-w-sm anim-rise">
        <div className="flex items-center justify-center gap-2.5 mb-6 font-bold text-lg tracking-tight">
          <PyramidLogo size={24} className="text-accent" />
          Quality Insights
        </div>
        <Card className="p-7">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-[12.5px] text-muted mt-0.5 mb-5">Testing Pyramid dashboards for your products</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink2">Username</span>
              <input
                className={`${field} mt-1`}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink2">Password</span>
              <input
                className={`${field} mt-1`}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{error}</div>
            )}
            <button
              type="submit"
              disabled={busy || !username || !password}
              className="w-full bg-accent text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Card>
        <div className="mt-4 text-center">
          <div className="text-[11.5px] text-muted mb-2">Demo accounts — click to fill</div>
          <div className="flex justify-center gap-2">
            {DEMO_USERS.map(d => (
              <button
                key={d.u}
                onClick={() => { setUsername(d.u); setPassword(d.p); setError(null) }}
                className="text-xs px-3 py-1.5 rounded-full bg-surface border border-hairline text-ink2 hover:border-accent hover:text-accent transition-colors"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
