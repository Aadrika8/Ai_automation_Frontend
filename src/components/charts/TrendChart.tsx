import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartTip } from './ChartTip'

export interface TrendPoint {
  label: string
  passRate: number
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const lo = Math.max(0, Math.floor((Math.min(...data.map(p => p.passRate)) - 2) / 5) * 5)
  const last = data[data.length - 1]

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 52, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
          <XAxis
            dataKey="label"
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
            x={last.label}
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
