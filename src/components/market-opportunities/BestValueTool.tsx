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
  statusLabel?: string
  marketIntelligenceCategory?: string
  opportunityCategory?: string
  informationalWarning?: string | null
  reasonNotOfficial?: string | null
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
    scanCompleted: boolean
    dataAvailable: boolean
    errorCode: string | null
    errorMessageSafe: string | null
    positiveValueCount: number
    informationalFallbackUsed?: boolean
    displayMode?: string
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

function statusClass(item: Opportunity) {
  if (item.opportunityCategory === 'Official') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  if (item.opportunityCategory === 'Watchlist') return 'border-sky-500/40 bg-sky-950/20 text-sky-200'
  if (item.opportunityCategory === 'Model Only' || item.opportunityCategory === 'Pass') return 'border-blue-500/40 bg-blue-950/20 text-blue-200'
  if (item.opportunityCategory === 'Avoid') return 'border-red-500/40 bg-red-950/20 text-red-200'
  return 'border-amber-500/40 bg-amber-950/20 text-amber-100'
}

function selectionLabel(item: Opportunity) {
  if (item.marketLabel === 'Total') return `${item.selection} ${item.line ?? ''} Total`.trim()
  if (item.marketLabel === 'Run Line') {
    const line = item.line === null ? '' : item.line > 0 ? `+${item.line}` : String(item.line)
    return `${item.selection} ${line} Run Line`.trim()
  }
  return `${item.selection} Moneyline`
}

export default function BestValueTool() {
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const response = await fetch('/api/market-opportunities/best-value', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load Best Value')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Best Value')
      }
    }
    load()
  }, [])

  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex min-w-0 flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Back to Dashboard</a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Premium Tool</p>
            <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Best Value</h1>
            <p className="mt-3 max-w-[18rem] break-words text-sm leading-6 text-slate-400 sm:max-w-3xl">
              Value means positive EV and positive edge. Below-policy rows are separated as AI Leans, Watchlist or Avoid.
            </p>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">DATA TEMPORARILY UNAVAILABLE</div> : null}
        {data && data.summary.dataAvailable === false ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">
            <p className="font-black">DATA TEMPORARILY UNAVAILABLE</p>
            <p className="mt-1 text-sm text-red-100">Best Value did not complete its Current Board scan.</p>
          </div>
        ) : null}

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Markets Ranked" value={data?.summary.candidatesReturned ?? 0} />
          <Summary label="Positive Value" value={data?.summary.positiveValueCount ?? data?.summary.positiveValueCandidates ?? 0} />
          <Summary label="Official Picks" value={data?.summary.officialPickCount ?? 0} />
          <Summary label="Provider Calls" value="0" />
        </section>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
          {data?.summary.warning ?? 'No Positive Value Available Today.'}
        </div>

        {data?.summary.dataAvailable === false ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-black">Data temporarily unavailable.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">The scan did not complete, so this page is not claiming there are no value candidates.</p>
            <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Metric label="Scan Completed" value={String(data.summary.scanCompleted)} />
                <Metric label="Error Code" value={data.summary.errorCode ?? 'n/a'} />
                <Metric label="Safe Message" value={data.summary.errorMessageSafe ?? 'n/a'} />
              </div>
            </details>
          </section>
        ) : (data?.opportunities ?? []).length === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-black">No positive-value opportunities today.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">No current candidate has both positive EV and positive edge. High probability and good value remain separate.</p>
          </section>
        ) : (
          <section className="grid gap-4">
            {data?.opportunities.map((item) => (
              <article key={item.predictionId} className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="grid min-w-0 gap-5 lg:grid-cols-3">
                  <div className="min-w-0">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item)}`}>
                      {item.statusLabel ?? item.valueDisplay}
                    </span>
                    <h2 className="mt-3 break-words text-2xl font-black">{selectionLabel(item)}</h2>
                    <p className="mt-1 break-words text-sm text-slate-400">{item.marketLabel} | {item.matchup}</p>
                    <p className="mt-3 text-sm font-bold text-slate-300">{item.officialDisplay}</p>
                    {item.informationalWarning ? (
                      <p className="mt-3 whitespace-pre-line rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-black text-amber-100">
                        {item.informationalWarning}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 text-center sm:grid-cols-3">
                    <Metric label="EV" value={pct(item.expectedValue)} color={tone(item.expectedValue)} />
                    <Metric label="Edge" value={pct(item.edge)} color={tone(item.edge)} />
                    <Metric label="Odds" value={odds(item.americanOdds)} />
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <Metric label="Model" value={pct(item.rawProbability)} />
                    <Metric label="Book" value={pct(item.impliedProbability)} />
                    <Metric label="Confidence" value={pct(item.confidence)} />
                    <Metric label="Reliability" value={item.reliability} />
                  </div>
                </div>
                {item.reasonNotOfficial ? (
                  <p className="mt-4 text-sm leading-6 text-amber-100">
                    Reason not official: {item.reasonNotOfficial}
                  </p>
                ) : null}
                <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <Metric label="Semantic Label" value={item.semanticLabel} />
                    <Metric label="Board Label" value={item.boardLabel} />
                    <Metric label="Odds Age" value={`${item.oddsAgeMinutes}m`} />
                    <Metric label="Feature Quality" value={item.featureQuality === null ? 'n/a' : pct(item.featureQuality)} />
                    <Metric label="Sufficiency" value={item.dataSufficiency === null ? 'n/a' : pct(item.dataSufficiency)} />
                  </div>
                </details>
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
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="break-words text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Metric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/70 p-3">
      <p className="break-words text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-words font-black ${color}`}>{value}</p>
    </div>
  )
}
