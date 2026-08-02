/* Shared Recharts tooltip styled to the design tokens. */
interface TipPayload {
  value?: number | string
  name?: string
  color?: string
}
interface ChartTipProps {
  active?: boolean
  payload?: TipPayload[]
  label?: string | number
  unit?: string
  color?: string
}

export function ChartTip({ active, payload, label, unit = '', color }: ChartTipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-hairline rounded-[10px] shadow-lift px-3 py-2 text-[12.5px]">
      {label != null && <div className="text-muted text-[11.5px] mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <i className="w-2.5 h-0.5 rounded-sm" style={{ background: color ?? p.color ?? 'var(--accent)' }} />
          <b className="font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString('en-US') : p.value}{unit}</b>
          {p.name && <span className="text-ink2">{p.name}</span>}
        </div>
      ))}
    </div>
  )
}
