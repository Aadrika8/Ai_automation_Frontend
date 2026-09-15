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
      <PageTitle lede="Where the Excel workbooks are read from. Applied the next time a release is loaded from Excel.">
        Settings
      </PageTitle>

      {!settings && <Skeleton className="h-40 mt-6" />}
      {settings && (
        <Card className="p-6 mt-6">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink2">Excel root folder</span>
              <input className={`${FIELD} mt-1`} value={settings.excelRoot}
                onChange={e => set({ excelRoot: e.target.value })}
                placeholder="A:\\office excel files" />
              <span className="text-[11.5px] text-muted mt-1 block">
                Parent folder holding one sub-folder per application. Local paths and network
                shares (\\\\server\\share\\…) both work, as long as the server account can read them.
              </span>
            </label>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-accent text-white font-semibold rounded-lg px-5 py-2.5 hover:brightness-110 disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {savedAt && <span className="text-[12.5px] text-good-text font-semibold">✓ Saved</span>}
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
