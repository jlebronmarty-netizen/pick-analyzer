'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProbabilityParlay, ProbabilityParlayMode, ProbabilityParlayScope, ProbabilityPick, ProbabilityPickSection, ProbabilitySportEligibilitySummary } from '@/types/probability-picks'

type PicksData = {
  generatedAt: string
  summary: { picksGenerated: number; sports: string[]; markets: string[]; sportEligibility: ProbabilitySportEligibilitySummary }
  sections: ProbabilityPickSection[]
  picks: ProbabilityPick[]
  warnings: string[]
}

type ParlaysData = {
  generatedAt: string
  summary: { parlaysGenerated: number; mode: ProbabilityParlayMode; scope: ProbabilityParlayScope }
  parlays: ProbabilityParlay[]
  warnings: string[]
}

const marketOptions = [
  ['all', 'All Markets'],
  ['moneyline', 'Moneyline'],
  ['run_line', 'Run Line'],
  ['total', 'Totals'],
  ['pitcher_outs', 'Pitcher Outs'],
] as const

const sectionOrder = [
  'highest_probability',
  'highest_confidence',
  'safest_picks',
  'highest_quality',
  'highest_pitcher_projection',
  'highest_team_projection',
  'most_stable',
  'upset_candidates',
  'projection_only',
]

function pct(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

function labelize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function riskClass(risk: string) {
  if (risk === 'LOW') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
  if (risk === 'MEDIUM') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-rose-500/40 bg-rose-500/10 text-rose-100'
}

function eligibilityClass(eligible: boolean) {
  return eligible ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
}

function dataStatusText(value: string) {
  if (value === 'CURRENT_STORED') return 'Current Stored'
  if (value === 'MODEL_GENERATED') return 'Model Generated'
  return labelize(value)
}

function PickCard({ pick }: { pick: ProbabilityPick }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{labelize(pick.sport)} | {labelize(pick.marketType)}</p>
          <h3 className="mt-2 text-lg font-black text-white">{pick.selection}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-200">Projection Only | No Betting Recommendation</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <span className={`rounded-full border px-3 py-1 ${eligibilityClass(pick.sportEligibility.eligibleForRanking)}`}>{labelize(pick.sportEligibility.status)}</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100">{dataStatusText(pick.dataStatus)}</span>
          <span className={`rounded-full border px-3 py-1 ${riskClass(pick.risk)}`}>{pick.risk} Risk</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100">Score {Math.round(pick.score)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Probability</p>
          <p className="mt-1 text-2xl font-black text-white">{pct(pick.modelProbability)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Confidence</p>
          <p className="mt-1 text-2xl font-black text-white">{Math.round(pick.confidence)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Quality</p>
          <p className="mt-1 text-2xl font-black text-white">{Math.round(pick.quality)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Starter</p>
          <p className="mt-1 text-sm font-black text-white">{labelize(pick.starterStatus)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Drivers</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {pick.drivers.slice(0, 4).map((driver) => <li key={driver}>{driver}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Risks</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {pick.risks.slice(0, 4).map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase text-slate-400">
        <span>Generated {new Date(pick.generatedAt).toLocaleString()}</span>
        <span>Version {pick.projectionVersion}</span>
        <span>Group {pick.correlationGroup}</span>
        <span>{pick.sportEligibility.engineCertification}</span>
      </div>
    </article>
  )
}

function ParlayCard({ parlay }: { parlay: ProbabilityParlay }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{parlay.mode} | {parlay.scope.replace('_', ' ')}</p>
          <h3 className="mt-2 text-lg font-black text-white">{parlay.legCount} Leg Projection Parlay</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-200">Projection Only | No Betting Recommendation</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <span className={`rounded-full border px-3 py-1 ${riskClass(parlay.risk)}`}>{parlay.risk} Risk</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100">Penalty {parlay.correlationPenalty}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs font-bold uppercase text-slate-500">Combined<span className="block text-2xl font-black normal-case text-white">{pct(parlay.combinedProbability)}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs font-bold uppercase text-slate-500">Confidence<span className="block text-2xl font-black normal-case text-white">{Math.round(parlay.confidence)}</span></p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs font-bold uppercase text-slate-500">Quality<span className="block text-2xl font-black normal-case text-white">{Math.round(parlay.quality)}</span></p>
      </div>

      <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
        {parlay.legs.map((leg) => (
          <div key={leg.id} className="grid gap-2 bg-slate-950/60 p-3 text-sm text-slate-300 md:grid-cols-[1fr_auto_auto] md:items-center">
            <span className="font-bold text-white">{leg.selection}</span>
            <span>{labelize(leg.marketType)}</span>
            <span>{pct(leg.modelProbability)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <p className="text-sm text-slate-300">{parlay.drivers.join(' | ')}</p>
        <p className="text-sm text-slate-400">{parlay.risks.join(' | ')}</p>
      </div>
    </article>
  )
}

export default function ProbabilityPicksClient() {
  const [activeTab, setActiveTab] = useState<'picks' | 'parlays'>('picks')
  const [activeSection, setActiveSection] = useState('highest_probability')
  const [sport, setSport] = useState('all')
  const [market, setMarket] = useState('all')
  const [minProbability, setMinProbability] = useState(50)
  const [minConfidence, setMinConfidence] = useState(45)
  const [minQuality, setMinQuality] = useState(45)
  const [parlayMode, setParlayMode] = useState<ProbabilityParlayMode>('BALANCED')
  const [parlayScope, setParlayScope] = useState<ProbabilityParlayScope>('MLB_ONLY')
  const [picksData, setPicksData] = useState<PicksData | null>(null)
  const [parlaysData, setParlaysData] = useState<ParlaysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => new URLSearchParams({
    sport,
    market,
    minProbability: String(minProbability),
    minConfidence: String(minConfidence),
    minQuality: String(minQuality),
    limit: '120',
  }).toString(), [sport, market, minProbability, minConfidence, minQuality])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/probability-picks?${query}`).then((response) => response.json()),
      fetch(`/api/probability-picks/parlays?${query}&mode=${parlayMode}&scope=${parlayScope}&minLegs=2&maxLegs=5`).then((response) => response.json()),
    ])
      .then(([picks, parlays]) => {
        if (cancelled) return
        if (!picks.success) throw new Error(picks.error?.message ?? 'Probability picks unavailable')
        if (!parlays.success) throw new Error(parlays.error?.message ?? 'Probability parlays unavailable')
        setPicksData(picks)
        setParlaysData(parlays)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Probability workspace unavailable')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, parlayMode, parlayScope])

  const section = picksData?.sections.find((item) => item.id === activeSection) ?? picksData?.sections[0]
  const visibleSections = picksData?.sections.filter((item) => sectionOrder.includes(item.id)) ?? []
  const eligibleSports = picksData?.summary.sportEligibility.eligibleSports ?? []
  const excludedRows = picksData?.summary.sportEligibility.excludedRows ?? 0

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">AI Operations</p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Probability Picks</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Projection Only | No Betting Recommendation. Rankings use internal model probability, confidence, quality, freshness and correlation controls.</p>
            <p className="mt-2 max-w-3xl text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Sport eligibility: MLB certified limited. Uncertified sports are excluded from rankings and reported as insufficient certification.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black uppercase md:min-w-[420px]">
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Picks<span className="block text-xl text-white">{picksData?.summary.picksGenerated ?? 0}</span></p>
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Parlays<span className="block text-xl text-white">{parlaysData?.summary.parlaysGenerated ?? 0}</span></p>
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Calls<span className="block text-xl text-white">0</span></p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase text-slate-400">
            Sport
            <select value={sport} onChange={(event) => setSport(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">All Certified</option>
              {eligibleSports.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Market
            <select value={market} onChange={(event) => setMarket(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              {marketOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Min Probability
            <input type="number" min={0} max={100} value={minProbability} onChange={(event) => setMinProbability(Number(event.target.value))} className="mt-1 block h-10 w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white" />
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Min Confidence
            <input type="number" min={0} max={100} value={minConfidence} onChange={(event) => setMinConfidence(Number(event.target.value))} className="mt-1 block h-10 w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white" />
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Min Quality
            <input type="number" min={0} max={100} value={minQuality} onChange={(event) => setMinQuality(Number(event.target.value))} className="mt-1 block h-10 w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white" />
          </label>
          <div className="ml-auto flex rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button onClick={() => setActiveTab('picks')} className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === 'picks' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}`}>Picks</button>
            <button onClick={() => setActiveTab('parlays')} className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === 'parlays' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}`}>Parlays</button>
          </div>
        </div>

        {error && <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-950/30 p-4 text-sm font-bold text-rose-100">{error}</div>}
        {loading && <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm font-bold text-slate-300">Loading projection rankings...</div>}
        {!loading && !error && (
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
            <p className="font-black text-white">Probability means estimated outcome likelihood. Confidence means trust in that estimate. Quality means completeness of the inputs.</p>
            <p className="mt-1">Eligible sports: {eligibleSports.length ? eligibleSports.map(labelize).join(', ') : 'None'}. Excluded uncertified rows: {excludedRows}. Provider calls: 0. Remote mutations: 0.</p>
          </div>
        )}

        {!loading && !error && activeTab === 'picks' && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[300px_1fr]">
            <aside className="space-y-2">
              {visibleSections.map((item) => (
                <button key={item.id} onClick={() => setActiveSection(item.id)} className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-black ${activeSection === item.id ? 'border-sky-400 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-300'}`}>
                  <span>{item.label}</span>
                  <span>{item.picks.length}</span>
                </button>
              ))}
            </aside>
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">{section?.label ?? 'Projection Only'}</h2>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{picksData?.generatedAt ? new Date(picksData.generatedAt).toLocaleString() : 'N/A'}</p>
              </div>
              {!section?.picks.length && <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">No qualifying projection-only picks match the current filters or certified sport eligibility. Registered but uncertified sports remain Insufficient Data until their engine and stored data are certified.</div>}
              {section?.picks.map((pick) => <PickCard key={pick.id} pick={pick} />)}
            </section>
          </div>
        )}

        {!loading && !error && activeTab === 'parlays' && (
          <section className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-xl font-black text-white">Parlay Builder</h2>
              <select value={parlayMode} onChange={(event) => setParlayMode(event.target.value as ProbabilityParlayMode)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
                <option value="CONSERVATIVE">Conservative</option>
                <option value="BALANCED">Balanced</option>
                <option value="AGGRESSIVE">Aggressive</option>
              </select>
              <select value={parlayScope} onChange={(event) => setParlayScope(event.target.value as ProbabilityParlayScope)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
                <option value="MLB_ONLY">MLB Only</option>
                <option value="MULTI_SPORT">Multi-Sport</option>
              </select>
            </div>
            {!parlaysData?.parlays.length && <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">No qualifying projection-only combinations match the current filters and correlation limits.</div>}
            {parlaysData?.parlays.map((parlay) => <ParlayCard key={parlay.id} parlay={parlay} />)}
          </section>
        )}
      </div>
    </main>
  )
}
