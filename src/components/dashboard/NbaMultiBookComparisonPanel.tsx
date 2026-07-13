'use client'

import { useEffect, useState, type ReactNode } from 'react'

type BookPrice = {
  sportsbook: string
  provider: string
  odds: number
  line: number | null
  snapshotTime: string
  ageMinutes: number
  stale: boolean
}

type Comparison = {
  id: string
  eventId: string
  homeTeam: string | null
  awayTeam: string | null
  startTime: string | null
  market: string
  outcome: string
  line: number | null
  books: BookPrice[]
  bestBook: BookPrice | null
  worstBook: BookPrice | null
  consensusOdds: number | null
  bookCount: number
  priceSpreadCents: number
  staleBookCount: number
  status: 'empty' | 'single_book' | 'multi_book' | 'stale'
  recommendation: 'NO_MARKET' | 'MONITOR' | 'SHOP_BEST_PRICE' | 'STALE'
}

type MultiBookResponse = {
  success: boolean
  status: string
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: number
    source: string
  }
  filters: {
    staleMinutes: number
  }
  summary: {
    oddsSnapshotsLoaded: number
    eventsLoaded: number
    sportsbooksTracked: number
    comparisonGroups: number
    multiBookMarkets: number
    staleMarkets: number
    bestPriceOpportunities: number
    averageBooksPerMarket: number
    maxPriceSpreadCents: number
  }
  warnings: string[]
  comparisons: Comparison[]
  error?: string
}

function odds(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return value > 0 ? `+${value}` : `${value}`
}

function statusClass(status: string) {
  if (status === 'ready' || status === 'multi_book') return 'text-emerald-300'
  if (status === 'single_book' || status === 'stale') return 'text-amber-300'
  return 'text-slate-400'
}

function recommendationClass(value: Comparison['recommendation']) {
  if (value === 'SHOP_BEST_PRICE') return 'text-emerald-300'
  if (value === 'MONITOR') return 'text-blue-300'
  if (value === 'STALE') return 'text-amber-300'
  return 'text-slate-400'
}

function Panel({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  )
}

export default function NbaMultiBookComparisonPanel() {
  const [data, setData] = useState<MultiBookResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/nba/markets/multi-book?limit=12', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load NBA multi-book comparison')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load NBA multi-book comparison'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading NBA multi-book comparison...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            NBA Multi-Book Comparison
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Stored Odds Price Shopping
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Compares persisted NBA odds snapshots across sportsbooks and keeps provider execution out of the browser.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'empty')}`}>
            {data?.status ?? 'empty'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel
          label="Sportsbooks"
          value={data?.summary.sportsbooksTracked ?? 0}
          detail="Stored books represented"
        />
        <Panel
          label="Markets"
          value={data?.summary.comparisonGroups ?? 0}
          detail={`${data?.summary.multiBookMarkets ?? 0} multi-book`}
        />
        <Panel
          label="Best Prices"
          value={data?.summary.bestPriceOpportunities ?? 0}
          detail="Groups worth shopping"
        />
        <Panel
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
          detail="Stored-data only"
        />
      </div>

      {data?.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Warnings
          </p>
          <div className="mt-3 grid gap-2">
            {data.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white">Top Comparison Groups</p>
            <p className="text-xs text-slate-500">
              Stale threshold: {data?.filters.staleMinutes ?? 120} minutes
            </p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {data?.summary.oddsSnapshotsLoaded ?? 0} snapshots
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {data?.comparisons.length ? (
            data.comparisons.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">
                      {item.homeTeam ?? 'NBA'} vs {item.awayTeam ?? 'Opponent'}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {item.market} · {item.outcome}
                      {item.line !== null ? ` · line ${item.line}` : ''}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className={`text-sm font-black ${recommendationClass(item.recommendation)}`}>
                      {item.recommendation.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Spread: {item.priceSpreadCents > 0 ? '+' : ''}
                      {item.priceSpreadCents}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {item.books.slice(0, 4).map((book) => (
                    <div
                      key={`${item.id}-${book.sportsbook}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <p className="truncate text-sm font-bold text-white">
                        {book.sportsbook}
                      </p>
                      <p className="mt-1 text-lg font-black text-cyan-100">
                        {odds(book.odds)}
                      </p>
                      <p className={book.stale ? 'text-xs text-amber-300' : 'text-xs text-slate-500'}>
                        {book.ageMinutes}m old
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-400">
              No stored NBA odds snapshots are available for multi-book comparison yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
