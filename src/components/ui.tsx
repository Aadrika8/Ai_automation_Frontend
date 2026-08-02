/* Small shared building blocks: Card, KpiTile, StatusChip, Meter,
   Breadcrumbs, Segmented, EmptyState, Skeleton. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx, fmt } from '../lib/format'
import { CheckIcon, ChevronRightIcon, CrossIcon, SpinnerIcon } from './icons'
import type { RunStatus, TestStatus } from '../api'

export function Card({ className, children, onClick }: {
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cx('bg-surface border border-hairline rounded-xl shadow-card', className)}
    >
      {children}
    </div>
  )
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function useCountUp(target: number): string {
  const [value, setValue] = useState(reducedMotion() ? target : 0)
  const raf = useRef(0)
  useEffect(() => {
    if (reducedMotion() || target === 0) { setValue(target); return }
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 650)
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return fmt(value)
}

export function KpiTile({ label, value, sub, suffix = '' }: {
  label: string
  value: number
  suffix?: string
  sub?: ReactNode
}) {
  const shown = useCountUp(value)
  return (
    <Card className="px-4.5 py-4">
      <div className="text-xs text-ink2">{label}</div>
      <div className="text-[27px] font-semibold tracking-tight mt-0.5">{shown}{suffix}</div>
      {sub && <div className="text-[11.5px] text-muted mt-0.5 flex items-center gap-1.5">{sub}</div>}
    </Card>
  )
}

const RUN_CHIP: Record<RunStatus, { cls: string; icon: ReactNode }> = {
  Completed: { cls: 'text-good-text bg-good/10', icon: <CheckIcon /> },
  Failed: { cls: 'text-crit-text bg-critical/10', icon: <CrossIcon /> },
  Running: { cls: 'text-accent bg-accent-soft', icon: <SpinnerIcon className="animate-spin" /> },
}
const TEST_CHIP: Record<TestStatus, { cls: string; icon: ReactNode }> = {
  Passed: RUN_CHIP.Completed,
  Failed: RUN_CHIP.Failed,
  Running: RUN_CHIP.Running,
  Skipped: { cls: 'text-muted bg-muted/10', icon: <ChevronRightIcon size={11} /> },
}

export function StatusChip({ status }: { status: RunStatus | TestStatus }) {
  const spec = (RUN_CHIP as Record<string, { cls: string; icon: ReactNode }>)[status] ?? TEST_CHIP[status as TestStatus]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', spec.cls)}>
      {spec.icon}{status}
    </span>
  )
}

export function Meter({ pct, className }: { pct: number; className?: string }) {
  const color = pct >= 90 ? 'var(--good)' : pct >= 75 ? 'var(--warning)' : 'var(--critical)'
  return (
    <span className={cx('inline-block h-1.5 w-28 rounded-full bg-accent-soft overflow-hidden align-middle', className)}>
      <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  )
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12.5px] text-muted mb-4 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-axis">/</span>}
          {item.to
            ? <Link to={item.to} className="text-ink2 px-1.5 py-0.5 rounded-md hover:bg-accent-soft hover:text-accent">{item.label}</Link>
            : <span className="text-ink font-semibold">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: Array<{ label: string; value: T }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex bg-surface border border-hairline rounded-[10px] p-[3px] gap-0.5">
      {options.map(o => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cx(
            'text-[12.5px] px-3 py-1.5 rounded-lg transition-colors',
            o.value === value ? 'bg-accent text-white font-semibold' : 'text-ink2 hover:bg-accent-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="font-semibold text-ink2">{title}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </Card>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('rounded-lg bg-grid/60 animate-pulse', className)} />
}

export function PageTitle({ children, lede }: { children: ReactNode; lede?: string }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {lede && <p className="text-ink2 max-w-xl mt-1">{lede}</p>}
    </div>
  )
}
