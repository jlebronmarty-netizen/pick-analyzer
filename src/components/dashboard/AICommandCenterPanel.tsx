'use client'

import { useDashboard } from '@/context/DashboardContext'

function badgeColor(level: string) {
  switch (level) {
    case 'HIGH':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'

    default:
      return 'bg-red-500/20 text-red-300 border-red-500/30'
  }
}

function severityColor(level: string) {
  switch (level) {
    case 'high':
      return 'border-red-500/30 bg-red-950/20'

    case 'medium':
      return 'border-yellow-500/30 bg-yellow-950/20'

    default:
      return 'border-emerald-500/30 bg-emerald-950/20'
  }
}

export default function AICommandCenterPanel() {
  const { dashboard, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <p className="text-slate-400">
          AI is preparing today's trading plan...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/40 p-8 text-red-300">
        {error}
      </div>
    )
  }

  const advisor =
    dashboard?.advisor ??
    dashboard?.sections?.advisor

  if (!advisor) {
    return null
  }

  const summary = advisor.summary
  const officialPickCount = Number(
    dashboard?.topPicks?.summary?.recommendedPicks ??
      dashboard?.dailyReport?.summary?.recommendedPicks ??
      summary?.recommendedPicks ??
      0
  )
  const officialPicksClosed = officialPickCount === 0

  return (
    <section className="rounded-3xl border border-cyan-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-cyan-950/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            AI Command Center
          </p>

          <h2 className="mt-2 text-4xl font-black text-white">
            Trading Intelligence
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Adaptive recommendation engine powered by model performance,
            calibration, CLV, bankroll exposure and today&apos;s board quality.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-4 py-2 text-xs font-bold ${badgeColor(
              advisor.opportunityLevel
            )}`}
          >
            {advisor.opportunityLevel} OPPORTUNITY
          </span>

          <span className="rounded-full border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs font-bold text-cyan-300">
            {advisor.marketBias} MODE
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs uppercase text-slate-500">Opportunity Score</p>
          <p className="mt-3 text-3xl font-black text-white">
            {Number(advisor.opportunityScore ?? 0).toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs uppercase text-slate-500">ROI</p>
          <p
            className={
              Number(summary?.roi ?? 0) >= 0
                ? 'mt-3 text-3xl font-black text-emerald-400'
                : 'mt-3 text-3xl font-black text-red-400'
            }
          >
            {Number(summary?.roi ?? 0).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs uppercase text-slate-500">Win Rate</p>
          <p className="mt-3 text-3xl font-black text-white">
            {Number(summary?.winRate ?? 0).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs uppercase text-slate-500">CLV</p>
          <p
            className={
              Number(summary?.clvAverage ?? 0) >= 0
                ? 'mt-3 text-3xl font-black text-emerald-400'
                : 'mt-3 text-3xl font-black text-red-400'
            }
          >
            {Number(summary?.clvAverage ?? 0).toFixed(2)}%
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs uppercase text-slate-500">Exposure</p>
          <p className="mt-3 text-3xl font-black text-cyan-300">
            {Number(summary?.exposurePercent ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      <details
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6"
        open={!officialPicksClosed}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">AI Outlook</h3>
              {officialPicksClosed ? (
                <p className="mt-1 text-sm text-slate-400">
                  Collapsed while official picks are off; Top Picks and MLB preview surfaces remain visible above.
                </p>
              ) : null}
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
              Details
            </span>
          </div>
        </summary>

        <div className="mt-4">
          <p className="text-sm leading-7 text-slate-300">{advisor.outlook}</p>
        </div>
      </details>

      {officialPicksClosed ? null : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {advisor.recommendations?.map((item: any, index: number) => (
            <div
              key={`${item.title}-${index}`}
              className={`rounded-2xl border p-5 ${severityColor(item.severity)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {item.type}
                </p>

                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                  {item.severity}
                </span>
              </div>

              <h4 className="mt-3 text-lg font-black text-white">
                {item.title}
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {item.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {advisor.warnings?.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
            Risk Watchlist
          </p>

          <div className="mt-4 space-y-3">
            {advisor.warnings.map((item: any, index: number) => (
              <div
                key={`${item.title}-${index}`}
                className="rounded-xl border border-amber-500/20 bg-slate-950/50 p-4"
              >
                <p className="font-bold text-white">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-100">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}        
