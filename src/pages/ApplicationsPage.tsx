import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useData } from '../lib/useData'
import { fmt } from '../lib/format'
import { Card, PageTitle, Skeleton } from '../components/ui'
import { AppIconFor, ArrowRightIcon } from '../components/icons'

export function ApplicationsPage() {
  const navigate = useNavigate()
  const { data: apps, loading } = useData(() => api.getApplications(), [])

  return (
    <div className="anim-rise">
      <PageTitle lede="Select a product to explore its Testing Pyramid and quality dashboards.">
        Applications
      </PageTitle>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mt-7">
        {loading && [0, 1, 2].map(i => <Skeleton key={i} className="h-72" />)}
        {apps?.map(app => (
          <Card
            key={app.id}
            className="p-6 flex flex-col gap-3.5 text-left cursor-pointer transition-all duration-200
                       hover:-translate-y-0.5 hover:shadow-lift hover:border-accent group"
            onClick={() => navigate(`/apps/${app.id}/pyramid`)}
          >
            <span className="w-11 h-11 rounded-[11px] grid place-items-center bg-accent-soft text-accent">
              <AppIconFor icon={app.icon} />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">{app.name}</h2>
              <div className="text-xs text-muted mt-0.5">{app.tag}</div>
            </div>
            <p className="text-[13px] text-ink2 flex-1">{app.desc}</p>
            <div className="flex gap-5 border-t border-grid pt-3.5 text-xs text-muted">
              <div><b className="block text-base font-semibold text-ink">{fmt(app.totalTests)}</b>test cases</div>
              <div><b className="block text-base font-semibold text-ink">{app.passRate}%</b>pass rate</div>
              <div><b className="block text-base font-semibold text-ink">4</b>pyramid layers</div>
            </div>
            <span className="flex items-center gap-1.5 text-accent font-semibold text-[13px]">
              View Testing Pyramid
              <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        ))}
      </div>
    </div>
  )
}
