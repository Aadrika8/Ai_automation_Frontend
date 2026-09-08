import type { SnapshotPeriod } from '../api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The month a load defaults to: the one it is being done in. */
export function thisMonth(): SnapshotPeriod {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** "Sep 2026" — how a period reads everywhere in the UI. */
export function monthLabel(period: SnapshotPeriod | null | undefined): string {
  if (!period) return '—'
  return `${MONTHS[period.month - 1] ?? '?'} ${period.year}`
}

/** "2026-09" — how a period travels in a URL. */
export function monthParam(period: SnapshotPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

/** "12 Sep 2026, 14:32" — the exact moment a file was loaded. Snapshots are
    grouped by month, but the precise time is what tells two loads apart. */
export function loadedAtLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  return at.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
