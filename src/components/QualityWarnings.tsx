/* What was wrong with a workbook when it was read.

   Two severities and no more. A problem means data was lost or a figure is now
   wrong, so it gets a filled block — the same treatment the load dialog already
   gives an error. A notice means worth a look and nothing was lost, so it gets
   an amber mark and a line of text, no fill.

   That asymmetry is the point rather than a shortcut: a sheet nobody finished
   emits four or five notices, and five tinted blocks is a wall people stop
   reading. Only the ones that cost something are allowed to shout. */
import type { ReactNode } from 'react'
import type { QualityWarning } from '../api'
import { AlertTriangleIcon, InfoIcon } from './icons'
import { warningLabel } from '../lib/warnings'

export function WarningLine({ warning }: { warning: QualityWarning }) {
  const problem = warning.severity === 'problem'
  return (
    <div
      className={problem
        ? 'flex items-start gap-[7px] bg-critical/10 rounded-lg px-2.5 py-2'
        : 'flex items-start gap-[7px]'}
    >
      <span className={`shrink-0 mt-px ${problem ? 'text-crit-text' : 'text-warning'}`}>
        {problem ? <AlertTriangleIcon size={14} /> : <InfoIcon size={14} />}
      </span>
      <p className="text-[12.5px] text-ink2 leading-snug">{warning.message}</p>
    </div>
  )
}

/** Every warning for one workbook. Renders nothing at all when it is clean —
    most sheets are, and a panel that is always there stops being read. */
export function QualityWarnings({ warnings, className = '' }: {
  warnings: QualityWarning[] | undefined
  className?: string
}) {
  if (!warnings?.length) return null
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {warnings.map(w => <WarningLine key={w.code} warning={w} />)}
    </div>
  )
}

/** One finding with its name as the title — red edge for a problem, amber
    for a notice. Used where the name is also shown on a pill above it. */
export function Callout({ problem, title, children }: {
  problem: boolean
  title: string
  children: ReactNode
}) {
  return (
    <div className={problem
      ? 'mt-2 border-l-[3px] border-critical bg-critical/10 rounded-r-lg px-2.5 py-2 text-[12.5px] leading-snug text-ink2'
      : 'mt-2 border-l-[3px] border-warning bg-warning/10 rounded-r-lg px-2.5 py-2 text-[12.5px] leading-snug text-ink2'}>
      <b className={problem ? 'font-semibold text-crit-text' : 'font-semibold text-warn-text'}>
        {title} —{' '}
      </b>
      {children}
    </div>
  )
}

export function WarningCallout({ warning }: { warning: QualityWarning }) {
  return (
    <Callout problem={warning.severity === 'problem'} title={warningLabel(warning.code)}>
      {warning.message}
    </Callout>
  )
}

/** The collapsed form, for a row that is only a summary — the count, coloured
    by the worst thing in it. */
export function WarningBadge({ warnings }: { warnings: QualityWarning[] | undefined }) {
  if (!warnings?.length) return null
  const problems = warnings.filter(w => w.severity === 'problem').length
  const notices = warnings.length - problems
  const parts = [
    problems > 0 && `${problems} problem${problems === 1 ? '' : 's'}`,
    notices > 0 && `${notices} notice${notices === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className={problems > 0 ? 'text-crit-text' : 'text-warning'}>
        {problems > 0 ? <AlertTriangleIcon size={13} /> : <InfoIcon size={13} />}
      </span>
      {parts.join(' · ')}
    </span>
  )
}
