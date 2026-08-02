import { fmt } from '../lib/format'
import { Meter, StatusChip } from './ui'
import type { RunSummary } from '../api'

export function RunsTable({ runs, context }: {
  runs: RunSummary[]
  /** optional per-row context chip, e.g. "cellSens · Unit" */
  context?: (run: RunSummary) => string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px] border-collapse">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted">
            <th className="font-semibold px-3 py-2.5 border-b border-grid">Run</th>
            {context && <th className="font-semibold px-3 py-2.5 border-b border-grid">Scope</th>}
            <th className="font-semibold px-3 py-2.5 border-b border-grid">When</th>
            <th className="font-semibold px-3 py-2.5 border-b border-grid">Tests</th>
            <th className="font-semibold px-3 py-2.5 border-b border-grid">Pass rate</th>
            <th className="font-semibold px-3 py-2.5 border-b border-grid">Duration</th>
            <th className="font-semibold px-3 py-2.5 border-b border-grid">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const pct = +(100 * run.passed / run.total).toFixed(1)
            return (
              <tr key={run.id} className="hover:bg-accent-soft/60 transition-colors">
                <td className="px-3 py-2.5 border-b border-grid font-semibold">{run.name}</td>
                {context && (
                  <td className="px-3 py-2.5 border-b border-grid text-xs text-muted whitespace-nowrap">{context(run)}</td>
                )}
                <td className="px-3 py-2.5 border-b border-grid text-muted text-xs whitespace-nowrap">{run.when}</td>
                <td className="px-3 py-2.5 border-b border-grid tabular-nums">{fmt(run.total)}</td>
                <td className="px-3 py-2.5 border-b border-grid">
                  <span className="flex items-center gap-2.5">
                    <Meter pct={pct} />
                    <span className="tabular-nums text-xs">{pct}%</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-grid text-muted text-xs">{run.durationMin} min</td>
                <td className="px-3 py-2.5 border-b border-grid"><StatusChip status={run.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
