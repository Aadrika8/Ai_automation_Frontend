import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './icons'

const THEME_KEY = 'qi.theme'

export function initTheme(): void {
  const stored = localStorage.getItem(THEME_KEY)
  const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg text-ink2 hover:bg-accent-soft hover:text-accent transition-colors"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
