/* Automation coverage across releases, with the industry range behind it.

   This is the comparison worth reading. Release against release is measured
   against measured — the same sheets, the same counting rules — so a line that
   climbed four points says something exact. The reference band sits behind it
   as context only, drawn hatched and outlined so it can never be mistaken for
   a measured series, and nothing is scored against it.

   Releases are ordinal, not a timeline: they are spaced evenly and labelled by
   name, because the gap between v4.3 and v4.4 carries no duration a reader
   should infer. */
import { useState } from 'react'
import type { AutomationTrendPoint } from '../../api'

const W = 760
const H = 260
const PAD = { top: 24, right: 22, bottom: 46, left: 46 }

export function ReleaseTrend({ points, low, high }: {
  points: AutomationTrendPoint[]
  low: number
  high: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  const measured = points.filter(p => p.measured && p.coveragePct !== null)
  const peak = Math.max(high, ...measured.map(p => p.coveragePct ?? 0))
  // a share always reads from zero; the top is rounded up so the band and the
  // highest point both sit inside the frame with room for their labels
  const yMax = Math.min(100, Math.max(60, Math.ceil((peak + 8) / 10) * 10))

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  /* The first and last releases sit inside the frame rather than on it, so
     their value labels clear the y-axis ticks and their markers are not half
     cut off by the plot edge. */
  const INSET = 34
  const span = Math.max(0, plotW - INSET * 2)
  const x = (i: number) =>
    points.length === 1
      ? PAD.left + plotW / 2
      : PAD.left + INSET + (i / (points.length - 1)) * span
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH

  const ticks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]

  // the line joins measured releases only; an unmeasured one leaves a gap
  // rather than a straight edge implying a value nobody recorded
  const path = measured
    .map((p, n) => {
      const i = points.indexOf(p)
      return `${n === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.coveragePct!).toFixed(1)}`
    })
    .join(' ')

  const active = hover === null ? null : points[hover]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto"
           role="img"
           aria-label={`Automation coverage across ${points.length} releases, against a reference range of ${low} to ${high} percent.`}>
        {/* reference range — context behind the series, never a series itself */}
        <defs>
          <pattern id="trend-hatch" width="6" height="6" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(135)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink2)" strokeWidth="2.2"
                  opacity="0.26" />
          </pattern>
        </defs>
        <rect x={PAD.left} y={y(high)} width={plotW} height={y(low) - y(high)}
              fill="url(#trend-hatch)" stroke="var(--ink2)" strokeWidth="1.2"
              strokeDasharray="4 3" opacity="0.85" />
        <text x={PAD.left + 8} y={y(high) - 5} fontSize="10.5" fill="var(--ink2)"
              fontFamily="ui-monospace, monospace">
          surveyed range {low}–{high}%
        </text>

        {/* y grid */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)}
                  stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 3.5} fontSize="10.5" fill="var(--muted)"
                  textAnchor="end" fontFamily="ui-monospace, monospace">
              {Math.round(t)}%
            </text>
          </g>
        ))}

        {path && (
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => {
          const cx = x(i)
          if (!p.measured || p.coveragePct === null) {
            return (
              <g key={p.releaseId}>
                <circle cx={cx} cy={PAD.top + plotH} r="3.5" fill="none"
                        stroke="var(--axis)" strokeWidth="1.5" strokeDasharray="2 2" />
                <text x={cx} y={PAD.top + plotH - 12} fontSize="10" fill="var(--muted)"
                      textAnchor="middle" fontFamily="ui-monospace, monospace">
                  n/a
                </text>
              </g>
            )
          }
          const cy = y(p.coveragePct)
          return (
            <g key={p.releaseId}>
              {/* the surface ring keeps a marker legible where it meets the band */}
              <circle cx={cx} cy={cy} r="6" fill="var(--surface)" />
              <circle cx={cx} cy={cy} r={p.current ? 5.5 : 4.5}
                      fill={p.current ? 'var(--accent)' : 'var(--surface)'}
                      stroke="var(--accent)" strokeWidth="2" />
              <text x={cx} y={cy - 13} fontSize="11" fontWeight="600"
                    fill="var(--accent)" textAnchor="middle"
                    fontFamily="ui-monospace, monospace">
                {p.coveragePct.toFixed(1)}%
              </text>
            </g>
          )
        })}

        {/* x axis: release names, evenly spaced because releases are ordinal */}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH}
              stroke="var(--axis)" strokeWidth="1" />
        {points.map((p, i) => (
          <text key={p.releaseId} x={x(i)} y={H - 24} fontSize="11"
                fill={p.current ? 'var(--ink)' : 'var(--muted)'}
                fontWeight={p.current ? 600 : 400}
                textAnchor="middle" fontFamily="ui-monospace, monospace">
            {p.releaseName}
          </text>
        ))}

        {/* generous hit targets, one band per release */}
        {points.map((p, i) => (
          <rect key={p.releaseId}
                x={x(i) - plotW / (points.length * 2 || 1) / 1}
                y={PAD.top} width={Math.max(28, plotW / (points.length || 1))}
                height={plotH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>

      {active && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-ink2">
          <b className="text-ink">{active.releaseName}</b>
          {active.measured ? (
            <>
              <span className="tabular-nums">
                {active.automated.toLocaleString('en-US')} / {active.total.toLocaleString('en-US')} test cases
              </span>
              {active.deltaPct !== null && (
                <span className="tabular-nums">
                  {active.deltaPct > 0 ? '+' : ''}{active.deltaPct} pts vs {active.comparedTo}
                </span>
              )}
              {active.unmeasuredLayers.length > 0 && (
                <span className="text-muted">
                  {active.unmeasuredLayers.length} layer
                  {active.unmeasuredLayers.length === 1 ? '' : 's'} excluded
                </span>
              )}
            </>
          ) : (
            <span className="text-muted">no automated count recorded for this release</span>
          )}
        </div>
      )}
    </div>
  )
}
