'use client'

import { useDashboard } from '@/context/DashboardContext'

type PortfolioPick = {
  team: string
  sport_key: string
  recommended_stake?: number
  ev?: number
  confidence?: number
  risk_grade?: string
}

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function percent(value: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function groupBySport(picks: PortfolioPick[]) {
  const map = new Map<string, number>()

  for (const pick of picks) {
    const stake = Number(pick.recommended_stake ?? 0)
    map.set(pick.sport_key, (map.get(pick.sport_key) ?? 0) + stake)
  }

  return [...map.entries()]
    .map(([sport, stake]) => ({ sport, stake }))
    .sort((a, b) => b.stake - a.stake)
}

function groupByTeam(picks: PortfolioPick[]) {
  const map = new Map<string, number>()

  for (const pick of picks) {
    const stake = Number(pick.recommended_stake ?? 0)
    map.set(pick.team, (map.get(pick.team) ?? 0) + stake)
  }

  return [...map.entries()]
    .map(([team, stake]) => ({ team, stake }))
    .sort((a, b) => b.stake - a.stake)
    .slice(0, 8)
}

function Bar({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const width = total > 0 ? Math.min((value / total) * 100, 100) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate text-slate-300">{label}</span>
        <span className="font-semibold text-white">{money(value)}</span>
      </div>

      <div className="h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function PortfolioHeatmapPanel() {
  const { dashboard, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading portfolio heatmap...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        Portfolio heatmap failed: {error}
      </div>
    )
  }

  const portfolio =
    dashboard?.portfolio?.portfolios?.balanced ??
    dashboard?.sections?.portfolio?.portfolios?.balanced ??
    null

  const picks = (portfolio?.picks ?? []) as PortfolioPick[]
  const totalStake = Number(portfolio?.totalStake ?? 0)
  const expectedProfit = Number(portfolio?.expectedProfit ?? 0)
  const expectedRoi = Number(portfolio?.expectedRoi ?? 0)
  const portfolioScore = Number(portfolio?.portfolioScore ?? 0)

  const bySport = groupBySport(picks)
  const byTeam = groupByTeam(picks)

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Bankroll Allocation
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Portfolio Heatmap
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Visual exposure by sport, team and recommended stake.
          </p>
        </div>

        <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
          Balanced Portfolio
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/70 p-4">
          <p className="text-xs text-slate-500">Total Stake</p>
          <p className="mt-1 text-2xl font-black text-white">
            {money(totalStake)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950/70 p-4">
          <p className="text-xs text-slate-500">Expected Profit</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">
            {money(expectedProfit)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950/70 p-4">
          <p className="text-xs text-slate-500">Expected ROI</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">
            {percent(expectedRoi)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950/70 p-4">
          <p className="text-xs text-slate-500">Portfolio Score</p>
          <p className="mt-1 text-2xl font-black text-white">
            {portfolioScore.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <h3 className="font-bold text-white">Exposure by Sport</h3>

          <div className="mt-4 space-y-4">
            {bySport.length === 0 ? (
              <p className="text-sm text-slate-400">
                No portfolio exposure available.
              </p>
            ) : (
              bySport.map((item) => (
                <Bar
                  key={item.sport}
                  label={item.sport}
                  value={item.stake}
                  total={totalStake}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <h3 className="font-bold text-white">Top Team Exposure</h3>

          <div className="mt-4 space-y-4">
            {byTeam.length === 0 ? (
              <p className="text-sm text-slate-400">
                No team exposure available.
              </p>
            ) : (
              byTeam.map((item) => (
                <Bar
                  key={item.team}
                  label={item.team}
                  value={item.stake}
                  total={totalStake}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}