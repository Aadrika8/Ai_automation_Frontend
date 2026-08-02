import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { LogoutIcon, PyramidLogo } from '../components/icons'
import { cx } from '../lib/format'
import { NAV_ITEMS } from './nav'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', qa: 'QA', manager: 'Manager' }

export function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()

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
                onClick={() => { logout(); navigate('/login') }}
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
        <Outlet />
      </main>

      <footer className="border-t border-grid py-4">
        <div className="max-w-[1180px] mx-auto px-6 text-xs text-muted">
          Demo · all figures are simulated. Real data arrives with the backend integration.
        </div>
      </footer>
    </div>
  )
}
