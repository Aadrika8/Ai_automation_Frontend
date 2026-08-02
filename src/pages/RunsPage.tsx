import { useMemo, useState } from 'react'
import { api, type AppId } from '../api'
import { useData } from '../lib/useData'
import { cx } from '../lib/format'
import { Card, PageTitle, Skeleton } from '../components/ui'
import { RunsTable } from '../components/RunsTable'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }
const LAYER_SHORT: Record<string, string> = { unit: 'Unit', integration: 'Integration', system: 'System', e2e: 'UI / E2E' }
const APP_FILTERS: Array<AppId | 'All'> = ['All', 'hrms', 'cellsens', 'preciv']

export function RunsPage() {
  const [appFilter, setAppFilter] = useState<AppId | 'All'>('All')
  const { data: runs, loading } = useData(() => api.getRuns(), [])

  const filtered = useMemo(
    () => (runs ?? []).filter(r => appFilter === 'All' || r.appId === appFilter),
    [runs, appFilter],
  )

  return (
    <div className="anim-rise">
      <PageTitle lede="All recent executions across applications and pyramid layers.">Runs</PageTitle>

      <div className="flex gap-1.5 flex-wrap mt-6 mb-4">
        {APP_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setAppFilter(f)}
            className={cx(
              'text-xs px-3 py-1.5 rounded-full border transition-colors',
              appFilter === f
                ? 'bg-accent text-white border-accent font-semibold'
                : 'bg-surface border-hairline text-ink2 hover:border-accent hover:text-accent',
            )}
          >
            {f === 'All' ? 'All applications' : APP_NAMES[f]}
          </button>
        ))}
      </div>

      {loading && <Skeleton className="h-96" />}
      {!loading && (
        <Card className="p-2">
          <RunsTable
            runs={filtered}
            context={run => `${APP_NAMES[run.appId]} · ${LAYER_SHORT[run.layerId]}`}
          />
        </Card>
      )}
    </div>
  )
}
