'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductStatusBadge, ProductStatusBanner, productDateTime, sportReadinessLabel } from '@/components/product/ProductStatus'
import type { ProbabilityFreshnessSummary, ProbabilityParlay, ProbabilityParlayMode, ProbabilityParlayScope, ProbabilityPick, ProbabilityPickRisk, ProbabilityPickSection, ProbabilitySportEligibilityStatus, ProbabilitySportEligibilitySummary, ProbabilityTopSignals } from '@/types/probability-picks'

type PicksData = {
  version?: string
  generatedAt: string
  summary: {
    picksGenerated: number
    sports: string[]
    markets: string[]
    sportEligibility: ProbabilitySportEligibilitySummary
    freshnessSummary?: ProbabilityFreshnessSummary
    topSignals?: ProbabilityTopSignals
  }
  sportEligibility?: ProbabilitySportEligibilitySummary
  rankingEligibleSports?: string[]
  parlayEligibleSports?: string[]
  excludedSports?: string[]
  excludedRowsByReason?: Record<string, number>
  qualifiedRowsBySport?: Record<string, number>
  freshnessSummary?: ProbabilityFreshnessSummary
  topSignals?: ProbabilityTopSignals
  briefingContext?: {
    outlook: 'Review Manually' | 'Wait' | 'Skip Today'
    qualifiedCount: number
    certifiedSports: string[]
    freshness: ProbabilityFreshnessSummary['status']
    mainWarning: string | null
  }
  sections: ProbabilityPickSection[]
  picks: ProbabilityPick[]
  warnings: string[]
}

type ParlaysData = {
  version?: string
  generatedAt: string
  summary: { parlaysGenerated: number; mode: ProbabilityParlayMode; scope: ProbabilityParlayScope; multiSportAvailable?: boolean; qualificationReasons?: string[] }
  parlays: ProbabilityParlay[]
  warnings: string[]
  presentation?: {
    emptyState: string
    aggregateBlockers: string[]
    scopes: Array<{ value: ProbabilityParlayScope; label: string; available: boolean; reason: string }>
  }
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

function freshnessLabel(value: ProbabilityFreshnessSummary['status'] | string | undefined) {
  if (!value) return 'Unknown'
  return labelize(value)
}

function freshnessFromPick(pick: ProbabilityPick): ProbabilityFreshnessSummary['status'] {
  if (pick.freshness >= 78) return 'FRESH'
  if (pick.freshness >= 58) return 'AGING'
  if (pick.freshness > 0) return 'STALE'
  return 'UNKNOWN'
}

function stabilityValue(pick: ProbabilityPick | null | undefined) {
  if (!pick) return 'N/A'
  return Math.round((pick.confidence + pick.quality + pick.freshness) / 3)
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  )
}

function SignalCard({ title, pick, metric }: { title: string; pick: ProbabilityPick | null | undefined; metric: 'probability' | 'confidence' | 'quality' | 'stability' | 'freshness' }) {
  const value = pick
    ? metric === 'probability' ? pct(pick.modelProbability)
      : metric === 'confidence' ? Math.round(pick.confidence)
        : metric === 'quality' ? Math.round(pick.quality)
          : metric === 'stability' ? stabilityValue(pick)
            : freshnessLabel(freshnessFromPick(pick))
    : 'N/A'
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-bold text-white">{pick?.selection ?? 'No qualified projection'}</p>
      <p className="mt-1 text-xs font-bold uppercase text-sky-200">Projection Only / No Recommendation</p>
    </article>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
      <p className="font-black text-white">{title}</p>
      <p className="mt-2 leading-6">{detail}</p>
    </div>
  )
}

function PickCard({ pick }: { pick: ProbabilityPick }) {
  const readiness = sportReadinessLabel(pick.sport)
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{labelize(pick.sport)} | {labelize(pick.marketType)}</p>
          <h3 className="mt-2 text-lg font-black text-white">{pick.selection}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-200">Projection Only / No Recommendation</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <ProductStatusBadge tone={readiness.tone}>{readiness.label}</ProductStatusBadge>
          <span className={`rounded-full border px-3 py-1 ${eligibilityClass(pick.sportEligibility.eligibleForRanking)}`}>{labelize(pick.sportEligibility.status)}</span>
          <ProductStatusBadge tone="blue">{dataStatusText(pick.dataStatus)}</ProductStatusBadge>
          <span className={`rounded-full border px-3 py-1 ${riskClass(pick.risk)}`}>{pick.risk} Risk</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-100" title="Presentation score from existing model signals. This is not model probability.">Display {Math.round(pick.score)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Freshness</p>
          <p className="mt-1 text-sm font-black text-white">{freshnessLabel(freshnessFromPick(pick))}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Why It Qualified</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {(pick.explanation?.whyQualified ?? pick.qualificationReasons ?? pick.drivers).slice(0, 4).map((driver) => <li key={driver}>{driver}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Main Risks</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {(pick.explanation?.mainRisks ?? pick.mainRisks ?? pick.risks).slice(0, 4).map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(pick.explanation?.nextLinks ?? [
          { label: 'Open Current Board', href: '/dashboard#today' },
          { label: 'View Model Performance', href: '/performance' },
        ]).map((link) => (
          <a key={`${pick.id}-${link.href}`} href={link.href} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black uppercase text-slate-200 outline-none hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-300">
            {link.label}
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase text-slate-400">
        <span>Generated {productDateTime(pick.generatedAt)}</span>
        <span>Event {productDateTime(pick.eventStartTime, 'Event time unavailable')}</span>
        <span>Cutoff {productDateTime(pick.cutoffAt, 'Cutoff unavailable')}</span>
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
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-200">Projection Only / No Recommendation</p>
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
  const [minProbability, setMinProbability] = useState(0)
  const [minConfidence, setMinConfidence] = useState(0)
  const [minQuality, setMinQuality] = useState(0)
  const [maxRisk, setMaxRisk] = useState<ProbabilityPickRisk | 'all'>('all')
  const [dataFreshness, setDataFreshness] = useState<ProbabilityFreshnessSummary['status'] | 'all'>('all')
  const [certificationLevel, setCertificationLevel] = useState<ProbabilitySportEligibilityStatus | 'all'>('all')
  const [starterStatus, setStarterStatus] = useState('all')
  const [sort, setSort] = useState('score')
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
    maxRisk,
    dataFreshness,
    certificationLevel,
    starterStatus,
    sort,
    limit: '120',
  }).toString(), [sport, market, minProbability, minConfidence, minQuality, maxRisk, dataFreshness, certificationLevel, starterStatus, sort])

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
  const sportEligibility = picksData?.sportEligibility ?? picksData?.summary.sportEligibility
  const eligibleSports = sportEligibility?.eligibleSports ?? []
  const excludedRows = sportEligibility?.excludedRows ?? 0
  const excludedSports = sportEligibility?.excludedSports ?? []
  const freshness = picksData?.freshnessSummary ?? picksData?.summary.freshnessSummary
  const topSignals = picksData?.topSignals ?? picksData?.summary.topSignals
  const bySport = useMemo(() => {
    const groups = new Map<string, ProbabilityPick[]>()
    for (const pick of picksData?.picks ?? []) {
      groups.set(pick.sport, [...(groups.get(pick.sport) ?? []), pick])
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [picksData?.picks])

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">Picks</p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">Probability Picks V2</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Projection Only / No Recommendation. Explore stored model probability, confidence, quality, freshness and certification evidence without changing model outputs.</p>
            <p className="mt-2 max-w-3xl text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Sport eligibility: MLB certified limited. Uncertified sports are excluded from rankings and reported as insufficient certification.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black uppercase md:min-w-[420px]">
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Picks<span className="block text-xl text-white">{picksData?.summary.picksGenerated ?? 0}</span></p>
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Parlays<span className="block text-xl text-white">{parlaysData?.summary.parlaysGenerated ?? 0}</span></p>
            <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-400">Calls<span className="block text-xl text-white">0</span></p>
          </div>
        </div>

        <div className="mt-5">
          <ProductStatusBanner
            title="Projection Only"
            detail="This page ranks model outcomes for review. It does not attach market prices, size positions, or turn a high-probability row into a recommendation."
            tone="blue"
          />
        </div>

        {!loading && !error && picksData && (
          <section id="today-overview" className="mt-5 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ProductStatusBadge tone={picksData.briefingContext?.outlook === 'Skip Today' ? 'gray' : 'yellow'}>
                  {picksData.briefingContext?.outlook ?? 'Review Manually'}
                </ProductStatusBadge>
                <ProductStatusBadge tone="blue">Projection Only</ProductStatusBadge>
                <ProductStatusBadge tone="gray">No Recommendation</ProductStatusBadge>
              </div>
              <h2 className="mt-3 text-xl font-black text-white">Today Overview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {picksData.summary.picksGenerated > 0
                  ? `${picksData.summary.picksGenerated} qualified projection-only rows are available across ${eligibleSports.length ? eligibleSports.map(labelize).join(', ') : 'no certified sport'}.`
                  : "Current projections do not meet today's probability, confidence, and data-quality requirements."}
              </p>
              {picksData.briefingContext?.mainWarning ? <p className="mt-2 text-sm text-amber-200">Main warning: {labelize(picksData.briefingContext.mainWarning)}</p> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Qualified Opportunities" value={picksData.summary.picksGenerated} detail="Rows passing the selected filters and sport certification." />
              <SummaryCard label="Eligible Sports" value={eligibleSports.length ? eligibleSports.map(labelize).join(', ') : 'None'} detail="Only these sports can appear in rankings and parlays." />
              <SummaryCard label="Excluded Sports" value={excludedSports.length ? excludedSports.map(labelize).join(', ') : 'None'} detail={`${excludedRows} rows excluded by certification or readiness.`} />
              <SummaryCard label="Data Health" value={freshnessLabel(freshness?.status)} detail={`Latest generated: ${productDateTime(freshness?.latestGeneratedAt, 'Not available')}`} />
              <SummaryCard label="Model Health" value={topSignals?.highestQuality ? Math.round(topSignals.highestQuality.quality) : 'N/A'} detail="Highest current quality signal from qualified rows." />
              <SummaryCard label="Warnings" value={picksData.warnings.length} detail={picksData.warnings[0] ? labelize(picksData.warnings[0]) : 'No major warning in the current response.'} />
              <SummaryCard label="Sport Status" value={sportEligibility ? Object.keys(sportEligibility.details).length : 0} detail="Certified and not-ready sports are separated below." />
              <SummaryCard label="Next Steps" value="Inspect" detail="Open the strongest signal, supporting projection, Current Board, or Performance evidence." />
            </div>
          </section>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-bold uppercase text-slate-400">
            Sport
            <select value={sport} onChange={(event) => setSport(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">All Eligible Sports</option>
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
          <label className="text-xs font-bold uppercase text-slate-400">
            Maximum Risk
            <select value={maxRisk} onChange={(event) => setMaxRisk(event.target.value as ProbabilityPickRisk | 'all')} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">Any Risk</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium Or Lower</option>
              <option value="HIGH">High Or Lower</option>
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Starter Status
            <select value={starterStatus} onChange={(event) => setStarterStatus(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">Any Starter</option>
              <option value="confirmed">Confirmed</option>
              <option value="probable">Probable</option>
              <option value="projected">Projected</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Data Freshness
            <select value={dataFreshness} onChange={(event) => setDataFreshness(event.target.value as ProbabilityFreshnessSummary['status'] | 'all')} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">Any Freshness</option>
              <option value="FRESH">Fresh</option>
              <option value="AGING">Aging</option>
              <option value="STALE">Stale</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Certification Level
            <select value={certificationLevel} onChange={(event) => setCertificationLevel(event.target.value as ProbabilitySportEligibilityStatus | 'all')} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white">
              <option value="all">Any Eligible Level</option>
              <option value="CERTIFIED_LIMITED">Certified Limited</option>
              <option value="CERTIFIED_ACTIVE">Certified Active</option>
              <option value="PREVIEW">Preview</option>
            </select>
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white" aria-label="Sort probability picks">
              <option value="score">Default Display Order</option>
              <option value="probability">Probability</option>
              <option value="confidence">Confidence</option>
              <option value="quality">Quality</option>
              <option value="stability">Stability</option>
              <option value="freshness">Freshness</option>
              <option value="eventStart">Event Start</option>
            </select>
          </label>
          <div className="flex self-end rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button onClick={() => setActiveTab('picks')} className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === 'picks' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}`}>Picks</button>
            <button onClick={() => setActiveTab('parlays')} className={`rounded-md px-4 py-2 text-sm font-black ${activeTab === 'parlays' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}`}>Parlays</button>
          </div>
        </div>

        {error && <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-950/30 p-4 text-sm font-bold text-rose-100">{error}</div>}
        {loading && <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm font-bold text-slate-300">Loading projection rankings...</div>}
        {!loading && !error && (
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
            <p className="font-black text-white">Probability means estimated outcome likelihood. Confidence means trust in that estimate. Quality means completeness and reliability of the inputs.</p>
            <p className="mt-1">Risk captures uncertainty, volatility, missing information and dependency exposure. Stability blends confidence, quality and freshness for display review only. Selected sort: {labelize(sort)}.</p>
            <p className="mt-1">Eligible sports: {eligibleSports.length ? eligibleSports.map(labelize).join(', ') : 'None'}. Excluded rows: {excludedRows}. Provider calls: 0. Remote mutations: 0.</p>
          </div>
        )}

        {!loading && !error && picksData && (
          <section id="top-signals" className="mt-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Top Probability Signals</p>
                <h2 className="mt-1 text-xl font-black text-white">Strongest By Dimension</h2>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Generated {productDateTime(picksData.generatedAt)}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SignalCard title="Highest Probability" pick={topSignals?.highestProbability} metric="probability" />
              <SignalCard title="Highest Confidence" pick={topSignals?.highestConfidence} metric="confidence" />
              <SignalCard title="Highest Quality" pick={topSignals?.highestQuality} metric="quality" />
              <SignalCard title="Most Stable" pick={topSignals?.mostStable} metric="stability" />
              <SignalCard title="Best Data Quality" pick={topSignals?.bestDataQuality} metric="quality" />
            </div>
          </section>
        )}

        {!loading && !error && picksData && (
          <section id="by-sport" className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">By Sport</p>
              <h2 className="mt-1 text-xl font-black text-white">Certified Sport Groups</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {bySport.length ? bySport.map(([sportKey, picks]) => {
                  const detail = sportEligibility?.details[sportKey]
                  return (
                    <article key={sportKey} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-black text-white">{detail?.displayName ?? labelize(sportKey)}</h3>
                        <ProductStatusBadge tone="green">{labelize(detail?.status ?? 'CERTIFIED_LIMITED')}</ProductStatusBadge>
                      </div>
                      <p className="mt-3 text-2xl font-black text-white">{picks.length}</p>
                      <p className="text-sm text-slate-400">Qualified projection-only rows.</p>
                    </article>
                  )
                }) : <EmptyState title="No qualified picks" detail="Current projections do not meet today's probability, confidence, and data-quality requirements." />}
              </div>
            </div>
            <div id="not-ready-today" className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Sports Not Ready Today</p>
              <h2 className="mt-1 text-xl font-black text-white">Blocked Or Not Certified</h2>
              <div className="mt-4 space-y-3">
                {excludedSports.length ? excludedSports.map((sportKey) => {
                  const detail = sportEligibility?.details[sportKey]
                  return (
                    <article key={sportKey} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                      <p className="font-black text-white">{detail?.displayName ?? labelize(sportKey)}</p>
                      <p className="mt-1 text-sm text-slate-300">{labelize(detail?.status ?? 'ENGINE_NOT_CERTIFIED')}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{detail?.reason ?? 'This sport has stored predictions, but its engine is not certified for Probability Picks.'}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-500">Next: {detail?.nextRequirement ?? 'Complete sport-specific certification.'}</p>
                    </article>
                  )
                }) : <EmptyState title="No blocked sport rows in current response" detail="No uncertified sport rows were present after the selected filters." />}
              </div>
            </div>
          </section>
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Generated {productDateTime(picksData?.generatedAt)}</p>
              </div>
              {!section?.picks.length && <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">No qualified picks satisfy today's probability filters. Why: either no eligible MLB row meets the selected thresholds or the sport is not certified for ranking.</div>}
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
                <option value="MULTI_SPORT" disabled={!parlaysData?.summary.multiSportAvailable}>Multi-Sport</option>
              </select>
            </div>
            <ProductStatusBanner
              title={parlaysData?.summary.multiSportAvailable ? 'Multi-Sport Available' : 'MLB Only Available'}
              detail={parlaysData?.presentation?.scopes.find((item) => item.value === 'MULTI_SPORT')?.reason ?? 'Multi-sport requires more than one certified eligible sport.'}
              tone={parlaysData?.summary.multiSportAvailable ? 'green' : 'yellow'}
            />
            {!parlaysData?.parlays.length && (
              <EmptyState
                title="No projection-only parlay combinations"
                detail={(parlaysData?.presentation?.aggregateBlockers ?? [parlaysData?.presentation?.emptyState ?? 'No sufficiently independent combination meets the current parlay requirements.']).join(' ')}
              />
            )}
            {parlaysData?.parlays.map((parlay) => <ParlayCard key={parlay.id} parlay={parlay} />)}
          </section>
        )}

        {!loading && !error && (
          <section id="methodology" className="mt-8 rounded-lg border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Methodology And Definitions</p>
            <h2 className="mt-1 text-xl font-black text-white">How To Read Probability Picks</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Probability" value="Likelihood" detail="Estimated likelihood of the selected outcome." />
              <SummaryCard label="Confidence" value="Trust" detail="How strongly the system trusts the probability estimate." />
              <SummaryCard label="Quality" value="Completeness" detail="Completeness and reliability of the underlying data and features." />
              <SummaryCard label="Risk" value="Uncertainty" detail="Uncertainty, volatility, missing information, and dependency exposure." />
              <SummaryCard label="Stability" value="Consistency" detail="Consistency of underlying projection inputs and model evidence." />
              <SummaryCard label="Certification" value="Eligibility" detail="Whether the sport and engine are approved for the current product mode." />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
