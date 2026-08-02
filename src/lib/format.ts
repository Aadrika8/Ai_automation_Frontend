export const fmt = (n: number): string => n.toLocaleString('en-US')

export function dayLabel(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 864e5)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** join conditional class names */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')
