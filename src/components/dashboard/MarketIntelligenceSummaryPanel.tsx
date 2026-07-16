'use client'

import { useEffect, useMemo, useState } from 'react'

type Opportunity = {
  id: string
  game: string | null
  marketLabel: string
  selection: string | null
  recommendation: string
  score: number
  health: string
  probability: number | null
  ev: number | null
  reason: string
}

type MarketIntelligenceResponse = {
  success: boolean
  scanner: {
    marketsScanned: number
    supported: number
    blocked: number
    missingData: number
    watch: number
    strongValue: number
    elite: number
    pass: number
    unavailable: number
  }
  distribution: {
    recommendation: Record<string, number>
    health: Record<string, number>
  }
  summary: {
    headline: string
    currentSlate: string | null
    latestOddsTimestamp: string | null
    officialPicks: number
  }
  opportunities: Opportunity[]
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export default function MarketIntelligenceSummaryPanel() {
  const [data, setData] = useState<MarketIntelligenceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        const response = await fetch('/api/market-intelligence?limit=8&includeUnavailable=true', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load market intelligence')
        if (active) {
          setData(json)
          setError(null)
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load market intelligence')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const topRows = useMemo(() => data?.opportunities.slice(0, 4) ?? [], [data])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Market Intelligence</p>
          <h3 className="mt-2 text-2xl font-black text-white">Scanner Summary</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {loading ? 'Scanning current stored markets...' : data?.summary.headline ?? 'Market scanner is unavailable.'}
          </p>
        </div>
        <a
          href="/api/market-intelligence"
          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          Open API
        </a>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <Stat label="Scanned" value={data?.scanner.marketsScanned ?? '--'} />
        <Stat label="Available" value={data?.scanner.supported ?? '--'} />
        <Stat label="Watch" value={data?.scanner.watch ?? '--'} />
        <Stat label="Strong" value={data?.scanner.strongValue ?? '--'} />
        <Stat label="Elite" value={data?.scanner.elite ?? '--'} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Distribution</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {Object.entries(data?.distribution.recommendation ?? {}).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
                <span className="text-slate-300">{label}</span>
                <span className="font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Top Attention</p>
          <div className="mt-3 space-y-3">
            {topRows.map((row) => (
              <div key={row.id} className="rounded-xl bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-white">{row.selection ?? row.marketLabel}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black text-emerald-200">{row.recommendation}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{row.game ?? row.reason}</p>
                <p className="mt-2 text-xs text-slate-500">Score {row.score} | {row.health}</p>
              </div>
            ))}
            {!loading && !topRows.length ? <p className="text-sm text-slate-400">No markets need attention right now.</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
