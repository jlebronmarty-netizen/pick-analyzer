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

  steamMove?: boolean
  reverseLineMovement?: boolean
  staleLine?: boolean
  movementSignal?: string
  marketMovementScore?: number
  valueGap?: number
  sharpConfidence?: number
  bestBook?: string
  slowBook?: string
  marketDirection?: string
  marketPressure?: number

  sharpSignal?: boolean
  sharpLabel?: string
  sharpSummary?: string

  bettingUrgency?: 'BET_NOW' | 'WAIT' | 'MONITOR' | 'AVOID'
  urgencyScore?: number
  valueWindow?: string
  publicSharpIndicator?: string
  closingLineProjection?: string
  closingLineRisk?: string
  intelligenceSummary?: string

  aiRecommendation?: string
  aiTone?: string
  aiSummary?: string
  aiMarketRead?: string
  aiSharpRead?: string
  aiRiskRead?: string
  aiStakeRead?: string
  aiAction?: string
  aiFullExplanation?: string
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
    steamMoveCount?: number
    staleLineCount?: number
    sharpSignalCount?: number
    betNowCount?: number
    waitCount?: number
    avoidCount?: number
  }
  opportunities: LiveOpportunity[]
  error?: string
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatMoney(value?: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function alertClass(alertType: string) {
  if (alertType === 'LIVE_VALUE') return 'bg-emerald-500/15 text-emerald-300'
  if (alertType === 'BUY_LOW') return 'bg-blue-500/15 text-blue-300'
  if (alertType === 'STRONG_FAVORITE') return 'bg-purple-500/15 text-purple-300'

  return 'bg-slate-700 text-slate-300'
}

function urgencyClass(urgency?: string) {
  if (urgency === 'BET_NOW') return 'bg-emerald-500/15 text-emerald-300'
  if (urgency === 'WAIT') return 'bg-amber-500/15 text-amber-300'
  if (urgency === 'AVOID') return 'bg-red-500/15 text-red-300'

  return 'bg-slate-700 text-slate-300'
}

function signalClass(signal?: string) {
  if (signal === 'REVERSE_LINE') return 'bg-red-500/15 text-red-300'
  if (signal === 'STEAM_MOVE') return 'bg-orange-500/15 text-orange-300'
  if (signal === 'STALE_LINE') return 'bg-emerald-500/15 text-emerald-300'
  if (signal === 'VALUE_GAP') return 'bg-blue-500/15 text-blue-300'

  return 'bg-slate-700 text-slate-300'
}

function sharpClass(label?: string) {
  if (label === 'SHARP_VALUE') return 'bg-emerald-500/15 text-emerald-300'
  if (label === 'POSSIBLE_STEAM') return 'bg-orange-500/15 text-orange-300'
  if (label === 'STALE_BOOK') return 'bg-blue-500/15 text-blue-300'
  if (label === 'MARKET_WATCH') return 'bg-amber-500/15 text-amber-300'

  return 'bg-slate-700 text-slate-300'
}

function StatBox({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="rounded-lg bg-slate-950/70 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function OpportunityCard({ item }: { item: LiveOpportunity }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-white">{item.team} ML</h3>

            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${alertClass(
                item.alertType
              )}`}
            >
              {item.alertType}
            </span>

            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${urgencyClass(
                item.bettingUrgency
              )}`}
            >
              {item.bettingUrgency ?? 'MONITOR'}
            </span>

            {item.movementSignal && (
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${signalClass(
                  item.movementSignal
                )}`}
              >
                {item.movementSignal}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-400">
            vs {item.opponent} · {item.liveStatus}
          </p>

          <p className="mt-1 text-xs text-slate-500">{item.sportKey}</p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-left md:text-right">
          <p className="text-xs text-emerald-300">Best Line</p>
          <p className="text-3xl font-black text-emerald-400">
            {item.formattedBestOdds}
          </p>
          <p className="text-xs text-slate-300">{item.bestSportsbook}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <StatBox label="Consensus" value={item.formattedConsensusOdds} />
        <StatBox
          label="Line Value"
          value={formatPercent(item.lineValue)}
          valueClass="text-emerald-400"
        />
        <StatBox label="Books" value={item.booksCompared} />
        <StatBox label="Market Spread" value={formatPercent(item.marketSpread)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        <StatBox label="Model" value={formatPercent(item.modelProbability)} />
        <StatBox label="Edge" value={formatPercent(item.edge)} valueClass="text-emerald-400" />
        <StatBox label="EV" value={formatPercent(item.ev)} valueClass="text-emerald-400" />
        <StatBox label="Confidence" value={formatPercent(item.confidence)} />
        <StatBox label="Stake" value={formatMoney(item.recommendedStake)} />
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Market Intelligence
          </p>

          {item.sharpLabel && (
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${sharpClass(
                item.sharpLabel
              )}`}
            >
              {item.sharpLabel}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <StatBox
            label="Urgency Score"
            value={formatPercent(item.urgencyScore)}
            valueClass={
              (item.urgencyScore ?? 0) >= 75 ? 'text-emerald-400' : 'text-white'
            }
          />

          <StatBox
            label="Sharp Confidence"
            value={formatPercent(item.sharpConfidence)}
            valueClass={
              (item.sharpConfidence ?? 0) >= 70
                ? 'text-emerald-400'
                : 'text-white'
            }
          />

          <StatBox
            label="Movement Score"
            value={formatPercent(item.marketMovementScore)}
            valueClass={
              (item.marketMovementScore ?? 0) >= 70
                ? 'text-emerald-400'
                : 'text-white'
            }
          />

          <StatBox
            label="Market Pressure"
            value={formatPercent(item.marketPressure)}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <StatBox label="Best Book" value={item.bestBook ?? item.bestSportsbook} />
          <StatBox label="Slow Book" value={item.slowBook ?? 'N/A'} />
          <StatBox label="Value Gap" value={formatPercent(item.valueGap)} />
          <StatBox label="Closing Risk" value={item.closingLineRisk ?? 'N/A'} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {item.steamMove && (
            <span className="rounded-full bg-orange-500/15 px-3 py-1 font-semibold text-orange-300">
              🔥 Steam Move
            </span>
          )}

          {item.reverseLineMovement && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 font-semibold text-red-300">
              Reverse Line
            </span>
          )}

          {item.staleLine && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300">
              Stale Line
            </span>
          )}

          {item.sharpSignal && (
            <span className="rounded-full bg-blue-500/15 px-3 py-1 font-semibold text-blue-300">
              Sharp Signal
            </span>
          )}

          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            Window: {item.valueWindow ?? 'UNKNOWN'}
          </span>

          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            Public/Sharp: {item.publicSharpIndicator ?? 'UNKNOWN'}
          </span>
        </div>

        {(item.intelligenceSummary || item.closingLineProjection) && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-sm text-slate-300">
              {item.intelligenceSummary}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {item.closingLineProjection}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
            AI Betting Assistant
          </p>

          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${urgencyClass(item.bettingUrgency)}`}>
            {item.aiRecommendation ?? item.bettingUrgency ?? 'MONITOR'}
          </span>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          {item.aiSummary && <p>{item.aiSummary}</p>}
          {item.aiMarketRead && <p>{item.aiMarketRead}</p>}
          {item.aiSharpRead && <p>{item.aiSharpRead}</p>}
          {item.aiRiskRead && <p>{item.aiRiskRead}</p>}
          {item.aiStakeRead && <p>{item.aiStakeRead}</p>}
        </div>

        {item.aiAction && (
          <div className="mt-4 rounded-lg border border-blue-500/20 bg-slate-950/70 p-3">
            <p className="text-sm font-semibold text-white">{item.aiAction}</p>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            Best line, sharp signals, market movement and AI betting explanations.
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatBox label="Games" value={data.summary.gamesChecked} />
          <StatBox label="Books Checked" value={data.summary.sportsbookMarketsChecked} />
          <StatBox label="Raw Opps" value={data.summary.rawOpportunities} />
          <StatBox
            label="Best Plays"
            value={data.summary.opportunities}
            valueClass="text-emerald-400"
          />
          <StatBox
            label="Sharp"
            value={data.summary.sharpSignalCount ?? 0}
            valueClass="text-blue-300"
          />
          <StatBox
            label="Bet Now"
            value={data.summary.betNowCount ?? 0}
            valueClass="text-emerald-400"
          />
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