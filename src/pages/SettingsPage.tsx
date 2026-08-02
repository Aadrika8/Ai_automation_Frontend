import { useEffect, useState, type FormEvent } from 'react'
import { api, type AppSettings } from '../api'
import { Card, PageTitle, Skeleton } from '../components/ui'

const FIELD = 'w-full bg-surface border border-grid rounded-lg px-3 py-2.5 outline-none focus:border-accent transition-colors'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => { api.getSettings().then(setSettings) }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    await api.saveSettings(settings)
    setSaving(false)
    setSavedAt(Date.now())
  }

  const set = (patch: Partial<AppSettings>) => {
    setSavedAt(null)
    setSettings(s => (s ? { ...s, ...patch } : s))
  }

  return (
    <div className="anim-rise max-w-2xl">
      <PageTitle lede="Test-repository and discovery configuration. Applied when the backend syncs the suites.">
        Settings
      </PageTitle>

      {!settings && <Skeleton className="h-96 mt-6" />}
      {settings && (
        <Card className="p-6 mt-6">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink2">Git repository URL</span>
              <input className={`${FIELD} mt-1`} value={settings.repoUrl}
                onChange={e => set({ repoUrl: e.target.value })}
                placeholder="https://github.com/your-org/test-suites.git" />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-ink2">Branch</span>
                <input className={`${FIELD} mt-1`} value={settings.branch}
                  onChange={e => set({ branch: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink2">Git timeout (seconds)</span>
                <input className={`${FIELD} mt-1`} type="number" min={5} max={600} value={settings.timeoutSeconds}
                  onChange={e => set({ timeoutSeconds: +e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-ink2">Local cache directory (on the runner machine)</span>
              <input className={`${FIELD} mt-1`} value={settings.cacheDir}
                onChange={e => set({ cacheDir: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink2">Hierarchy root folder</span>
              <input className={`${FIELD} mt-1`} value={settings.rootFolder}
                onChange={e => set({ rootFolder: e.target.value })}
                placeholder="test_suites (blank = repo root)" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink2">Hierarchy levels (comma-separated)</span>
              <input className={`${FIELD} mt-1`} value={settings.levels.join(', ')}
                onChange={e => set({ levels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="application, suite, release" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink2">Test file extensions (comma-separated)</span>
              <input className={`${FIELD} mt-1`} value={settings.extensions.join(', ')}
                onChange={e => set({ extensions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder=".py, .robot" />
            </label>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || settings.extensions.length === 0}
                className="bg-accent text-white font-semibold rounded-lg px-5 py-2.5 hover:brightness-110 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {savedAt && <span className="text-[12.5px] text-good-text font-semibold">✓ Saved</span>}
              {settings.extensions.length === 0 && (
                <span className="text-[12.5px] text-crit-text">At least one extension is required.</span>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
