import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArrowLeftIcon, LogoutIcon, PyramidLogo } from '../components/icons'
import { cx } from '../lib/format'
import { NAV_ITEMS } from './nav'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', qa: 'QA', manager: 'Manager' }

/** Hierarchical "up" target for the global back button; null on the root page.
    The release being viewed rides along in the query string, so going up from a
    layer lands on the same release rather than resetting to the current one. */
function parentPath(pathname: string, search: string): string | null {
  if (pathname === '/apps') return null
  if (pathname.startsWith('/apps/')) {
    const segments = pathname.split('/').filter(Boolean) // ['apps', appId, 'layers', layerId]
    if (segments.length < 4) return '/apps'
    const release = new URLSearchParams(search).get('release')
    return release
      ? `/apps/${segments[1]}?release=${encodeURIComponent(release)}`
      : `/apps/${segments[1]}`
  }
  return '/apps' // settings, users, anything else
}

export function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const backTo = parentPath(location.pathname, location.search)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-page/90 backdrop-blur-md border-b border-grid">
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center gap-3">
          <NavLink to="/apps" className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight">
            <PyramidLogo className="text-accent" />
            Quality Insights
          </NavLink>
          <nav className="ml-6 flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.filter(item => hasRole(item.minRole)).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cx(
                  'px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-accent-soft text-accent font-semibold' : 'text-ink2 hover:bg-accent-soft',
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-grid">
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-[12.5px] font-semibold">{user.name}</div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</div>
              </div>
              <span className="w-8 h-8 rounded-full bg-accent text-white grid place-items-center text-xs font-bold uppercase">
                {user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </span>
              <button
                onClick={() => setConfirmLogout(true)}
                aria-label="Log out"
                className="p-2 rounded-lg text-ink2 hover:bg-critical/10 hover:text-crit-text transition-colors"
              >
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1180px] mx-auto px-6 py-8">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-ink2 mb-4 px-2 py-1.5 -ml-2
                       rounded-lg hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <ArrowLeftIcon size={14} /> Back
          </button>
        )}
        <Outlet />
      </main>

      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          confirmLabel="Log out"
          onClose={() => setConfirmLogout(false)}
          onConfirm={async () => { logout(); navigate('/login') }}
        >
          Are you sure you want to log out of Quality Insights?
        </ConfirmDialog>
      )}

      <footer className="border-t border-grid py-4">
        <div className="max-w-[1180px] mx-auto px-6 text-xs text-muted">
          Quality Insights · data is ingested from the test team’s Excel sheets per layer.
        </div>
      </footer>
    </div>
  )
}
