import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useData } from '../lib/useData'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton, StatusChip } from '../components/ui'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }
const LAYER_NAMES: Record<string, string> = {
  unit: 'Unit Testing', integration: 'Integration Testing',
  system: 'System Testing', e2e: 'UI / End-to-End Testing',
}

export function TestDetailPage() {
  const { appId = '', layerId = '', testId = '' } = useParams()
  const { data: test, loading, error } = useData(() => api.getTestDetail(testId), [testId])

  const appName = APP_NAMES[appId] ?? appId
  const layerName = LAYER_NAMES[layerId] ?? layerId

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appName, to: `/apps/${appId}/pyramid` },
        { label: layerName, to: `/apps/${appId}/${layerId}` },
        { label: 'Test cases', to: `/apps/${appId}/${layerId}/tests` },
        { label: test?.name ?? '…' },
      ]} />

      {loading && <Skeleton className="h-96" />}
      {error && <EmptyState title="Test case not found" hint={error} />}

      {test && (
        <>
          <div className="flex items-start gap-3.5 flex-wrap mb-6">
            <div className="flex-1 min-w-60">
              <PageTitle>{test.name}</PageTitle>
              <p className="text-muted text-xs font-mono mt-1">{test.path}</p>
            </div>
            <StatusChip status={test.status} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
            <Card className="px-4.5 py-4">
              <div className="text-xs text-ink2">Suite / Release</div>
              <div className="text-lg font-semibold tracking-tight mt-0.5">{test.suite} · {test.release}</div>
            </Card>
            <Card className="px-4.5 py-4">
              <div className="text-xs text-ink2">Last duration</div>
              <div className="text-lg font-semibold tracking-tight mt-0.5">{test.durationS}s</div>
            </Card>
            <Card className="px-4.5 py-4">
              <div className="text-xs text-ink2">Last run</div>
              <div className="text-lg font-semibold tracking-tight mt-0.5">{test.lastRun}</div>
            </Card>
          </div>

          {test.failure && (
            <Card className="p-5 mb-5 border-l-4 border-l-critical">
              <div className="text-sm font-semibold tracking-tight mb-1 text-crit-text">Failure details</div>
              <div className="text-[13px] mb-3">{test.failure.errorMessage}</div>
              <div className="text-xs text-muted mb-1">Failing step</div>
              <div className="text-[13px] font-medium mb-4">{test.failure.failingStep}</div>
              <div className="text-xs text-muted mb-1.5">Stack trace</div>
              <pre className="bg-page border border-grid rounded-lg p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
                {test.failure.stackTrace}
              </pre>
            </Card>
          )}

          <Card className="p-5">
            <div className="text-sm font-semibold tracking-tight mb-3">Run history</div>
            <div className="space-y-0">
              {test.history.map((h, i) => (
                <div key={i} className="flex items-center gap-4 py-2.5 border-b border-grid last:border-b-0 text-[13px]">
                  <span className="text-muted text-xs w-24 shrink-0">{h.when}</span>
                  <StatusChip status={h.status} />
                  <span className="text-muted text-xs ml-auto tabular-nums">{h.durationS}s</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
