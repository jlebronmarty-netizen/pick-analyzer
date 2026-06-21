'use client'

import { useUpcomingGames } from '@/hooks/useUpcomingGames'
import {
  analyzeMoneylinePick,
  formatEV,
  formatProbability,
  getBestPick,
  PickAnalysis,
} from '@/utils/betting'

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function getPrimaryMoneyline(game: {
  home_team: string
  away_team: string
  bookmakers: {
    title: string
    markets: {
      key: string
      outcomes: {
        name: string
        price: number
      }[]
    }[]
  }[]
}) {
  const bookmaker = game.bookmakers[0]
  const moneyline = bookmaker?.markets.find((market) => market.key === 'h2h')

  if (!bookmaker || !moneyline) {
    return null
  }

  const homeOdds = moneyline.outcomes.find(
    (outcome) => outcome.name === game.home_team
  )

  const awayOdds = moneyline.outcomes.find(
    (outcome) => outcome.name === game.away_team
  )

  return {
    sportsbook: bookmaker.title,
    homeOdds: homeOdds?.price,
    awayOdds: awayOdds?.price,
  }
}

function BettingAnalysisCard({ pick }: { pick: PickAnalysis }) {
  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="text-slate-400">{pick.team}</p>

      <p className="text-lg font-bold text-green-400">{pick.odds}</p>

      <div className="mt-2 space-y-1 text-xs text-slate-400">
        <p>Implied: {formatProbability(pick.impliedProbability)}</p>
        <p>Model: {formatProbability(pick.modelProbability)}</p>
        <p className={pick.hasValue ? 'text-green-400' : 'text-red-400'}>
          EV: {formatEV(pick.ev)}
        </p>
        <p>Confidence: {pick.confidence}/10</p>
      </div>

      <p
        className={
          pick.hasValue
            ? 'mt-2 rounded-full bg-green-500/10 px-2 py-1 text-center text-xs font-bold text-green-400'
            : 'mt-2 rounded-full bg-slate-700 px-2 py-1 text-center text-xs font-bold text-slate-400'
        }
      >
        {pick.rating}
      </p>
    </div>
  )
}

export default function UpcomingGames() {
  const { games, loading, error } = useUpcomingGames('baseball_mlb')

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

  if (games.length === 0) {
    return <p className="text-slate-400">No upcoming games found.</p>
  }

  return (
    <div className="space-y-3">
      {games.slice(0, 8).map((game) => {
        const moneyline = getPrimaryMoneyline(game)

        const picks: PickAnalysis[] = []

        if (moneyline?.awayOdds !== undefined) {
          picks.push(analyzeMoneylinePick(game.away_team, moneyline.awayOdds))
        }

        if (moneyline?.homeOdds !== undefined) {
          picks.push(analyzeMoneylinePick(game.home_team, moneyline.homeOdds))
        }

        const bestPick = getBestPick(picks)

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
                {game.bookmakers.length} books
              </span>
            </div>

            {bestPick ? (
              <div className="mb-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                  Recommended Pick
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {bestPick.team} ML
                </p>
                <p className="text-sm text-green-300">
                  EV {formatEV(bestPick.ev)} · Confidence{' '}
                  {bestPick.confidence}/10 · {bestPick.rating}
                </p>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Recommended Pick
                </p>
                <p className="mt-1 text-lg font-bold text-slate-300">Pass</p>
                <p className="text-sm text-slate-500">
                  No positive EV detected.
                </p>
              </div>
            )}

            {moneyline && picks.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                {picks.map((pick) => (
                  <BettingAnalysisCard key={pick.team} pick={pick} />
                ))}

                <p className="md:col-span-2 text-xs text-slate-500">
                  Odds from {moneyline.sportsbook}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Moneyline not available.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}