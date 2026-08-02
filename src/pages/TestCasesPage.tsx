import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, type AppId, type LayerId, type TestStatus } from '../api'
import { useData } from '../lib/useData'
import { cx, fmt } from '../lib/format'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton, StatusChip } from '../components/ui'
import { SearchIcon } from '../components/icons'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }
const LAYER_NAMES: Record<string, string> = {
  unit: 'Unit Testing', integration: 'Integration Testing',
  system: 'System Testing', e2e: 'UI / End-to-End Testing',
}
const STATUS_FILTERS: Array<TestStatus | 'All'> = ['All', 'Failed', 'Passed', 'Running', 'Skipped']
const PAGE_SIZE = 50

export function TestCasesPage() {
  const { appId = '', layerId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const statusFilter = (params.get('status') as TestStatus | null) ?? 'All'
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { data: rows, loading } = useData(
    () => api.getTestCases(appId as AppId, layerId as LayerId),
    [appId, layerId],
  )

  const appName = APP_NAMES[appId] ?? appId
  const layerName = LAYER_NAMES[layerId] ?? layerId

  const filtered = useMemo(() => {
    let out = rows ?? []
    if (statusFilter !== 'All') out = out.filter(r => r.status === statusFilter)
    const q = query.trim().toLowerCase()
    if (q) out = out.filter(r => r.name.toLowerCase().includes(q) || r.suite.toLowerCase().includes(q))
    return out
  }, [rows, statusFilter, query])

  const shown = filtered.slice(0, limit)

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appName, to: `/apps/${appId}/pyramid` },
        { label: layerName, to: `/apps/${appId}/${layerId}` },
        { label: 'Test cases' },
      ]} />
      <PageTitle lede={`${appName} · ${layerName} — every discovered test case with its latest result.`}>
        Test cases
      </PageTitle>

      <div className="flex items-center gap-3 flex-wrap mt-6 mb-4">
        <label className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setLimit(PAGE_SIZE) }}
            placeholder="Search test name or suite…"
            className="bg-surface border border-grid rounded-lg pl-9 pr-3 py-2 w-64 outline-none focus:border-accent transition-colors"
          />
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => {
                setLimit(PAGE_SIZE)
                setParams(s === 'All' ? {} : { status: s }, { replace: true })
              }}
              className={cx(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                statusFilter === s
                  ? 'bg-accent text-white border-accent font-semibold'
                  : 'bg-surface border-hairline text-ink2 hover:border-accent hover:text-accent',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted ml-auto">
          {loading ? '…' : `${fmt(filtered.length)} of ${fmt(rows?.length ?? 0)} tests`}
        </span>
      </div>

      {loading && <Skeleton className="h-96" />}
      {!loading && filtered.length === 0 && (
        <EmptyState title="No matching test cases" hint="Try a different search or status filter." />
      )}
      {!loading && shown.length > 0 && (
        <Card className="p-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted">
                  {['Test case', 'Suite', 'Release', 'Duration', 'Last run', 'Status'].map(h => (
                    <th key={h} className="font-semibold px-3 py-2.5 border-b border-grid">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(row => (
                  <tr key={row.id} className="hover:bg-accent-soft/60 transition-colors">
                    <td className="px-3 py-2.5 border-b border-grid">
                      <Link to={`/apps/${appId}/${layerId}/tests/${row.id}`} className="font-semibold font-mono text-xs hover:text-accent">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 border-b border-grid text-ink2">{row.suite}</td>
                    <td className="px-3 py-2.5 border-b border-grid text-ink2 tabular-nums">{row.release}</td>
                    <td className="px-3 py-2.5 border-b border-grid text-muted text-xs tabular-nums">{row.durationS}s</td>
                    <td className="px-3 py-2.5 border-b border-grid text-muted text-xs whitespace-nowrap">{row.lastRun}</td>
                    <td className="px-3 py-2.5 border-b border-grid"><StatusChip status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <div className="p-3 text-center">
              <button
                onClick={() => setLimit(l => l + PAGE_SIZE)}
                className="text-[13px] font-semibold text-accent hover:underline"
              >
                Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
