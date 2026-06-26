'use client'

import { useEffect, useState } from 'react'

type BookLine = {
  sportsbook: string
  odds: number
  formattedOdds: string
}

type LiveOpportunity = {
  gameId: string
  sportKey: string
  commenceTime: string
  liveStatus: string
  homeTeam: string
  awayTeam: string
  sportsbook: string
  team: string
  opponent: string
  odds: number
  formattedOdds: string
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
  alertType: string
  recommendation: string
  smartScore: number
  riskGrade: string
  riskLabel: string
  riskStars: number
  kellyPercent: number
  recommendedStake: number
  bestOdds: number
  formattedBestOdds: string
  bestSportsbook: string
  consensusOdds: number
  formattedConsensusOdds: string
  worstOdds: number
  formattedWorstOdds: string
  lineValue: number
  booksCompared: number
  marketSpread: number
  books: BookLine[]
}

type LiveResponse = {
  success: boolean
  sportKey: string
  bankroll: number
  generatedAt: string
  summary: {
    gamesChecked: number
    sportsbookMarketsChecked: number
    rawOpportunities: number
    opportunities: number
    liveValueCount: number
    buyLowCount: number
    watchlistCount: number
  }
  opportunities: LiveOpportunity[]
  error?: string
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function formatMoney(value: number) {
  return `$${Number(value).toFixed(2)}`
}

function alertClass(alertType: string) {
  if (alertType === 'LIVE_VALUE') return 'bg-emerald-500/15 text-emerald-300'
  if (alertType === 'BUY_LOW') return 'bg-blue-500/15 text-blue-300'
  if (alertType === 'STRONG_FAVORITE') return 'bg-purple-500/15 text-purple-300'

  return 'bg-slate-700 text-slate-300'
}

function OpportunityCard({ item }: { item: LiveOpportunity }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{item.team} ML</h3>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${alertClass(item.alertType)}`}>
              {item.alertType}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            vs {item.opponent} · {item.liveStatus}
          </p>

          <p className="mt-1 text-xs text-slate-500">{item.sportKey}</p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-xs text-slate-400">Best Line</p>
          <p className="text-2xl font-bold text-emerald-400">
            {item.formattedBestOdds}
          </p>
          <p className="text-xs text-slate-400">{item.bestSportsbook}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Consensus</p>
          <p className="font-bold text-white">{item.formattedConsensusOdds}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Line Value</p>
          <p className="font-bold text-emerald-400">
            {formatPercent(item.lineValue)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Books</p>
          <p className="font-bold text-white">{item.booksCompared}</p>
        </div>

        <div className="rounded-lg bg-slate-950/70 p-3">
          <p className="text-slate-500">Market Spread</p>
          <p className="font-bold text-white">{formatPercent(item.marketSpread)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        <div>
          <p className="text-slate-500">Model</p>
          <p className="font-semibold text-white">
            {formatPercent(item.modelProbability)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Edge</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(item.edge)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">EV</p>
          <p className="font-semibold text-emerald-400">
            {formatPercent(item.ev)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Confidence</p>
          <p className="font-semibold text-white">
            {formatPercent(item.confidence)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Stake</p>
          <p className="font-semibold text-white">
            {formatMoney(item.recommendedStake)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold text-slate-300">
          Sportsbook Lines
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.books.map((book) => (
            <span
              key={`${item.gameId}-${item.team}-${book.sportsbook}`}
              className={
                book.sportsbook === item.bestSportsbook
                  ? 'rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300'
                  : 'rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300'
              }
            >
              {book.sportsbook} {book.formattedOdds}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LiveOddsShoppingPanel() {
  const [sport, setSport] = useState('baseball_mlb')
  const [bankroll, setBankroll] = useState(2500)
  const [data, setData] = useState<LiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/live-bets?sport=${sport}&bankroll=${bankroll}`,
          {
            cache: 'no-store',
          }
        )

        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load live odds shopping')
        }

        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown live odds error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sport, bankroll])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading live odds shopping...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-6 text-sm text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Live Odds Shopping</h2>
          <p className="text-sm text-slate-400">
            Finds the best available line across sportsbooks for each qualified play.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={sport}
            onChange={(event) => setSport(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value="baseball_mlb">MLB</option>
            <option value="americanfootball_nfl">NFL</option>
            <option value="americanfootball_ncaaf">NCAAF</option>
            <option value="soccer_epl">EPL</option>
          </select>

          <select
            value={bankroll}
            onChange={(event) => setBankroll(Number(event.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value={500}>$500</option>
            <option value={1000}>$1,000</option>
            <option value={2500}>$2,500</option>
            <option value={5000}>$5,000</option>
            <option value={10000}>$10,000</option>
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Games</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {data.summary.gamesChecked}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Books Checked</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {data.summary.sportsbookMarketsChecked}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Raw Opportunities</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {data.summary.rawOpportunities}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400">Best Plays</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              {data.summary.opportunities}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {!data || data.opportunities.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            No live odds shopping opportunities available right now.
          </div>
        ) : (
          data.opportunities.map((item) => (
            <OpportunityCard key={`${item.gameId}-${item.team}`} item={item} />
          ))
        )}
      </div>
    </div>
  )
}