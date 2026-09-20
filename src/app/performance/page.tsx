import DashboardShell from '@/components/dashboard/DashboardShell'
import { getMlbOfficialPerformance } from '@/services/pick2-mlb-performance-read.service'

export const dynamic = 'force-dynamic'

function percent(value: number | null) {
  return value === null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable'
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function odds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable'
  return value > 0 ? `+${value}` : String(value)
}

function prTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value)) + ' PR'
}

function stateLabel(value: string) {
  if (value === 'SETTLED') return 'Settled'
  if (value === 'PARTIAL_SETTLEMENT') return 'Partially settled'
  if (value === 'PREGAME') return 'Pregame — awaiting result'
  return 'Awaiting certified settlement'
}

function reasonText(code: string) {
  if (code === 'MODEL_EDGE_OVER_CONSENSUS') return 'Model probability was above the market consensus for the selected side.'
  if (code === 'POSITIVE_BEST_PRICE_EV') return 'The selected sportsbook price had positive expected value at decision time.'
  if (code === 'FRESH_MARKET') return 'The market snapshot was fresh when the decision was certified.'
  return code.replaceAll('_', ' ').toLowerCase()
}

function riskText(code: string) {
  if (code === 'PROBABLE_STARTER') return 'Starter was probable rather than confirmed at decision time.'
  return code.replaceAll('_', ' ').toLowerCase()
}

export default async function PerformancePage() {
  const report = await getMlbOfficialPerformance()
  const s = report.summary
  const ledger = report.ledger

  const settledMetrics = [
    ['Settled picks', s.pickCount],
    ['Wins', s.wins],
    ['Losses', s.losses],
    ['Pushes', s.pushes],
    ['Voids', s.voids],
    ['Win rate', percent(s.winRate)],
    ['Units', s.units?.toFixed(3) ?? 'Unavailable'],
    ['ROI', percent(s.roi)],
    ['CLV', 'Unavailable'],
  ] as const

  return (
    <DashboardShell>
      <section className="mx-auto max-w-7xl space-y-6 p-4 text-slate-200 sm:p-6">
        <header className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Official Pick Ledger + Certified Results</p>
          <h1 className="mt-2 text-3xl font-bold text-white">MLB performance</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            This page separates what was actually recorded as an Official Pick from postgame settlement.
            A pick can be stored before its result is available. Wins, losses, units and ROI use certified settlement rows only.
          </p>
        </header>

        {report.warning && (
          <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            {report.warning}
          </div>
        )}

        <section aria-label="Official Pick storage summary">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What is stored</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Official Pick ledger</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Unique selections', ledger.uniqueSelections, 'One game + side is counted once here.'],
              ['Games with a pick', ledger.uniqueGames, 'Games that have at least one persisted Official Pick decision.'],
              ['Decision snapshots', ledger.storedDecisionRows, 'Immutable qualifying decisions across scheduler snapshots/books.'],
              ['Awaiting settlement', ledger.pendingUniqueSelections, 'Unique selections without a complete certified settlement yet.'],
            ].map(([label, value, detail]) => (
              <div key={String(label)} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Certified settled performance">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Results only</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Certified settled performance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              These metrics do not count open picks or repeat decision snapshots as results. No result is inferred from schedule time alone.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {settledMetrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-2 text-xl font-semibold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
            <p>Settled sample: {s.sampleSize}. Dates: {s.dateFrom ?? 'none'} — {s.dateTo ?? 'none'}.</p>
            <p>Model: {s.modelVersions.join(', ') || 'No settled sample'}. Policy: {s.policyVersions.join(', ') || 'No settled sample'}.</p>
            <p>{s.clvReason}</p>
            {s.sampleSize === 0 && <p className="mt-2 text-amber-200">No profitability claim is supported until certified settlements exist.</p>}
          </div>
        </section>

        <section aria-label="Recent Official Picks" className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Decision history</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Recent Official Pick selections</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The first certified decision is shown for each game/side. “Decision snapshots” tells you how many immutable qualifying observations were stored for that same selection.
            </p>
          </div>

          {ledger.recentSelections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {ledger.recentSelections.map((row) => (
                <article key={`${row.gamePk}:${row.side}`} className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">Official Pick</p>
                      <h3 className="mt-1 text-xl font-bold text-white">{row.selection} ML</h3>
                      <p className="mt-1 text-sm text-slate-400">{row.matchup}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${row.state === 'SETTLED' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : row.state === 'PREGAME' ? 'border-sky-400/40 bg-sky-400/10 text-sky-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>
                      {stateLabel(row.state)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><p className="text-xs text-slate-500">Original price</p><p className="mt-1 font-bold text-white">{odds(row.originalOdds)}</p></div>
                    <div><p className="text-xs text-slate-500">Book</p><p className="mt-1 font-bold text-white">{row.originalBook}</p></div>
                    <div><p className="text-xs text-slate-500">Model</p><p className="mt-1 font-bold text-white">{percent(row.modelProbability)}</p></div>
                    <div><p className="text-xs text-slate-500">Edge</p><p className="mt-1 font-bold text-white">{signedPercent(row.consensusEdge)}</p></div>
                    <div><p className="text-xs text-slate-500">EV / unit</p><p className="mt-1 font-bold text-white">{signedPercent(row.unitEv)}</p></div>
                    <div><p className="text-xs text-slate-500">Certified</p><p className="mt-1 font-bold text-white">{prTime(row.firstDecisionAt)}</p></div>
                    <div><p className="text-xs text-slate-500">Decision snapshots</p><p className="mt-1 font-bold text-white">{row.decisionSnapshots}</p></div>
                    <div><p className="text-xs text-slate-500">Result</p><p className="mt-1 font-bold text-white">{row.settledOutcome ?? 'Pending'}</p></div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Why it qualified</p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
                      {(row.reasonCodes.length ? row.reasonCodes : ['Stored under the certified Official Pick policy.']).map((reason) => (
                        <li key={reason}>• {reasonText(reason)}</li>
                      ))}
                    </ul>
                    {row.riskFlags.length > 0 && (
                      <>
                        <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-300">Risk at decision time</p>
                        <ul className="mt-1 space-y-1 text-sm leading-6 text-amber-100/90">
                          {row.riskFlags.map((risk) => <li key={risk}>• {riskText(risk)}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-700 p-4 text-sm text-slate-300">No stored Official Pick selections are available.</p>
          )}
        </section>
      </section>
    </DashboardShell>
  )
}
