'use client'

import { useState } from 'react'

type ResultCard = {
  id: string
  title: string
  matchup: string
  market: string
  odds: string
  modelProbability: number
  impliedProbability: number
  edge: number
  expectedValue: number
  confidence: number
  reliability: string
  label: string
  priceLabel: string
  plainAnswer: string
  officialEligibility: string
  quarantine: string
}

type Response = {
  action: string
  intent?: string
  summary: string
  meta?: {
    boardMode: string
    dataAsOf: string
    latestOddsCapture: string | null
    candidatesScanned: number
    candidatesMatched: number
    officialPickStatus: string
    previewOrQuarantined: boolean
    noValidResult: boolean
  }
  results?: ResultCard[]
  candidates?: ResultCard[]
  explanation?: {
    title: string
    summary: string
    whatSupportsIt: string[]
    whatWorksAgainstIt: string[]
    price: string
    missingInformation: string[]
    officialEligibilityBlockers: string[]
    confidence: string
    plainAnswer: string
  } | null
  conclusion?: string
  ticket?: unknown
  legs?: ResultCard[]
  rejectedReasons?: string[]
  changes?: Record<string, unknown> | null
  arbitrage?: { status: string; warning: string }
}

const examples = [
  'Most likely today',
  'Best value today',
  'Best underdog between +100 and +180',
  'Totals only',
  'Low risk',
  'Compare Mets moneyline with Under 9.5',
  'Why no picks today?',
  'Why not Mets moneyline?',
  'Build my ticket',
  'What changed?',
  'Arbitrage',
]

function pct(value: number) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

function actionFor(query: string) {
  const q = query.toLowerCase()
  if (q.includes('compare')) return 'COMPARE'
  if (q.includes('why') || q.includes('explain')) return 'EXPLAIN'
  if (q.includes('ticket') || q.includes('parlay')) return 'BUILD_TICKET'
  if (q.includes('changed') || q.includes('movement')) return 'WHAT_CHANGED'
  return 'SEARCH'
}

function resultLabel(item: ResultCard) {
  const title = item.title.trim()
  if (/moneyline/i.test(item.market) && !/moneyline/i.test(title)) return `${title} Moneyline`
  if (/run line/i.test(item.market) && !/run line/i.test(title)) return `${title} Run Line`
  if (/total/i.test(item.market) && !/total/i.test(title)) return `${title} Total`
  return title
}

export default function AiBetFinderTool() {
  const [query, setQuery] = useState('Most likely today')
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(nextQuery = query) {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/ai-bet-finder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: actionFor(nextQuery), query: nextQuery }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to run AI Bet Finder')
      setData(json)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to run AI Bet Finder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Back to Dashboard</a>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Premium Tool</p>
          <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">AI Bet Finder</h1>
          <p className="mt-3 max-w-[18rem] break-words text-sm leading-6 text-slate-400 sm:max-w-3xl">
            Deterministic assistant over Current Board, Most Likely, Best Value, official Top Picks, Bet Slip and Arbitrage. No LLM, no new model.
          </p>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm text-white"
              placeholder="Ask about current betting candidates..."
            />
            <button
              onClick={() => run()}
              disabled={loading}
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              {loading ? 'Searching...' : 'Ask'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setQuery(example)
                  run(example)
                }}
                className="max-w-full break-words rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                {example}
              </button>
            ))}
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}

        {data ? (
          <>
            <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">{data.action}{data.intent ? ` | ${data.intent}` : ''}</p>
              <h2 className="mt-2 break-words text-2xl font-black">{data.summary}</h2>
              <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Meta label="Board" value={data.meta?.boardMode ?? 'n/a'} />
                <Meta label="Current Markets Analyzed" value={String(data.meta?.candidatesScanned ?? 0)} />
                <Meta label="Matched" value={String(data.meta?.candidatesMatched ?? 0)} />
                <Meta label="Official" value={data.meta?.officialPickStatus ?? 'No official picks are currently enabled.'} />
              </div>
            </section>

            <section className="grid gap-4">
              {((data.results ?? data.candidates ?? data.legs ?? []) as ResultCard[]).map((item) => (
                <article key={item.id} className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="grid min-w-0 gap-5 lg:grid-cols-3">
                    <div className="min-w-0">
                      <span className="rounded-full border border-amber-500/40 bg-amber-950/20 px-3 py-1 text-xs font-black text-amber-100">
                        {item.plainAnswer}
                      </span>
                      <h3 className="mt-3 break-words text-2xl font-black">{resultLabel(item)}</h3>
                      <p className="mt-1 break-words text-sm text-slate-400">{item.market} | {item.matchup}</p>
                      <p className="mt-3 text-sm font-bold text-slate-300">{item.officialEligibility}</p>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-3 text-center sm:grid-cols-3">
                      <Meta label="Model" value={pct(item.modelProbability)} />
                      <Meta label="Book" value={pct(item.impliedProbability)} />
                      <Meta label="Odds" value={item.odds} />
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <Meta label="Edge" value={pct(item.edge)} />
                      <Meta label="EV" value={pct(item.expectedValue)} />
                      <Meta label="Confidence" value={pct(item.confidence)} />
                      <Meta label="Reliability" value={item.reliability} />
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {data.explanation ? (
              <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                <h2 className="break-words text-2xl font-black">{data.explanation.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{data.explanation.summary}</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Info title="What supports it" items={data.explanation.whatSupportsIt} />
                  <Info title="What works against it" items={data.explanation.whatWorksAgainstIt} />
                  <Info title="Missing information" items={data.explanation.missingInformation} />
                  <Info title="Official blockers" items={data.explanation.officialEligibilityBlockers} />
                </div>
              </section>
            ) : null}

            {data.conclusion ? <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">{data.conclusion}</div> : null}
            {data.rejectedReasons?.length ? <Info title="Ticket blockers" items={data.rejectedReasons} /> : null}

            <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
              <pre className="mt-4 max-w-full overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-300">{JSON.stringify(data, null, 2)}</pre>
            </details>
          </>
        ) : null}
      </div>
    </main>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/70 p-3">
      <p className="break-words text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black text-white">{value}</p>
    </div>
  )
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="break-words text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.16em]">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-300">
        {items.length ? items.slice(0, 8).map((item) => <p key={item}>{item}</p>) : <p className="text-slate-500">None listed.</p>}
      </div>
    </div>
  )
}
