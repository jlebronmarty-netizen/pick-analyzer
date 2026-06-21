'use client'

import { useUpcomingGames } from '@/hooks/useUpcomingGames'

type PredictionV2 = {
  team: string
  opponent: string
  odds: number | null
  impliedProbability: number | null
  modelProbability: number | null
  edge: number | null
  ev: number | null
  confidence: number | null
  recommendedPick: boolean
}

type GameWithPredictions = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers?: {
    title: string
    markets: {
      key: string
      outcomes: {
        name: string
        price: number
      }[]
    }[]
  }[]
  predictions?: PredictionV2[]
  recommendedPick?: PredictionV2 | null
}

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function formatPercent(value: number | null | undefined) {
  const safe = safeNumber(value)
  return safe === null ? 'N/A' : `${safe.toFixed(2)}%`
}

function formatEV(value: number | null | undefined) {
  const safe = safeNumber(value)
  if (safe === null) return 'N/A'

  const sign = safe > 0 ? '+' : ''
  return `${sign}${safe.toFixed(2)}%`
}

function formatOdds(odds: number | null | undefined) {
  const safe = safeNumber(odds)
  if (safe === null) return 'N/A'

  return safe > 0 ? `+${safe}` : `${safe}`
}

function formatConfidence(value: number | null | undefined) {
  const safe = safeNumber(value)
  return safe === null ? 'N/A' : `${safe.toFixed(2)}/99`
}

function getPrimarySportsbook(game: GameWithPredictions) {
  return game.bookmakers?.[0]?.title ?? 'Unknown sportsbook'
}

function PredictionCard({ pick }: { pick: PredictionV2 }) {
  const edge = safeNumber(pick.edge)
  const ev = safeNumber(pick.ev)

  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white">{pick.team}</p>
          <p className="text-xs text-slate-500">vs {pick.opponent}</p>
        </div>

        <p className="text-lg font-bold text-green-400">
          {formatOdds(pick.odds)}
        </p>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-400">
        <p>Implied Probability: {formatPercent(pick.impliedProbability)}</p>
        <p>Model Probability: {formatPercent(pick.modelProbability)}</p>

        <p className={edge !== null && edge > 0 ? 'text-green-400' : 'text-red-400'}>
          Edge: {formatEV(pick.edge)}
        </p>

        <p className={ev !== null && ev > 0 ? 'text-green-400' : 'text-red-400'}>
          EV: {formatEV(pick.ev)}
        </p>

        <p>Confidence: {formatConfidence(pick.confidence)}</p>
      </div>

      <p
        className={
          pick.recommendedPick
            ? 'mt-3 rounded-full bg-green-500/10 px-2 py-1 text-center text-xs font-bold text-green-400'
            : 'mt-3 rounded-full bg-slate-700 px-2 py-1 text-center text-xs font-bold text-slate-400'
        }
      >
        {pick.recommendedPick ? 'VALUE PICK' : 'NO VALUE'}
      </p>
    </div>
  )
}

export default function UpcomingGames() {
  const { games = [], loading, error } = useUpcomingGames('baseball_mlb')

  const typedGames = games as GameWithPredictions[]

  if (loading) {
    return <p className="text-slate-400">Loading upcoming games...</p>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
        <p className="font-bold text-red-400">Could not load games.</p>
        <p className="mt-2 text-sm text-red-200">{error}</p>
      </div>
    )
  }

  if (!typedGames.length) {
    return <p className="text-slate-400">No upcoming games found.</p>
  }

  return (
    <div className="space-y-3">
      {typedGames.slice(0, 8).map((game) => {
        const predictions = game.predictions ?? []
        const bestPick = game.recommendedPick ?? null
        const sportsbook = getPrimarySportsbook(game)

        return (
          <div
            key={game.id}
            className="rounded-xl bg-slate-800 p-4 transition hover:bg-slate-700"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  {game.away_team} @ {game.home_team}
                </p>
                <p className="text-sm text-slate-400">
                  {game.sport_title} · {formatGameDate(game.commence_time)}
                </p>
              </div>

              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                {game.bookmakers?.length ?? 0} books
              </span>
            </div>

            {bestPick ? (
              <div className="mb-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                  Recommended Pick
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {bestPick.team} ML {formatOdds(bestPick.odds)}
                </p>

                <p className="text-sm text-green-300">
                  Model {formatPercent(bestPick.modelProbability)} · Edge{' '}
                  {formatEV(bestPick.edge)} · EV {formatEV(bestPick.ev)} ·
                  Confidence {formatConfidence(bestPick.confidence)}
                </p>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Recommended Pick
                </p>
                <p className="mt-1 text-lg font-bold text-slate-300">Pass</p>
                <p className="text-sm text-slate-500">
                  Prediction Engine V2 did not detect positive value.
                </p>
              </div>
            )}

            {predictions.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {predictions.map((pick) => (
                  <PredictionCard key={`${game.id}-${pick.team}`} pick={pick} />
                ))}

                <p className="text-xs text-slate-500 md:col-span-2">
                  Odds from {sportsbook}. Model powered by Prediction Engine V2.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Prediction data not available for this game.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}