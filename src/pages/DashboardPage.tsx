import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api, type AppId, type LayerId } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { dayLabel, fmt, hourLabel } from '../lib/format'
import { Breadcrumbs, Card, KpiTile, PageTitle, Segmented, Skeleton } from '../components/ui'
import { ArrowRightIcon } from '../components/icons'
import { TrendChart, type TrendPoint } from '../components/charts/TrendChart'
import { BarsChart, type BarPoint } from '../components/charts/BarsChart'
import { StatusDonut } from '../components/charts/StatusDonut'
import { RunsTable } from '../components/RunsTable'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }
const LAYER_NAMES: Record<LayerId, string> = {
  unit: 'Unit Testing', integration: 'Integration Testing',
  system: 'System Testing', e2e: 'UI / End-to-End Testing',
}
const LAYER_COLOR: Record<LayerId, string> = {
  unit: '--tier-unit', integration: '--tier-integration', system: '--tier-system', e2e: '--tier-e2e',
}

export function DashboardPage() {
  const { appId = '', layerId = '' } = useParams()
  const { hasRole } = useAuth()
  const [range, setRange] = useState<'24h' | '7d' | '30d' | '90d'>('30d')
  const { data, loading } = useData(
    () => api.getLayerDashboard(appId as AppId, layerId as LayerId),
    [appId, layerId],
  )

  const appName = APP_NAMES[appId] ?? appId
  const layerName = LAYER_NAMES[layerId as LayerId]

  const days = { '7d': 7, '30d': 30, '90d': 90 }[range as '7d' | '30d' | '90d'] ?? 0
  const trend = useMemo<TrendPoint[]>(() => {
    if (!data) return []
    if (range === '24h') return data.hourly.map(p => ({ label: hourLabel(p.hoursAgo), passRate: p.passRate }))
    return data.history.slice(-days).map(p => ({ label: dayLabel(p.daysAgo), passRate: p.passRate }))
  }, [data, range, days])
  const bars = useMemo<BarPoint[]>(() => {
    if (!data) return []
    if (range === '24h') return data.hourly.map(p => ({ label: hourLabel(p.hoursAgo), value: p.runs }))
    const slice = data.history.slice(-days)
    if (days <= 30) return slice.map(p => ({ label: dayLabel(p.daysAgo), value: p.runs }))
    const weekly: BarPoint[] = []
    for (let i = 0; i < slice.length; i += 7) {
      const week = slice.slice(i, i + 7)
      weekly.push({ label: dayLabel(week[0].daysAgo), value: week.reduce((t, p) => t + p.runs, 0) })
    }
    return weekly
  }, [data, range, days])
  const totalRuns = bars.reduce((t, b) => t + b.value, 0)

  if (!layerName) return <Navigate to={`/apps/${appId}/pyramid`} replace />

  const snap = data?.snapshot
  const delta = snap?.deltaVsLastWeek ?? 0

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appName, to: `/apps/${appId}/pyramid` },
        { label: layerName },
      ]} />

      <div className="flex items-start gap-3.5 flex-wrap mb-6">
        <div className="flex-1 min-w-60">
          <PageTitle lede={`${appName} · latest consolidated results across this layer.`}>{layerName}</PageTitle>
        </div>
        <div className="flex flex-col items-end gap-2">
          {hasRole('qa') && (
            <Link
              to={`/apps/${appId}/${layerId}/report`}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-accent text-white hover:opacity-90"
            >
              ✦ Generate Report
            </Link>
          )}
          <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-surface border border-hairline">
            <i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: `var(${LAYER_COLOR[layerId as LayerId]})` }} />
            {appName} · {layerName.split(' ')[0]}
          </span>
          {data && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full bg-surface border border-hairline">
              <span className="font-semibold">Test cases v{data.version.current}</span>
              <span className="text-muted">· updated {data.version.lastUpdated}</span>
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {snap && data && (
        <>
          {/* snapshot: KPIs + status distribution */}
          <div className="grid lg:grid-cols-[1fr_340px] gap-5 mb-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 content-start">
              <KpiTile label="Total test cases" value={snap.total} sub="in this layer" />
              <KpiTile
                label="Passed"
                value={snap.passed}
                sub={hasRole('qa')
                  ? <Link to={`/apps/${appId}/${layerId}/tests?status=Passed`} className="hover:text-accent">latest results</Link>
                  : 'latest results'}
              />
              <KpiTile
                label="Failed"
                value={snap.failed}
                sub={hasRole('qa')
                  ? <Link to={`/apps/${appId}/${layerId}/tests?status=Failed`} className="text-crit-text font-semibold hover:underline">{fmt(snap.failed - snap.knownBugs)} new · investigate →</Link>
                  : `${fmt(snap.failed - snap.knownBugs)} new failures`}
              />
              <KpiTile label="Known bugs" value={snap.knownBugs} sub="of failed, already tracked" />
              <KpiTile label="Running" value={snap.running} sub={<><span className="w-[7px] h-[7px] rounded-full bg-accent anim-pulse" />in progress now</>} />
              <Card className="px-4.5 py-4">
                <div className="text-xs text-ink2">Pass rate</div>
                <div className="text-[27px] font-semibold tracking-tight mt-0.5">{snap.passRate}%</div>
                <div className="text-[11.5px] text-muted mt-0.5">
                  <span className={delta >= 0 ? 'text-good-text font-semibold' : 'text-crit-text font-semibold'}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts
                  </span>{' '}
                  vs last week
                </div>
              </Card>
            </div>
            <Card className="p-5">
              <div className="mb-3">
                <div className="text-sm font-semibold tracking-tight">Status distribution</div>
                <div className="text-xs text-muted">All test cases, latest results</div>
              </div>
              <StatusDonut
                centerBig={`${snap.passRate}%`}
                centerSmall="pass rate"
                parts={[
                  { name: 'Passed', value: snap.passed, color: 'var(--good)' },
                  { name: 'Failed', value: snap.failed, color: 'var(--critical)' },
                  { name: 'Running', value: snap.running, color: 'var(--accent)' },
                  { name: 'Skipped', value: snap.skipped, color: 'var(--muted)' },
                ]}
              />
            </Card>
          </div>

          {/* range filter scopes everything below */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-[12.5px] text-muted">Last</span>
            <Segmented
              options={[
                { label: '24 hours', value: '24h' as const },
                { label: '7 days', value: '7d' as const },
                { label: '30 days', value: '30d' as const },
                { label: '90 days', value: '90d' as const },
              ]}
              value={range}
              onChange={setRange}
            />
          </div>

          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 mb-5">
            <Card className="p-5">
              <div className="mb-2">
                <div className="text-sm font-semibold tracking-tight">Pass-rate trend</div>
                <div className="text-xs text-muted">
                  {range === '24h' ? 'Hourly pass rate · last 24 hours' : `Daily pass rate · last ${days} days`}
                </div>
              </div>
              <TrendChart data={trend} />
            </Card>
            <Card className="p-5">
              <div className="mb-2">
                <div className="text-sm font-semibold tracking-tight">Test executions</div>
                <div className="text-xs text-muted">
                  {fmt(totalRuns)} runs · {range === '24h' ? 'per hour' : days <= 30 ? 'per day' : 'per week'}
                </div>
              </div>
              <BarsChart data={bars} unitName="test runs" />
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="flex-1">
                <div className="text-sm font-semibold tracking-tight">Recent executions</div>
                <div className="text-xs text-muted">Latest scheduled and triggered runs</div>
              </div>
              {hasRole('qa') && (
                <Link
                  to={`/apps/${appId}/${layerId}/tests`}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline"
                >
                  View test cases <ArrowRightIcon />
                </Link>
              )}
            </div>
            <RunsTable runs={data.recentRuns} />
          </Card>
        </>
      )}
    </div>
  )
}
