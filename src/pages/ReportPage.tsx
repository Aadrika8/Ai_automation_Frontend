import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type AppId, type LayerId } from '../api'
import { useData } from '../lib/useData'
import logo from '../assets/evident-logo.png'

const APP_NAMES: Record<string, string> = { hrms: 'HRMS', cellsens: 'cellSens', preciv: 'PRECiV' }
const LAYER_NAMES: Record<string, string> = {
  unit: 'Unit Testing', integration: 'Integration Testing',
  system: 'System Testing', e2e: 'UI / End-to-End Testing',
}

/* Standalone printable document: forced-light "paper" styling (independent of
   the app theme) so the browser's Save-as-PDF output is always correct. */
export function ReportPage() {
  const { appId = '', layerId = '' } = useParams()
  const [gen, setGen] = useState(0)
  const { data, loading, error } = useData(
    () => api.generateReport(appId as AppId, layerId as LayerId, gen > 0),
    [appId, layerId, gen],
  )

  const appName = APP_NAMES[appId] ?? appId
  const layerName = LAYER_NAMES[layerId] ?? layerId
  const generated = data ? new Date(data.generatedAt).toLocaleString(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }) : ''

  return (
    <div className="report-root">
      <style>{`
        .report-root { min-height: 100vh; background: #eef1f5; color: #16181d; padding: 28px 16px 64px; }
        .report-sheet { position: relative; overflow: hidden; max-width: 820px; margin: 0 auto; background: #fff;
          border-radius: 10px; box-shadow: 0 6px 32px rgba(20,30,50,.12); padding: 48px 56px; }
        .report-watermark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-24deg);
          width: 72%; max-width: 640px; opacity: .05; pointer-events: none; z-index: 0; }
        .report-sheet > :not(.report-watermark) { position: relative; z-index: 1; }
        .report-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e3e7ee;
          border-radius: 10px; padding: 18px 20px; margin-top: 14px; }
        @media print {
          .report-root { background: #fff; padding: 0; }
          /* fixed elements repeat on every printed page */
          .report-watermark { position: fixed; width: 60%; }
          .report-sheet { max-width: none; margin: 0; box-shadow: none; border-radius: 0; padding: 0; overflow: visible; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3 max-w-[820px] mx-auto mb-4">
        <Link to={`/apps/${appId}/${layerId}`} className="text-[13px] font-semibold text-[#3d70d6] hover:underline">
          ← Back to dashboard
        </Link>
        <div className="flex-1" />
        {data && (
          <>
            <button
              onClick={() => setGen(g => g + 1)}
              className="text-[13px] font-semibold px-3.5 py-2 rounded-lg border border-[#c9d2e0] bg-white hover:bg-[#f4f6fa]"
            >
              Regenerate
            </button>
            <button
              onClick={() => window.print()}
              className="text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-[#153a8a] text-white hover:bg-[#1c48a8]"
            >
              Download PDF
            </button>
          </>
        )}
      </div>

      <div className="report-sheet">
        <img src={logo} alt="" className="report-watermark" aria-hidden />

        {loading && (
          <div className="py-24 text-center">
            <div className="text-[15px] font-semibold">Analyzing test data with AI…</div>
            <div className="text-[13px] text-[#6a7385] mt-1.5">
              Summarizing failures, causes and fixes for {appName} · {layerName}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="py-24 text-center">
            <div className="text-[15px] font-semibold text-[#b3352e]">Could not generate the report</div>
            <div className="text-[13px] text-[#6a7385] mt-1.5">{error}</div>
          </div>
        )}

        {data && !loading && (
          <>
            <header className="flex items-start gap-4 pb-5 border-b-2 border-[#16181d]">
              <div className="flex-1">
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6a7385]">
                  Quality Insights · AI Test Report
                </div>
                <h1 className="text-[26px] font-bold tracking-tight mt-1">{appName} — {layerName}</h1>
                <div className="text-[12.5px] text-[#6a7385] mt-1">
                  Generated {generated} · model {data.model}{data.cached ? ' · served from cache' : ''}
                </div>
              </div>
              <img src={logo} alt="Evident" className="h-7 mt-1.5" />
            </header>

            <section className="mt-7">
              <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-[#3d4655]">Executive summary</h2>
              <p className="text-[14.5px] leading-relaxed mt-2">{data.summary}</p>
            </section>

            <section className="mt-7">
              <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-[#3d4655]">Health assessment</h2>
              <p className="text-[14.5px] leading-relaxed mt-2">{data.healthAssessment}</p>
            </section>

            {data.topIssues.length > 0 && (
              <section className="mt-7">
                <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-[#3d4655]">
                  Top issues — causes &amp; fixes
                </h2>
                {data.topIssues.map((issue, i) => (
                  <div key={i} className="report-card">
                    <div className="flex items-baseline gap-3">
                      <div className="flex-1 text-[15px] font-semibold">{i + 1}. {issue.title}</div>
                      <div className="text-[12px] font-semibold text-[#b3352e] whitespace-nowrap">
                        {issue.affectedTests} test{issue.affectedTests === 1 ? '' : 's'} affected
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-wide text-[#6a7385]">Likely causes</div>
                        <ul className="mt-1.5 space-y-1 text-[13.5px] leading-snug list-disc pl-4">
                          {issue.likelyCauses.map((c, j) => <li key={j}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-bold uppercase tracking-wide text-[#1d7a3d]">Suggested fixes</div>
                        <ul className="mt-1.5 space-y-1 text-[13.5px] leading-snug list-disc pl-4">
                          {issue.suggestedFixes.map((f, j) => <li key={j}>{f}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {data.recommendations.length > 0 && (
              <section className="mt-7">
                <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-[#3d4655]">Recommendations</h2>
                <ol className="mt-2 space-y-1.5 text-[14px] leading-relaxed list-decimal pl-5">
                  {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </section>
            )}

            <footer className="mt-10 pt-4 border-t border-[#e3e7ee] flex items-center gap-3 text-[11.5px] text-[#6a7385]">
              <span>Confidential — Evident internal quality report</span>
              <div className="flex-1" />
              <span>Generated by Quality Insights AI</span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
