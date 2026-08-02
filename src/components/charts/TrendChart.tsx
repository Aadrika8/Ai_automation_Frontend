import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { HistoryPoint } from '../../api'
import { dayLabel } from '../../lib/format'
import { ChartTip } from './ChartTip'

export function TrendChart({ history }: { history: HistoryPoint[] }) {
  const data = history.map(p => ({ date: dayLabel(p.daysAgo), passRate: p.passRate }))
  const lo = Math.max(0, Math.floor((Math.min(...history.map(p => p.passRate)) - 2) / 5) * 5)
  const last = data[data.length - 1]

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 52, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted)', fontSize: 10.5 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            domain={[lo, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--muted)', fontSize: 10.5 }}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip content={<ChartTip unit="%" color="var(--accent)" />} cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="passRate" name="pass rate" fill="var(--accent)" fillOpacity={0.1} stroke="none" activeDot={false} />
          <Line
            type="monotone"
            dataKey="passRate"
            name="pass rate"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4.5, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
          />
          <ReferenceDot
            x={last.date}
            y={last.passRate}
            r={4.5}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={2}
            label={{ value: `${last.passRate}%`, position: 'right', fill: 'var(--ink)', fontSize: 11, fontWeight: 600 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
