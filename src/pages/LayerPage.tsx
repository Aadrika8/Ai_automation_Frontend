import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, type ColumnDef, type LayerDashboardResponse, type LayerRecordsResponse } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { fmt, timeAgo } from '../lib/format'
import { layerColorVar } from '../lib/palette'
import { Breadcrumbs, Card, EmptyState, KpiTile, PageTitle, Segmented, Skeleton } from '../components/ui'
import { BarsChart } from '../components/charts/BarsChart'
import { StatusDonut } from '../components/charts/StatusDonut'
import { Modal } from '../components/Modal'
import { UploadDialog } from '../components/UploadDialog'
import { SearchIcon, TrashIcon, UploadIcon } from '../components/icons'

const PAGE_SIZE = 250

function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return typeof value === 'number' ? fmt(value) : value
}

function RecordsView({ records, loading, search, setSearch, page, setPage }: {
  records: LayerRecordsResponse | null
  loading: boolean
  search: string
  setSearch: (v: string) => void
  page: number
  setPage: (p: number) => void
}) {
  const pages = records ? Math.max(1, Math.ceil(records.total / records.pageSize)) : 1
  return (
    <div className="space-y-5">
      <label className="relative block max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search records…"
          className="w-full bg-surface border border-grid rounded-lg pl-9 pr-3 py-2 outline-none focus:border-accent transition-colors"
        />
      </label>
      {loading && <Skeleton className="h-64" />}
      {records && records.total === 0 && (
        <EmptyState title="No matching records" hint={search ? 'Try a different search term.' : undefined} />
      )}
      {records?.sections.map(section => (
        <Card key={section.name} className="overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pt-4 pb-3">
            <h3 className="font-semibold tracking-tight">{section.name}</h3>
            <span className="text-xs text-muted">{fmt(section.rowCount)} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  {records.columns.map(col => (
                    <th key={col.key} className={`px-5 py-2.5 font-semibold ${col.type === 'number' ? 'text-right' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i} className="border-b border-grid/60 last:border-0 hover:bg-accent-soft/40">
                    {records.columns.map(col => (
                      <td key={col.key}
                          className={`px-5 py-2 ${col.type === 'number' ? 'text-right tabular-nums font-medium' : 'text-ink2'}`}>
                        {cellText(row.data[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {records && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[12.5px]">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-grid disabled:opacity-40 hover:border-accent transition-colors">
            ← Previous
          </button>
          <span className="text-muted">Page {page} of {pages} · {fmt(records.total)} rows</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-grid disabled:opacity-40 hover:border-accent transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function DashboardView({ dash, loading, order }: {
  dash: LayerDashboardResponse | null
  loading: boolean
  order: number
}) {
  const primary: ColumnDef | undefined = dash?.numericColumns[dash.numericColumns.length - 1]
  if (loading || !dash) return <Skeleton className="h-80" />
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {primary && (
          <KpiTile label={`Total ${primary.label.toLowerCase()}`} value={dash.totals[primary.key] ?? 0} />
        )}
        <KpiTile label="Records" value={dash.totalRows} />
        <KpiTile label="Sections" value={dash.sectionCount} />
        <Card className="px-4.5 py-4">
          <div className="text-xs text-ink2">Last upload</div>
          <div className="text-[17px] font-semibold tracking-tight mt-1.5">
            {dash.lastUpload ? timeAgo(dash.lastUpload.uploadedAt) : '—'}
          </div>
          {dash.lastUpload && (
            <div className="text-[11.5px] text-muted mt-0.5">
              {dash.lastUpload.fileName} · by {dash.lastUpload.uploadedBy}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {primary && (
          <Card className="p-5">
            <h3 className="font-semibold tracking-tight mb-3">{primary.label} by section</h3>
            <BarsChart
              unitName={primary.label}
              data={dash.bySection.map(s => ({ label: s.section, value: s.sums[primary.key] ?? 0 }))}
            />
          </Card>
        )}
        <Card className="p-5">
          <h3 className="font-semibold tracking-tight mb-3">Records by section</h3>
          <StatusDonut
            centerBig={fmt(dash.totalRows)}
            centerSmall="records"
            parts={dash.bySection.map((s, i) => ({
              name: s.section, value: s.rowCount, color: `var(${layerColorVar(order + i)})`,
            }))}
          />
        </Card>
      </div>

      {dash.topRows.length > 0 && primary && (
        <Card className="overflow-hidden">
          <h3 className="font-semibold tracking-tight px-5 pt-4 pb-3">Largest test specs</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                  <th className="px-5 py-2.5 font-semibold">Spec</th>
                  <th className="px-5 py-2.5 font-semibold">Section</th>
                  <th className="px-5 py-2.5 font-semibold text-right">{primary.label}</th>
                </tr>
              </thead>
              <tbody>
                {dash.topRows.map((row, i) => (
                  <tr key={i} className="border-b border-grid/60 last:border-0">
                    <td className="px-5 py-2 font-medium">{row.label}</td>
                    <td className="px-5 py-2 text-ink2">{row.section}</td>
                    <td className="px-5 py-2 text-right tabular-nums font-semibold">{fmt(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <EmptyState
        title="Run results not connected yet"
        hint="Pass rates, failure trends and run history will appear here once test-run results are ingested alongside the spec counts."
      />
    </div>
  )
}

export function LayerPage() {
  const { appId = '', layerId = '' } = useParams()
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'data' ? 'data' : 'dashboard'

  const [reloadKey, setReloadKey] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearScope, setClearScope] = useState<'all' | 'last'>('last')
  const [clearBusy, setClearBusy] = useState(false)

  // debounce the search box before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: apps } = useData(() => api.getApplications(), [])
  const appName = apps?.find(a => a.id === appId)?.name ?? appId
  const { data: layers } = useData(() => api.getLayers(appId), [appId, reloadKey])
  const layer = layers?.find(l => l.id === layerId)

  const { data: records, loading: recordsLoading, error } = useData(
    () => api.getLayerRecords(appId, layerId, { search: search || undefined, page, pageSize: PAGE_SIZE }),
    [appId, layerId, search, page, reloadKey],
  )
  const { data: dash, loading: dashLoading } = useData(
    () => api.getLayerDashboard(appId, layerId),
    [appId, layerId, reloadKey],
  )

  const hasData = useMemo(
    () => (records ? records.total > 0 || search !== '' : false),
    [records, search],
  )
  const reload = () => setReloadKey(k => k + 1)

  async function clearData() {
    setClearBusy(true)
    try {
      await api.clearLayerRecords(appId, layerId, clearScope)
      setConfirmClear(false)
      reload()
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <div className="anim-rise">
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appName, to: `/apps/${appId}` },
        { label: layer?.name ?? layerId },
      ]} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <i className="w-2.5 h-10 rounded-full"
             style={{ background: `var(${layerColorVar(layer?.order ?? 0)})` }} />
          <PageTitle lede={layer?.desc}>{layer?.name ?? layerId}</PageTitle>
        </div>
        <div className="flex items-center gap-2.5">
          {hasRole('qa') && (
            <button onClick={() => setUploading(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 transition">
              <UploadIcon size={13} /> Upload Excel
            </button>
          )}
          {hasRole('admin') && hasData && (
            <button onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3.5 py-2 border border-grid text-crit-text hover:border-critical transition-colors">
              <TrashIcon size={13} /> Delete uploaded data
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 mb-6">
        <Segmented
          options={[{ label: 'Dashboard', value: 'dashboard' }, { label: 'Data', value: 'data' }]}
          value={view}
          onChange={v => setParams(v === 'dashboard' ? {} : { view: v }, { replace: true })}
        />
      </div>

      {error && <EmptyState title="Could not load this layer" hint={error} />}
      {!error && records && !hasData ? (
        <EmptyState
          title="No data uploaded yet"
          hint={hasRole('qa')
            ? 'Upload the Excel sheet from your test team to populate this layer.'
            : 'A QA engineer or admin needs to upload this layer’s Excel sheet.'}
        />
      ) : !error && (
        view === 'data'
          ? <RecordsView records={records} loading={recordsLoading} search={searchInput}
                         setSearch={setSearchInput} page={page} setPage={setPage} />
          : <DashboardView dash={dash} loading={dashLoading} order={layer?.order ?? 0} />
      )}

      {uploading && (
        <UploadDialog appId={appId} layerId={layerId} layerName={layer?.name ?? layerId}
                      hasData={(layer?.recordCount ?? 0) > 0}
                      onClose={() => setUploading(false)} onUploaded={reload} />
      )}
      {confirmClear && (
        <Modal title="Delete uploaded data?" onClose={() => setConfirmClear(false)}>
          <div className="space-y-1.5">
            {([
              {
                value: 'last' as const,
                label: 'Delete last upload only',
                desc: records?.lastUpload
                  ? `Removes the rows added or last updated by ${records.lastUpload.fileName}. Earlier data stays.`
                  : 'Removes the rows from the most recent upload. Earlier data stays.',
              },
              {
                value: 'all' as const,
                label: 'Delete all data',
                desc: `Removes all ${fmt(layer?.recordCount ?? 0)} ingested rows and the full upload history for this layer.`,
              },
            ]).map(o => (
              <label key={o.value}
                     className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors
                                 ${clearScope === o.value ? 'border-critical bg-critical/5' : 'border-grid hover:border-critical'}`}>
                <input type="radio" name="clear-scope" checked={clearScope === o.value}
                       onChange={() => setClearScope(o.value)} className="mt-0.5 accent-(--critical)" />
                <span>
                  <span className="block text-[13px] font-semibold">{o.label}</span>
                  <span className="block text-[11.5px] text-muted">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11.5px] text-muted mt-3">
            The layer itself stays and new Excel sheets can be uploaded again afterwards.
            This cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={clearData} disabled={clearBusy}
                    className="flex-1 bg-critical text-white font-semibold rounded-lg py-2.5 hover:brightness-110 disabled:opacity-50 transition">
              {clearBusy ? 'Deleting…' : clearScope === 'last' ? 'Delete last upload' : 'Delete all data'}
            </button>
            <button onClick={() => setConfirmClear(false)}
                    className="px-4 rounded-lg border border-grid text-ink2 hover:border-accent hover:text-accent transition-colors">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
