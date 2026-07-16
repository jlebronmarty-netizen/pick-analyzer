'use client'

import { useEffect, useState } from 'react'

type Opportunity = {
  predictionId: string
  matchup: string
  marketLabel: string
  selection: string
  line: number | null
  americanOdds: number | null
  impliedProbability: number
  rawProbability: number
  edge: number
  expectedValue: number
  confidence: number
  reliability: string
  reliabilityScore: number
  featureQuality: number | null
  dataSufficiency: number | null
  oddsAgeMinutes: number
  valueCategory: string
  valueDisplay: string
  officialDisplay: string
  semanticLabel: string
  boardLabel: string
}

type Response = {
  summary: {
    candidatesScanned: number
    candidatesReturned: number
    positiveValueCandidates: number
    noModeledValueCandidates: number
    officialPickCount: number
    latestOddsCapture: string | null
    warning: string
  }
  opportunities: Opportunity[]
}

function odds(value: number | null) {
  if (value === null) return 'n/a'
  return value > 0 ? `+${value}` : String(value)
}

function pct(value: number | null) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

function tone(value: number) {
  return value > 0 ? 'text-emerald-300' : 'text-red-300'
}

export default function BestValueTool() {
  const [includePasses, setIncludePasses] = useState(false)
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const response = await fetch(`/api/market-opportunities/best-value?includePasses=${includePasses}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load Best Value')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Best Value')
      }
    }
    load()
  }, [includePasses])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Back to Dashboard</a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Premium Tool</p>
            <h1 className="mt-2 text-4xl font-black">Best Value</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Value-first scan over the canonical Current Board. Modeled value is not an official pick.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-bold">
            <input type="checkbox" checked={includePasses} onChange={(event) => setIncludePasses(event.target.checked)} />
            Show passes
          </label>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Summary label="Scanned" value={data?.summary.candidatesScanned ?? 0} />
          <Summary label="Positive Value" value={data?.summary.positiveValueCandidates ?? 0} />
          <Summary label="Official Picks" value={data?.summary.officialPickCount ?? 0} />
          <Summary label="Provider Calls" value="0" />
        </section>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
          {data?.summary.warning ?? 'MODELED VALUE is not an official pick.'}
        </div>

        {(data?.opportunities ?? []).length === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-black">No positive modeled-value candidate is available.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">The current board can still be analyzed, but the prices are not attractive enough for this value view.</p>
          </section>
        ) : (
          <section className="grid gap-4">
            {data?.opportunities.map((item) => (
              <article key={item.predictionId} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
                  <div>
                    <span className="rounded-full border border-amber-500/40 bg-amber-950/20 px-3 py-1 text-xs font-black text-amber-100">
                      {item.valueDisplay}
                    </span>
                    <h2 className="mt-3 text-2xl font-black">{item.selection} {item.line ?? ''}</h2>
                    <p className="mt-1 text-sm text-slate-400">{item.marketLabel} | {item.matchup}</p>
                    <p className="mt-3 text-sm font-bold text-slate-300">{item.officialDisplay}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Metric label="EV" value={pct(item.expectedValue)} color={tone(item.expectedValue)} />
                    <Metric label="Edge" value={pct(item.edge)} color={tone(item.edge)} />
                    <Metric label="Odds" value={odds(item.americanOdds)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Model" value={pct(item.rawProbability)} />
                    <Metric label="Book" value={pct(item.impliedProbability)} />
                    <Metric label="Confidence" value={pct(item.confidence)} />
                    <Metric label="Reliability" value={item.reliability} />
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Metric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-slate-950/70 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-black ${color}`}>{value}</p>
    </div>
  )
}
