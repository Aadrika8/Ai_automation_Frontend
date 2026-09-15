/* The release QA report, written by OpenAI from this release's own figures.

   The page shows the last report saved for the release. Generating one is a
   paid call, so it is QA's to make; anyone can read it. The model only writes
   the prose — every figure comes from the dashboards. Anything the draft left
   out is added from the data and tagged as such, and a number the report uses
   that the release's data does not hold is called out above it. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api, type ReportPoint, type ReportResponse, type ReportRisk, type SavedReport,
} from '../api'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../lib/useData'
import { useReleases, withRelease } from '../lib/useRelease'
import { cx } from '../lib/format'
import { REPORT_SECTIONS, buildReportPdf, reportFileName } from '../lib/reportPdf'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { ReleaseSwitcher } from '../components/ReleaseSwitcher'
import { AlertTriangleIcon, RefreshIcon } from '../components/icons'
import evidentLogo from '../assets/evident-logo.png'

const SEVERITY: Record<ReportRisk['severity'], string> = {
  high: 'bg-critical/10 text-crit-text',
  medium: 'bg-warning/15 text-warn-text',
  low: 'bg-muted/15 text-muted',
}

type Point = ReportPoint & { severity?: ReportRisk['severity'] }

const TOOL = 'flex items-center gap-1.5 text-[13px] font-semibold rounded-lg px-3 py-2 border border-grid text-ink2 hover:border-accent hover:text-accent disabled:opacity-60 transition-colors'

/** Where a point came from, as a label and the page that shows it. */
function sourceLink(appId: string, releaseId: string, source: string,
                    names: Record<string, string>): { label: string; to: string } {
  if (source === 'traceability') {
    return { label: 'Traceability', to: withRelease(`/apps/${appId}/traceability`, releaseId) }
  }
  if (source === 'automation') {
    return { label: 'Automation', to: withRelease(`/apps/${appId}/benchmark`, releaseId) }
  }
  if (source === 'pyramid') {
    return { label: 'Pyramid', to: withRelease(`/apps/${appId}`, releaseId) }
  }
  const id = source.replace(/^layer:/, '')
  return { label: names[id] ?? id, to: withRelease(`/apps/${appId}/layers/${id}`, releaseId) }
}

function footerLine(saved: SavedReport): string {
  return `Written from ${saved.releaseName}${saved.period ? ` · ${saved.period}` : ''} data · `
    + `${new Date(saved.createdAt).toLocaleString()} · by ${saved.createdBy} · ${saved.model}`
}

/** The report as Markdown, for pasting into an email or a chat. */
function toMarkdown(saved: SavedReport): string {
  const r = saved.report
  const lines = [`# QA report — ${saved.releaseName}${saved.period ? ` (${saved.period})` : ''}`,
                 '', r.summary, '']
  for (const { key, title } of REPORT_SECTIONS) {
    const items: Point[] = r[key]
    if (!items.length) continue
    lines.push(`## ${title}`, '')
    items.forEach((item, i) => lines.push(
      `${key === 'recommendations' ? `${i + 1}.` : '-'} `
      + `${item.severity ? `**${item.severity.toUpperCase()}** ` : ''}${item.text}`
      + `${item.added ? ' _(from the data)_' : ''}`))
    lines.push('')
  }
  lines.push(`_${footerLine(saved)}. Figures come from this release's dashboards._`)
  return lines.join('\n')
}

function ExportButtons({ saved }: { saved: SavedReport }) {
  const [copied, setCopied] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  async function copy() {
    await navigator.clipboard.writeText(toMarkdown(saved))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  /* Built in the browser and saved straight to the downloads folder. jsPDF
     and the logo are fetched only here, so the page itself stays light. */
  async function downloadPdf() {
    setPreparing(true)
    setFailed(null)
    try {
      const [{ jsPDF }, logo] = await Promise.all([
        import('jspdf'),
        fetch(evidentLogo).then(res => res.arrayBuffer()).then(buf => new Uint8Array(buf)),
      ])
      buildReportPdf(jsPDF, saved, logo).save(reportFileName(saved))
    } catch (e) {
      setFailed(`Could not build the PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPreparing(false)
    }
  }

  return (
    <>
      <button onClick={copy} className={TOOL}>{copied ? 'Copied' : 'Copy'}</button>
      <button onClick={downloadPdf} disabled={preparing} className={TOOL}>
        {preparing ? 'Preparing…' : 'Download PDF'}
      </button>
      {failed && <span className="text-[12px] text-crit-text">{failed}</span>}
    </>
  )
}

/* --- the report --------------------------------------------------------------- */

function Section({ title, items, ordered = false, appId, releaseId, names }: {
  title: string
  items: Point[]
  ordered?: boolean
  appId: string
  releaseId: string
  names: Record<string, string>
}) {
  if (!items.length) return null
  const List = ordered ? 'ol' : 'ul'
  return (
    <section>
      <h2 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted mb-2.5">{title}</h2>
      <List className={cx('space-y-2.5 pl-5 marker:text-muted', ordered ? 'list-decimal' : 'list-disc')}>
        {items.map((item, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-ink pl-1">
            {item.severity && (
              <span className={cx('mr-2 inline-block rounded-full px-2 py-px text-[10.5px] font-semibold uppercase tracking-wide align-middle',
                                  SEVERITY[item.severity])}>
                {item.severity}
              </span>
            )}
            {item.text}
            {item.added && (
              <span className="ml-2 inline-block rounded-full bg-muted/15 px-1.5 py-px text-[10.5px] font-medium text-muted align-middle"
                    title="The draft left this out; the app added it from the release's figures.">
                from the data
              </span>
            )}
            {item.sources.length > 0 && (
              <span className="ml-2 inline-flex flex-wrap gap-x-2 align-middle">
                {item.sources.map(source => {
                  const link = sourceLink(appId, releaseId, source, names)
                  return (
                    <Link key={source} to={link.to} className="text-[11px] text-accent hover:underline">
                      {link.label} ↗
                    </Link>
                  )
                })}
              </span>
            )}
          </li>
        ))}
      </List>
    </section>
  )
}

function ReportView({ saved, stale, appId, releaseId }: {
  saved: SavedReport
  stale: boolean
  appId: string
  releaseId: string
}) {
  const r = saved.report
  const shared = { appId, releaseId, names: saved.layerNames }
  const added = saved.addedFromData ?? []

  // No "left out" list is shown: anything the draft missed is filled in from
  // the data and tagged below, and reports saved before that fill-in simply
  // go without it rather than carrying a warning.
  return (
    <div className="space-y-4 max-w-4xl">
      {stale && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/45 bg-warning/12 px-3.5 py-2.5 text-[12.5px] text-ink2">
          <span className="text-warning mt-px shrink-0"><AlertTriangleIcon /></span>
          <span>This release's data has changed since the report was written. Regenerate it to include the latest loads.</span>
        </div>
      )}
      {saved.unverified.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg bg-critical/10 px-3.5 py-2.5 text-[12.5px] text-ink2">
          <span className="text-crit-text mt-px shrink-0"><AlertTriangleIcon /></span>
          <span>
            <b className="text-crit-text font-semibold">Check before sharing — </b>
            the report mentions {saved.unverified.join(', ')}, which {saved.unverified.length === 1 ? 'does' : 'do'} not
            appear in this release's figures.
          </span>
        </div>
      )}
      {added.length > 0 && (
        <p className="text-[12px] text-muted">
          {added.length === 1 ? 'One point' : `${added.length} points`} marked “from the data” {added.length === 1 ? 'was' : 'were'} added
          from this release's figures, because the draft left {added.length === 1 ? 'it' : 'them'} out.
        </p>
      )}

      <Card className="p-6 space-y-6">
        <section>
          <h2 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted mb-2">Summary</h2>
          <p className="text-[14px] leading-relaxed text-ink">{r.summary}</p>
        </section>
        {REPORT_SECTIONS.map(({ key, title }) => (
          <Section key={key} title={title} items={r[key]}
                   ordered={key === 'recommendations'} {...shared} />
        ))}
        <footer className="pt-4 border-t border-grid text-[11.5px] text-muted">
          {footerLine(saved)}
        </footer>
      </Card>
    </div>
  )
}

export function ReportPage() {
  const { appId = '' } = useParams()
  const { hasRole } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { releases, active, activeId, select } = useReleases(appId, reloadKey)

  const { data, loading, error } = useData<ReportResponse | null>(
    () => (activeId ? api.getReport(appId, activeId) : Promise.resolve(null)),
    [appId, activeId, reloadKey],
  )

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  async function generate() {
    if (!activeId) return
    setBusy(true)
    setFailed(null)
    try {
      await api.generateReport(appId, activeId)
      setReloadKey(k => k + 1)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saved = data?.report ?? null
  const canGenerate = hasRole('qa') && !!data?.configured

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appId, to: withRelease(`/apps/${appId}`, activeId) },
        { label: 'QA report' },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <PageTitle lede="A short written summary of this release's quality — key findings, gaps, risks and recommendations — drafted by OpenAI from the figures on this release's dashboards.">
          QA report
        </PageTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ReleaseSwitcher
            appId={appId}
            releases={releases}
            active={active}
            onSelect={select}
            onChanged={() => setReloadKey(k => k + 1)}
          />
          {saved && !busy && <ExportButtons saved={saved} />}
          {canGenerate && (
            <button onClick={generate} disabled={busy}
                    className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white rounded-lg px-3.5 py-2 hover:brightness-110 disabled:opacity-60 transition">
              <RefreshIcon size={13} className={cx(busy && 'animate-spin')} />
              {busy ? 'Writing…' : saved ? 'Regenerate' : 'Generate report'}
            </button>
          )}
        </div>
      </div>

      {loading && !data && <Skeleton className="h-96" />}
      {error && <EmptyState title="Could not load the report" hint={error} />}
      {failed && (
        <p className="mb-4 max-w-4xl text-[12.5px] text-crit-text bg-critical/10 rounded-lg px-3 py-2">{failed}</p>
      )}
      {busy && (
        <Card className="p-5 mb-4 max-w-4xl text-[13px] text-ink2">
          Writing the report from this release's figures… this usually takes 10–30 seconds.
        </Card>
      )}

      {data && !data.configured && !saved && (
        <EmptyState
          title="Report generation isn't set up"
          hint="An admin needs to add OPENAI_API_KEY to the backend's .env file and restart the backend."
        />
      )}
      {data && data.configured && !saved && !busy && (
        <EmptyState
          title="No report for this release yet"
          hint={hasRole('qa')
            ? 'Generate one with the button above. It takes 10–30 seconds and is saved for everyone.'
            : 'Ask someone in QA to generate one.'}
        />
      )}
      {saved && activeId && (
        <ReportView saved={saved} stale={!!data?.stale} appId={appId} releaseId={activeId} />
      )}
    </>
  )
}
