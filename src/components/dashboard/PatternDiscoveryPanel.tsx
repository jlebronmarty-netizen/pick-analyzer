'use client'

import { useDashboard } from '@/context/DashboardContext'

function StatCard({
  title,
  value,
  roi,
  sample,
}: {
  title: string
  value?: string
  roi?: number
  sample?: number
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-xl font-bold text-white">
        {value ?? 'No data'}
      </p>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span
          className={
            Number(roi ?? 0) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }
        >
          ROI {Number(roi ?? 0).toFixed(2)}%
        </span>

        <span className="text-slate-400">
          {sample ?? 0} picks
        </span>
      </div>
    </div>
  )
}

export default function PatternDiscoveryPanel() {
  const { dashboard } = useDashboard()

  const patterns =
    dashboard?.patterns ??
    dashboard?.advisor?.patterns

  if (!patterns) return null

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">

      <div className="mb-6">

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Pattern Discovery Engine
        </p>

        <h2 className="mt-2 text-3xl font-black text-white">
          Historical Learning
        </h2>

        <p className="mt-2 text-slate-400">
          The engine continuously analyzes settled predictions
          to discover profitable betting patterns.
        </p>

      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

        <StatCard
          title="Best Sport"
          value={patterns.bestSport?.key}
          roi={patterns.bestSport?.roi}
          sample={patterns.bestSport?.sample}
        />

        <StatCard
          title="Weakest Sport"
          value={patterns.worstSport?.key}
          roi={patterns.worstSport?.roi}
          sample={patterns.worstSport?.sample}
        />

        <StatCard
          title="Best Sportsbook"
          value={patterns.bestSportsbook?.key}
          roi={patterns.bestSportsbook?.roi}
          sample={patterns.bestSportsbook?.sample}
        />

        <StatCard
          title="Best Odds Range"
          value={patterns.bestOddsRange?.key}
          roi={patterns.bestOddsRange?.roi}
          sample={patterns.bestOddsRange?.sample}
        />

        <StatCard
          title="Best Confidence"
          value={patterns.bestConfidenceRange?.key}
          roi={patterns.bestConfidenceRange?.roi}
          sample={patterns.bestConfidenceRange?.sample}
        />

        <StatCard
          title="Best EV Range"
          value={patterns.bestEVRange?.key}
          roi={patterns.bestEVRange?.roi}
          sample={patterns.bestEVRange?.sample}
        />

      </div>

    </section>
  )
}