'use client'

import { useDashboard } from '@/context/DashboardContext'

type Mover = {
  id?: string
  team?: string
  opponent?: string
  sport_key?: string
  sportsbook?: string
  bestSportsbook?: string
  odds?: number
  bestOdds?: number
  formattedBestOdds?: string
  lineMove?: number
  lineMovePercent?: number
  edge?: number
  ev?: number
  confidence?: number
  sharpLabel?: string
  bettingUrgency?: string
  aiRecommendation?: string
  aiSummary?: string
}

function formatOdds(value?: number) {
  const odds = Number(value ?? 0)

  if (!Number.isFinite(odds) || odds === 0) return 'N/A'

  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatPercent(value?: number) {
  const number = Number(value ?? 0)
  const sign = number > 0 ? '+' : ''

  return `${sign}${number.toFixed(2)}%`
}

function urgencyClass(value?: string) {
  if (value === 'BET_NOW') return 'bg-emerald-500/15 text-emerald-300'
  if (value === 'PLAYABLE_NOW') return 'bg-blue-500/15 text-blue-300'
  if (value === 'WAIT_OR_MONITOR') return 'bg-amber-500/15 text-amber-300'

  return 'bg-red-500/15 text-red-300'
}

function sharpClass(value?: string) {
  if (value?.includes('SHARP')) return 'text-emerald-300'
  if (value?.includes('STEAM')) return 'text-blue-300'
  if (value?.includes('STALE')) return 'text-amber-300'

  return 'text-slate-400'
}

function getMovementIcon(value?: number) {
  const number = Number(value ?? 0)

  if (number > 0) return '▲'
  if (number < 0) return '▼'

  return '•'
}

function getMovementClass(value?: number) {
  const number = Number(value ?? 0)

  if (number > 0) return 'text-emerald-400'
  if (number < 0) return 'text-red-400'

  return 'text-slate-400'
}

function getMoversFromDashboard(dashboard: any): Mover[] {
  const sportsbookOpportunities =
    dashboard?.sportsbook?.opportunities ??
    dashboard?.sections?.sportsbook?.opportunities ??
    []

  const liveOpportunities =
    dashboard?.live?.opportunities ??
    dashboard?.sections?.live?.opportunities ??
    []

  const dailySharp =
    dashboard?.dailyReport?.sharpMoneyPlays ??
    dashboard?.sections?.dailyReport?.sharpMoneyPlays ??
    []

  const combined = [
    ...sportsbookOpportunities,
    ...liveOpportunities,
    ...dailySharp,
  ]

  const seen = new Set<string>()

  return combined
    .filter((item: Mover) => {
      const key = `${item.team}-${item.opponent}-${item.sportsbook}`

      if (seen.has(key)) return false

      seen.add(key)

      return true
    })
    .sort((a: Mover, b: Mover) => {
      const aScore =
        Math.abs(Number(a.lineMovePercent ?? a.lineMove ?? 0)) +
        Number(a.edge ?? 0) +
        Number(a.ev ?? 0) * 0.1

      const bScore =
        Math.abs(Number(b.lineMovePercent ?? b.lineMove ?? 0)) +
        Number(b.edge ?? 0) +
        Number(b.ev ?? 0) * 0.1

      return bScore - aScore
    })
    .slice(0, 8)
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <p className="text-sm font-semibold text-white">No market movers yet.</p>
      <p className="mt-2 text-sm text-slate-400">
        Run odds sync or sportsbook intelligence to populate live movement data.
      </p>
    </div>
  )
}

function MoverRow({ mover }: { mover: Mover }) {
  const movement = Number(mover.lineMovePercent ?? mover.lineMove ?? 0)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-white">
              {mover.team ?? 'Unknown Team'} ML
            </p>

            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${urgencyClass(
                mover.bettingUrgency ?? mover.aiRecommendation
              )}`}
            >
              {mover.bettingUrgency ?? mover.aiRecommendation ?? 'MONITOR'}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            vs {mover.opponent ?? 'Unknown'} · {mover.sport_key ?? 'sport'}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {mover.sportsbook ?? mover.bestSportsbook ?? 'Sportsbook'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-right text-xs sm:min-w-[360px]">
          <div>
            <p className="text-slate-500">Best Odds</p>
            <p className="font-bold text-white">
              {mover.formattedBestOdds ??
                formatOdds(mover.bestOdds ?? mover.odds)}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Move</p>
            <p className={`font-bold ${getMovementClass(movement)}`}>
              {getMovementIcon(movement)} {formatPercent(movement)}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Edge</p>
            <p className="font-bold text-emerald-400">
              {formatPercent(mover.edge)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className={sharpClass(mover.sharpLabel)}>
          {mover.sharpLabel ?? 'NO_SHARP_SIGNAL'}
        </span>

        <span className="text-slate-600">•</span>

        <span className="text-slate-400">
          EV {formatPercent(mover.ev)}
        </span>

        <span className="text-slate-600">•</span>

        <span className="text-slate-400">
          Confidence {formatPercent(mover.confidence)}
        </span>
      </div>

      {mover.aiSummary && (
        <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs leading-5 text-slate-300">
          {mover.aiSummary}
        </p>
      )}
    </div>
  )
}

export default function LiveMarketMoversPanel() {
  const { dashboard, loading, error } = useDashboard()

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-800" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl bg-slate-950/70"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        Market movers failed: {error}
      </div>
    )
  }

  const movers = getMoversFromDashboard(dashboard)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
            Market Intelligence
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Live Market Movers
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Odds movement, sharp signals, stale lines and sportsbook value.
          </p>
        </div>

        <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
          {movers.length} signals
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {movers.length === 0 ? (
          <EmptyState />
        ) : (
          movers.map((mover, index) => (
            <MoverRow
              key={`${mover.id ?? index}-${mover.team}-${mover.sportsbook}`}
              mover={mover}
            />
          ))
        )}
      </div>
    </div>
  )
}