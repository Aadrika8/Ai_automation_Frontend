import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type AppId, type LayerId } from '../api'
import { useData } from '../lib/useData'
import { cx, fmt } from '../lib/format'
import { Breadcrumbs, Card, PageTitle, Skeleton } from '../components/ui'
import { ChevronRightIcon } from '../components/icons'
import { PyramidSvg } from '../components/charts/PyramidSvg'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }

export function PyramidPage() {
  const { appId = '' } = useParams()
  const navigate = useNavigate()
  const [hotLayer, setHotLayer] = useState<LayerId | null>(null)
  const { data: layers, loading } = useData(() => api.getLayers(appId as AppId), [appId])

  const appName = APP_NAMES[appId] ?? appId
  const goto = (layerId: LayerId) => navigate(`/apps/${appId}/${layerId}`)

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[{ label: 'Applications', to: '/apps' }, { label: appName }]} />
      <PageTitle lede="Broad, fast coverage at the base; focused user-journey coverage at the top. Select a layer to open its dashboard.">
        {appName} — Testing Pyramid
      </PageTitle>

      <div className="grid lg:grid-cols-[minmax(320px,1.1fr)_1fr] gap-9 items-center mt-8">
        {loading && (
          <>
            <Skeleton className="h-80" />
            <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[74px]" />)}</div>
          </>
        )}
        {layers && (
          <>
            <PyramidSvg
              layers={layers}
              hotLayer={hotLayer}
              onHover={setHotLayer}
              onSelect={goto}
            />
            <div className="flex flex-col gap-3">
              {[...layers].reverse().map(layer => (
                <Card
                  key={layer.id}
                  className={cx(
                    'flex items-center gap-3.5 px-4.5 py-4 cursor-pointer transition-all duration-200',
                    hotLayer === layer.id
                      ? 'translate-x-1 shadow-lift border-accent'
                      : 'hover:translate-x-1 hover:shadow-lift hover:border-accent',
                  )}
                  onClick={() => goto(layer.id)}
                >
                  <div
                    onMouseEnter={() => setHotLayer(layer.id)}
                    onMouseLeave={() => setHotLayer(null)}
                    className="flex items-center gap-3.5 flex-1 min-w-0"
                  >
                    <i className="w-3 h-[34px] rounded shrink-0" style={{ background: `var(${layer.colorVar})` }} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14.5px] font-semibold tracking-tight">{layer.name}</h3>
                      <div className="text-xs text-muted">
                        {layer.desc} · ~{Math.round(layer.share * 100)}% of tests
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <b className="block text-base font-semibold tabular-nums">{fmt(layer.testCount)}</b>
                      <span className="text-[11.5px] text-muted">{layer.passRate}% pass</span>
                    </div>
                    <ChevronRightIcon className="text-muted shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
