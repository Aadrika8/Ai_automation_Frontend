import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fmt } from '../../lib/format'
import { ChartTip } from './ChartTip'

export interface DonutPart {
  name: string
  value: number
  color: string
}

export function StatusDonut({ parts, centerBig, centerSmall }: {
  parts: DonutPart[]
  centerBig: string
  centerSmall: string
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative w-[140px] h-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTip />} />
            <Pie
              data={parts}
              dataKey="value"
              nameKey="name"
              innerRadius={44}
              outerRadius={62}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
            >
              {parts.map(p => <Cell key={p.name} fill={p.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <div className="text-[26px] font-semibold tracking-tight leading-none">{centerBig}</div>
            <div className="text-[11px] text-muted mt-1">{centerSmall}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-[170px] space-y-2">
        {parts.map(p => (
          <div key={p.name} className="flex items-center gap-2 text-[12.5px]">
            <i className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: p.color }} />
            <span className="text-ink2 flex-1">{p.name}</span>
            <b className="font-semibold tabular-nums">{fmt(p.value)}</b>
            <span className="text-muted tabular-nums w-11 text-right">{total ? (100 * p.value / total).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
