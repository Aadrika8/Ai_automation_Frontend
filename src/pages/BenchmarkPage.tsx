/* Automation coverage, beside the published industry reference.

   The two are shown side by side and never blended into a single score. That
   is not a stylistic choice: they are different kinds of quantity. Evident's
   figure is an exact count of test cases out of the workbooks; the reference is
   a spread of self-reported survey estimates from three vendor-published
   studies. A distance between them is orientation, not a grade — which is why
   it reads in whole points and wears no pass/fail colour.

   Evident is drawn filled and in the accent; the reference is drawn hatched and
   outlined in a neutral. Fill against outline separates them harder than two
   hues would, and says which is measured and which is merely referenced. */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  api, type AutomationCoverageResponse, type AutomationLayer,
  type AutomationTrendResponse,
} from '../api'
import { useData } from '../lib/useData'
import { useReleases, withRelease } from '../lib/useRelease'
import { monthLabel } from '../lib/period'
import { cx, fmt } from '../lib/format'
import { Breadcrumbs, Card, EmptyState, PageTitle, Skeleton } from '../components/ui'
import { ReleaseSwitcher } from '../components/ReleaseSwitcher'
import { ReleaseTrend } from '../components/charts/ReleaseTrend'
import { AlertTriangleIcon } from '../components/icons'

/* The rail runs the full 0–100% of the metric, so a reference sitting in the
   lower third looks like the lower third. Geometry in viewBox units. */
const X0 = 50
const X1 = 730
const pos = (v: number) => X0 + (Math.max(0, Math.min(100, v)) / 100) * (X1 - X0)

function Rail({ value, low, high, marks }: {
  value: number | null
  low: number
  high: number
  marks: number[]
}) {
  const bandL = pos(low)
  const bandR = pos(high)
  const at = value === null ? null : pos(value)
  // the gap is drawn to the nearer edge of the range, not to its middle
  const gapFrom = at === null ? null : (value! < low ? at : bandR)
  const gapTo = at === null ? null : (value! < low ? bandL : at)
  const showGap = at !== null && (value! < low || value! > high)

  return (
    <svg viewBox="0 0 760 172" className="block w-full h-auto"
         role="img"
         aria-label={value === null
           ? `Not measured. Reference range ${low} to ${high} percent.`
           : `Evident at ${value} percent; reference range ${low} to ${high} percent.`}>
      <defs>
        <pattern id="ref-hatch" width="6" height="6" patternUnits="userSpaceOnUse"
                 patternTransform="rotate(135)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink2)" strokeWidth="2.2"
                opacity="0.34" />
        </pattern>
      </defs>

      {at !== null && value !== null && (
        <>
          <text x={at} y="26" textAnchor="middle" fontSize="12.5" fontWeight="600"
                fill="var(--accent)" fontFamily="ui-monospace, monospace">
            Evident {value.toFixed(1)}%
          </text>
          <rect x={at - 5} y="34" width="10" height="30" rx="3" fill="var(--accent)" />
        </>
      )}

      {showGap && gapFrom !== null && gapTo !== null && (
        <g>
          <line x1={gapFrom} y1="79" x2={gapTo} y2="79" stroke="var(--muted)"
                strokeWidth="1.2" strokeDasharray="3 3" />
          <line x1={gapFrom} y1="74" x2={gapFrom} y2="84" stroke="var(--muted)" strokeWidth="1.2" />
          <line x1={gapTo} y1="74" x2={gapTo} y2="84" stroke="var(--muted)" strokeWidth="1.2" />
        </g>
      )}

      <rect x={bandL} y="92" width={bandR - bandL} height="24" rx="4"
            fill="url(#ref-hatch)" stroke="var(--ink2)" strokeWidth="1.6" />
      <text x={bandR + 12} y="108" fontSize="12" fill="var(--ink2)"
            fontFamily="ui-monospace, monospace">
        surveyed range {low}–{high}%
      </text>

      {/* the studies the range is made of — stubs below the band, so the two
          edge observations stay visible against its own outline */}
      <g stroke="var(--ink2)" strokeWidth="2">
        {marks.map(m => <line key={m} x1={pos(m)} y1="116" x2={pos(m)} y2="125" />)}
      </g>
      <g fontSize="10.5" fill="var(--ink2)" textAnchor="middle"
         fontFamily="ui-monospace, monospace">
        {marks.map(m => <text key={m} x={pos(m)} y="137">{m}</text>)}
      </g>

      <line x1={X0} y1="148" x2={X1} y2="148" stroke="var(--axis)" strokeWidth="1" />
      <g fontSize="11" fill="var(--muted)" textAnchor="middle"
         fontFamily="ui-monospace, monospace">
        {[0, 25, 50, 75, 100].map(t => (
          <text key={t} x={pos(t)} y="164">{t}%</text>
        ))}
      </g>
    </svg>
  )
}

function distanceLabel(position: string, points: number | null): string {
  if (position === 'unmeasured') return 'not measured'
  if (position === 'within') return 'within the surveyed range'
  const side = position === 'below' ? 'below' : 'above'
  return `about ${points} point${points === 1 ? '' : 's'} ${side} the surveyed range`
}

function LayerRow({ layer }: { layer: AutomationLayer }) {
  return (
    <tr className="border-b border-grid/60 last:border-0 align-middle">
      <td className="px-4 py-2.5">
        <div className="font-semibold">{layer.name}</div>
        {layer.measured
          ? <div className="text-[11px] text-muted tabular-nums">
              {fmt(layer.automated)} / {fmt(layer.total)} · {layer.basisLabel}
            </div>
          : <div className="text-[11px] text-muted">{layer.reason}</div>}
      </td>
      <td className="px-4 py-2.5 w-[38%] min-w-[140px]">
        {layer.measured ? (
          <div className="relative h-4 rounded bg-grid/70 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-accent rounded"
                 style={{ width: `${layer.coveragePct ?? 0}%` }} />
          </div>
        ) : (
          <span className="text-[11.5px] text-muted">no automated count</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
        {layer.coveragePct === null
          ? <span className="text-muted">—</span>
          : `${layer.coveragePct.toFixed(1)}%`}
      </td>
    </tr>
  )
}

export function BenchmarkPage() {
  const { appId = '' } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const { releases, active, activeId, select } = useReleases(appId, reloadKey)

  const { data, loading, error } = useData<AutomationCoverageResponse | null>(
    () => (activeId ? api.getAutomationCoverage(appId, activeId) : Promise.resolve(null)),
    [appId, activeId, reloadKey],
  )

  const trend = useData<AutomationTrendResponse | null>(
    () => api.getAutomationTrend(appId), [appId, reloadKey])

  const marks = useMemo(
    () => (data?.reference.sources ?? []).map(s => s.value).sort((a, b) => a - b),
    [data],
  )

  const evident = data?.evident
  const reference = data?.reference

  /* The change carried by the most recent release that could be measured. */
  const newest = [...(trend.data?.points ?? [])].reverse()
    .find(p => p.measured && p.deltaPct !== null)
  const latestDelta = newest?.deltaPct ?? null
  const comparedTo = newest?.comparedTo ?? ''

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Applications', to: '/apps' },
        { label: appId, to: withRelease(`/apps/${appId}`, activeId) },
        { label: 'Benchmark' },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <PageTitle lede="Evident's measured automation coverage and the published industry reference, side by side. The two are never merged into one score, and the distance between them is stated as a plain difference — not a grade.">
          Automation coverage
        </PageTitle>
        <ReleaseSwitcher
          appId={appId} releases={releases} active={active}
          onSelect={select} onChanged={() => setReloadKey(k => k + 1)}
        />
      </div>

      {loading && <Skeleton className="h-96" />}
      {error && <EmptyState title="Could not load the benchmark" hint={error} />}

      {!loading && data && evident && reference && (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-1 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2 className="text-[17px] font-semibold tracking-tight flex-1">
                Overall, count-weighted
              </h2>
              <span className="text-[11px] font-mono text-ink2 bg-page border border-grid rounded-md px-2 py-1">
                reference scope · {reference.scope}
              </span>
            </div>

            <div className="px-6 pt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {evident.measured ? (
                <span className="text-[46px] font-semibold tracking-tight leading-none tabular-nums text-accent">
                  {evident.coveragePct?.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[22px] font-medium text-muted">Not measured</span>
              )}
              <span className="text-[12px] font-mono text-ink2 bg-page border border-grid rounded-md px-2.5 py-1.5">
                {distanceLabel(data.distance.position, data.distance.points)}
              </span>
            </div>

            <p className="px-6 pt-1.5 text-[12.5px] text-muted tabular-nums">
              {evident.measured
                ? <>{fmt(evident.automated)} / {fmt(evident.total)} test cases automated
                    {evident.basis === 'row_count' && ' · counted by rows, not test counts'}
                    {evident.basis === 'mixed' && ' · mixed basis across layers'}</>
                : 'No workbook in this release carries an automated-test count.'}
            </p>

            <div className="px-3 pt-3">
              <Rail
                value={evident.measured ? evident.coveragePct : null}
                low={reference.low} high={reference.high} marks={marks}
              />
            </div>

            <div className="px-6 pb-5 pt-1 flex flex-wrap gap-2">
              {reference.sources.map(s => (
                <span key={s.label}
                      className="flex items-baseline gap-2 border border-grid rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink2">
                  <b className="font-mono text-ink2">{s.value}%</b>
                  {s.label}
                  <span className="text-[11.5px] text-muted">
                    {s.publisher}{s.sample && ` · ${s.sample}`}
                  </span>
                </span>
              ))}
              <span className="flex items-center border border-dashed border-grid rounded-lg px-2.5 py-1.5 text-[11.5px] text-muted">
                all vendor-published · self-reported estimates
              </span>
            </div>

            <div className="border-t border-grid bg-page px-6 py-4 space-y-2">
              <div className="text-[10.5px] font-mono uppercase tracking-widest text-muted">
                About this reference
              </div>
              {reference.caveats.map(c => (
                <p key={c} className="text-[12.5px] text-ink2 flex gap-2">
                  <span className="text-muted">·</span>{c}
                </p>
              ))}
            </div>
          </Card>

          {/* Release history: the comparison that actually holds, since both
              sides of it are measured the same way. */}
          {trend.data && trend.data.points.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 pt-4 pb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-[15px] font-semibold tracking-tight flex-1">
                  Across releases
                </h2>
                {latestDelta !== null && (
                  <span className="text-[12px] font-mono text-ink2 bg-page border border-grid rounded-md px-2 py-1 tabular-nums">
                    {latestDelta > 0 ? '+' : ''}{latestDelta} pts since {comparedTo}
                  </span>
                )}
              </div>
              <p className="px-5 pb-2 text-[12.5px] text-ink2">
                Release against release is measured against measured — same sheets, same
                counting rules. This is the comparison that holds; the range behind it is
                context only.
              </p>
              <div className="px-2 pb-3">
                <ReleaseTrend
                  points={trend.data.points}
                  low={trend.data.reference.low}
                  high={trend.data.reference.high}
                />
              </div>
              {trend.data.measuredReleases < 2 && (
                <p className="px-5 pb-4 text-[12px] text-muted">
                  {trend.data.measuredReleases === 0
                    ? 'No release carries an automated-test count yet, so there is no history to compare.'
                    : 'Only one release carries an automated count — a trend needs a second one.'}
                </p>
              )}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[15px] font-semibold tracking-tight">By testing layer</h2>
              <p className="text-[12.5px] text-ink2 mt-1">
                Evident's own coverage per layer. No industry reference is shown here —
                no published per-layer automation figure exists for any testing type.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-y border-grid">
                    <th className="px-4 py-2.5 font-semibold">Testing layer</th>
                    <th className="px-4 py-2.5 font-semibold">Coverage</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {evident.layers.map(l => <LayerRow key={l.layerId} layer={l} />)}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-start gap-2.5 rounded-lg border border-grid bg-surface px-4 py-3">
            <span className="text-muted mt-px shrink-0"><AlertTriangleIcon /></span>
            <p className="text-[12.5px] text-ink2">
              <b>The two sides are not measured the same way.</b> The reference is a spread of
              self-reported survey estimates; Evident's figure is an exact count. Read the
              distance as orientation, never as a precise gap — and treat this release's own
              history as the stronger comparison once a second release carries automated counts.
            </p>
          </div>

          <p className={cx('text-[11.5px] text-muted', !data.latestPeriod && 'hidden')}>
            Read from {data.releaseName}
            {data.latestPeriod && <> · {monthLabel(data.latestPeriod)}</>}
            {evident.unmeasuredLayers.length > 0 &&
              <> · {evident.unmeasuredLayers.length} layer
                {evident.unmeasuredLayers.length === 1 ? '' : 's'} excluded for want of an
                automated count</>}
          </p>
        </div>
      )}
    </>
  )
}
