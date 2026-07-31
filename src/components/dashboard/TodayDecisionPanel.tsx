'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type Tone = 'green' | 'yellow' | 'blue' | 'red' | 'gray'
type Verdict = 'BET' | 'REVIEW' | 'WAIT' | 'PASS'

type Selector = {
  status?: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  eventId?: string | null
  matchup?: string | null
  market?: string | null
  marketLabel?: string | null
  selection?: string | null
  line?: number | null
  metricName?: string
  metricValue?: number | null
  modelProbability?: number | null
  confidence?: number | null
  priceState?: string
  americanOdds?: number | null
  sportsbook?: string | null
  impliedProbability?: number | null
  edge?: number | null
  expectedValue?: number | null
  freshness?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
  blocker?: string | null
  rankingReason?: string
}

type TodayResponse = {
  success: boolean
  status?: 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'UNAVAILABLE'
  generatedAt?: string
  operatingDate?: string
  currentGames?: number
  upcomingGames?: number
  gamesWaitingForOdds?: number
  gamesReadyForAnalysis?: number
  predictionCandidates?: number
  officialPicks?: number
  freshness?: 'fresh' | 'partial' | 'stale' | 'empty'
  nextAction?: string
  latestOddsTimestamp?: string | null
  nextActionAt?: string | null
  summary?: {
    recommendation?: string
    aiBriefing?: string
    marketPrices?: string
    nextSlate?: string
  }
  groundedOpportunitySummary?: {
    groundedRows?: number
    groundedPricedOpportunities?: number
    actionableOpportunities?: number
    officialPicks?: number
    reasonCounts?: Record<string, number>
  }
  warnings?: string[]
  errors?: Array<{ dependency?: string; message?: string; critical?: boolean }>
  timing?: { totalMs?: number; slowDependencies?: string[] }
  viewModel?: {
    generatedAt?: string
    selectors?: {
      highestProjectedOutcome?: Selector
      highestRankedPricedMarket?: Selector
      mostLikelySummary?: { selector?: Selector }
      bestAvailableValue?: Selector
      bestValueSemantics?: {
        candidatesWithPositiveEv?: number
        candidatesPassingPolicy?: number
        primaryRejectionReason?: string
      }
      currentBoardSummary?: {
        candidates?: number
        displayableMarkets?: number
        directlyPricedCandidates?: number
      }
      marketFreshnessSummary?: {
        state?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
        latestOddsTimestamp?: string | null
        staleBlockers?: number
      }
      gameCoverageSummary?: {
        gamesWithNoStoredOdds?: number
        gamesWithPartialCoverage?: number
      }
    }
  }
  sections?: {
    officialPicks?: { status?: string; data?: unknown[]; reason?: string | null }
    groundedOpportunities?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    mostLikely?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    bestValue?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
    topOpportunity?: { status?: string; data?: Record<string, unknown> | null; reason?: string | null }
  }
  providerCallsMade?: number
  remoteMutationsMade?: number
}

type Opportunity = {
  source: string
  status: 'official' | 'not_official'
  sport: string
  event: string
  selection: string
  market: string
  odds: number | null
  sportsbook: string
  modelProbability: number | null
  impliedProbability: number | null
  edge: number | null
  expectedValue: number | null
  confidence: number | null
  freshness: string
  dataQuality: string
  reason: string
  updatedAt: string | null
}

const toneClasses: Record<Tone, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  gray: 'border-slate-700 bg-slate-900/80 text-slate-100',
}

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${toneClasses[tone]}`}>{children}</span>
}

function labelize(value: unknown, fallback = 'Not yet available') {
  const text = String(value ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return fallback
  return text.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function pct(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  return `${percent.toFixed(1)}%`
}

function odds(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  return parsed > 0 ? `+${parsed}` : String(parsed)
}

function signedPct(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not yet available'
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`
}

function dateTime(value: unknown, fallback = 'Update time unavailable') {
  if (!value) return fallback
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return fallback
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function toneForVerdict(verdict: Verdict): Tone {
  if (verdict === 'BET') return 'green'
  if (verdict === 'REVIEW' || verdict === 'WAIT') return 'yellow'
  return 'gray'
}

function selectorAvailable(selector: Selector | undefined) {
  return Boolean(selector && selector.status === 'AVAILABLE' && selector.selection)
}

function opportunityFromSelector(source: string, selector: Selector, data: TodayResponse): Opportunity {
  const official = Number(data.officialPicks ?? 0) > 0 && source === 'Official Pick'
  return {
    source,
    status: official ? 'official' : 'not_official',
    sport: 'MLB',
    event: labelize(selector.matchup, 'Event not yet available'),
    selection: labelize(selector.selection, 'Selection not yet available'),
    market: labelize(selector.marketLabel ?? selector.market, 'Market not yet available'),
    odds: selector.americanOdds ?? null,
    sportsbook: labelize(selector.sportsbook, 'Sportsbook unavailable'),
    modelProbability: selector.modelProbability ?? null,
    impliedProbability: selector.impliedProbability ?? null,
    edge: selector.edge ?? null,
    expectedValue: selector.expectedValue ?? selector.metricValue ?? null,
    confidence: selector.confidence ?? null,
    freshness: labelize(selector.freshness ?? selector.priceState, 'Freshness unavailable'),
    dataQuality: selector.status === 'AVAILABLE' ? 'Stored market evidence' : 'Evidence incomplete',
    reason: official
      ? 'This opportunity is marked official by the existing production policy.'
      : labelize(selector.blocker ?? selector.rankingReason ?? data.summary?.recommendation, 'Not an Official Pick under the existing production policy.'),
    updatedAt: data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? data.generatedAt ?? null,
  }
}

function bestOpportunity(data: TodayResponse): Opportunity | null {
  const selectors = data.viewModel?.selectors
  const officialRow = data.sections?.officialPicks?.data?.[0] as Record<string, unknown> | undefined
  if (officialRow && Number(data.officialPicks ?? 0) > 0) {
    return {
      source: 'Official Pick',
      status: 'official',
      sport: labelize(officialRow.sportKey ?? officialRow.sport ?? 'MLB'),
      event: labelize(officialRow.matchup ?? officialRow.eventLabel, 'Event not yet available'),
      selection: labelize(officialRow.selection, 'Selection not yet available'),
      market: labelize(officialRow.marketLabel ?? officialRow.market, 'Market not yet available'),
      odds: Number.isFinite(Number(officialRow.americanOdds)) ? Number(officialRow.americanOdds) : null,
      sportsbook: labelize(officialRow.sportsbook, 'Sportsbook unavailable'),
      modelProbability: Number.isFinite(Number(officialRow.modelProbability)) ? Number(officialRow.modelProbability) : null,
      impliedProbability: Number.isFinite(Number(officialRow.marketImpliedProbability ?? officialRow.impliedProbability)) ? Number(officialRow.marketImpliedProbability ?? officialRow.impliedProbability) : null,
      edge: Number.isFinite(Number(officialRow.edgePercentagePoints ?? officialRow.edge)) ? Number(officialRow.edgePercentagePoints ?? officialRow.edge) : null,
      expectedValue: Number.isFinite(Number(officialRow.expectedValuePercent ?? officialRow.expectedValue)) ? Number(officialRow.expectedValuePercent ?? officialRow.expectedValue) : null,
      confidence: Number.isFinite(Number(officialRow.confidence)) ? Number(officialRow.confidence) : null,
      freshness: labelize(officialRow.freshnessStatus, 'Freshness unavailable'),
      dataQuality: 'Official Pick evidence',
      reason: 'This satisfies the existing Official Pick production policy.',
      updatedAt: String(officialRow.timestamps && typeof officialRow.timestamps === 'object' ? (officialRow.timestamps as Record<string, unknown>).oddsSnapshotAt ?? data.generatedAt : data.generatedAt),
    }
  }
  if (selectorAvailable(selectors?.bestAvailableValue)) return opportunityFromSelector('Best Value', selectors!.bestAvailableValue!, data)
  if (selectorAvailable(selectors?.highestRankedPricedMarket)) return opportunityFromSelector('Highest Ranked Priced Market', selectors!.highestRankedPricedMarket!, data)
  if (selectorAvailable(selectors?.mostLikelySummary?.selector)) return opportunityFromSelector('Most Likely', selectors!.mostLikelySummary!.selector!, data)
  if (selectorAvailable(selectors?.highestProjectedOutcome)) return opportunityFromSelector('Highest Projected Outcome', selectors!.highestProjectedOutcome!, data)

  const grounded = data.sections?.groundedOpportunities?.data?.[0]
  if (!grounded) return null
  return {
    source: 'Grounded Opportunity',
    status: 'not_official',
    sport: labelize(grounded.sport ?? grounded.sportKey ?? 'MLB'),
    event: labelize(grounded.matchup ?? grounded.eventLabel, 'Event not yet available'),
    selection: labelize(grounded.selection, 'Selection not yet available'),
    market: labelize(grounded.marketLabel ?? grounded.market, 'Market not yet available'),
    odds: Number.isFinite(Number(grounded.odds ?? grounded.americanOdds)) ? Number(grounded.odds ?? grounded.americanOdds) : null,
    sportsbook: labelize(grounded.sportsbook, 'Sportsbook unavailable'),
    modelProbability: Number.isFinite(Number(grounded.modelProbability ?? grounded.probability)) ? Number(grounded.modelProbability ?? grounded.probability) : null,
    impliedProbability: Number.isFinite(Number(grounded.impliedProbability)) ? Number(grounded.impliedProbability) : null,
    edge: Number.isFinite(Number(grounded.edge)) ? Number(grounded.edge) : null,
    expectedValue: Number.isFinite(Number(grounded.expectedValue)) ? Number(grounded.expectedValue) : null,
    confidence: Number.isFinite(Number(grounded.confidence)) ? Number(grounded.confidence) : null,
    freshness: labelize(grounded.freshness, 'Freshness unavailable'),
    dataQuality: 'Stored grounded evidence',
    reason: labelize(grounded.reasonNotOfficial ?? grounded.blocker ?? grounded.why, 'Not an Official Pick under the existing production policy.'),
    updatedAt: String(grounded.updatedAt ?? grounded.oddsTimestamp ?? data.generatedAt ?? ''),
  }
}

function verdictFor(data: TodayResponse, opportunity: Opportunity | null): { label: Verdict; detail: string; officialStatus: string } {
  const officialPicks = Number(data.officialPicks ?? 0)
  const freshness = String(data.freshness ?? data.viewModel?.selectors?.marketFreshnessSummary?.state ?? '').toLowerCase()
  const waitingForOdds = Number(data.gamesWaitingForOdds ?? 0)
  if (officialPicks > 0) return { label: 'BET', detail: `${officialPicks} Official Pick${officialPicks === 1 ? '' : 's'} passed the existing production gates.`, officialStatus: 'Official Pick available' }
  if (freshness.includes('stale') || waitingForOdds > 0) return { label: 'WAIT', detail: waitingForOdds > 0 ? 'The slate is waiting on market prices before action should be considered.' : 'Stored market evidence is stale, so the safest conclusion is to wait for refresh.', officialStatus: 'No Official Pick' }
  if (opportunity) return { label: 'REVIEW', detail: 'A best available opportunity exists, but it is not an Official Pick under the current policy.', officialStatus: 'No Official Pick' }
  return { label: 'PASS', detail: 'No eligible supported opportunity is currently visible from the Today contract.', officialStatus: 'No Official Pick' }
}

function reasonList(data: TodayResponse, opportunity: Opportunity | null) {
  const why: string[] = []
  const risks: string[] = []
  if (opportunity?.modelProbability !== null && opportunity?.modelProbability !== undefined) why.push(`Model probability is available at ${pct(opportunity.modelProbability)}.`)
  if (opportunity?.edge !== null && opportunity?.edge !== undefined && Number(opportunity.edge) > 0) why.push(`Model edge is positive at ${signedPct(opportunity.edge)}.`)
  if (opportunity?.expectedValue !== null && opportunity?.expectedValue !== undefined && Number(opportunity.expectedValue) > 0) why.push(`Expected value is positive at ${signedPct(opportunity.expectedValue)}.`)
  if (opportunity?.freshness && !opportunity.freshness.toLowerCase().includes('unavailable')) why.push(`Freshness state is ${opportunity.freshness}.`)

  if (opportunity?.status !== 'official') risks.push(opportunity?.reason ?? 'This is not an Official Pick.')
  if (String(data.freshness ?? '').toLowerCase() === 'stale') risks.push('Market evidence is stale.')
  if (Number(data.gamesWaitingForOdds ?? 0) > 0) risks.push(`${data.gamesWaitingForOdds} game${data.gamesWaitingForOdds === 1 ? '' : 's'} are waiting for stored odds.`)
  for (const warning of data.warnings ?? []) risks.push(labelize(warning))

  return {
    why: why.length ? why.slice(0, 3) : ['The Today contract has no extra explanation fields for this opportunity yet.'],
    risks: risks.length ? risks.slice(0, 3) : ['No additional risk text was returned by the current Today contract.'],
  }
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </article>
  )
}

function Skeleton() {
  return (
    <section className="space-y-5" aria-busy="true" aria-label="Loading today's decision">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Today</p>
        <div className="mt-4 h-10 max-w-md rounded bg-slate-800" />
        <div className="mt-3 h-4 max-w-2xl rounded bg-slate-800" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="h-80 rounded-lg border border-slate-800 bg-slate-900/70" />
        <div className="h-80 rounded-lg border border-slate-800 bg-slate-900/70" />
      </div>
    </section>
  )
}

export default function TodayDecisionPanel() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/dashboard/today', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok) throw new Error(json?.error ?? 'Today is temporarily unavailable.')
        if (active) setData(json)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Today is temporarily unavailable.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const opportunity = useMemo(() => data ? bestOpportunity(data) : null, [data])
  const verdict = useMemo(() => data ? verdictFor(data, opportunity) : null, [data, opportunity])
  const reasons = useMemo(() => data ? reasonList(data, opportunity) : { why: [], risks: [] }, [data, opportunity])

  if (loading) return <Skeleton />
  if (error || !data || !verdict) {
    return (
      <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
        <p className="text-xs font-black uppercase tracking-[0.24em]">Today unavailable</p>
        <h1 className="mt-2 text-3xl font-black text-white">The daily decision shell could not load.</h1>
        <p className="mt-2 text-sm leading-6">{error ?? 'The Today contract did not return usable data.'}</p>
        <a href="/ai-operations" className="mt-4 inline-flex rounded-lg border border-amber-300/40 px-4 py-2 text-sm font-black text-amber-50 outline-none hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-200">Open Operations</a>
      </section>
    )
  }

  const verdictTone = toneForVerdict(verdict.label)
  const freshness = labelize(data.viewModel?.selectors?.marketFreshnessSummary?.state ?? data.freshness, 'Freshness unavailable')
  const alternatives = [
    ['Most Likely', data.viewModel?.selectors?.mostLikelySummary?.selector?.selection, '/most-likely'],
    ['Best Value', data.viewModel?.selectors?.bestAvailableValue?.selection, '/best-value'],
    ['Performance', 'Trust and results', '/performance'],
  ] as const

  return (
    <section className="space-y-5" data-b2-today-shell="true">
      <div className={`rounded-lg border p-5 md:p-6 ${toneClasses[verdictTone]}`} data-b2-verdict-label={verdict.label}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-300">Today&apos;s Verdict</p>
            <h1 className="mt-2 text-5xl font-black tracking-normal text-white">{verdict.label}</h1>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-slate-100">{verdict.detail}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={verdictTone}>{verdict.officialStatus}</Badge>
            <Badge tone={opportunity?.status === 'official' ? 'green' : 'yellow'}>
              {opportunity?.status === 'official' ? 'Official Pick' : 'Best Available - Not Official'}
            </Badge>
            <Badge tone="blue">Updated {dateTime(data.generatedAt)}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 md:p-6" data-b2-best-opportunity="true">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">Today&apos;s Best Opportunity</p>
              {opportunity ? (
                <>
                  <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">{opportunity.selection}</h2>
                  <p className="mt-2 text-base font-bold text-slate-200">{opportunity.event} / {opportunity.market}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{opportunity.reason}</p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">No eligible opportunity visible.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    The Today contract did not expose a supported market opportunity. This state does not fabricate a pick.
                  </p>
                </>
              )}
            </div>
            <Badge tone={opportunity?.status === 'official' ? 'green' : opportunity ? 'yellow' : 'gray'}>
              {opportunity?.status === 'official' ? 'Official Pick' : opportunity ? 'Best Available - Not Official' : 'No Opportunity'}
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric label="Current Odds" value={odds(opportunity?.odds)} detail={opportunity?.sportsbook} />
            <SummaryMetric label="Model Probability" value={pct(opportunity?.modelProbability)} />
            <SummaryMetric label="Implied Probability" value={pct(opportunity?.impliedProbability)} />
            <SummaryMetric label="Confidence" value={pct(opportunity?.confidence)} />
            <SummaryMetric label="Edge" value={signedPct(opportunity?.edge)} />
            <SummaryMetric label="Expected Value" value={signedPct(opportunity?.expectedValue)} />
            <SummaryMetric label="Freshness" value={opportunity?.freshness ?? freshness} detail={dateTime(opportunity?.updatedAt, 'Odds update unavailable')} />
            <SummaryMetric label="Data Quality" value={opportunity?.dataQuality ?? 'Not yet available'} />
          </div>
        </article>

        <aside className="grid gap-4">
          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b2-conviction-shell="true">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">AI Conviction</p>
            <h3 className="mt-2 text-2xl font-black text-white">Presentation shell</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">B2 does not create a new conviction formula. B5 will derive categorical conviction from certified fields.</p>
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b2-actionability-shell="true">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Actionability</p>
            <h3 className="mt-2 text-2xl font-black text-white">{verdict.label === 'WAIT' ? 'WAIT' : verdict.label === 'BET' ? 'ACTIONABLE' : 'REVIEW FIRST'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">This state is backed only by the current verdict and freshness context. Later phases will add a richer presentation model.</p>
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5" data-b2-readiness-shell="true">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Official Pick Readiness</p>
            <h3 className="mt-2 text-2xl font-black text-white">{opportunity?.status === 'official' ? 'Official' : 'Not Official'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Structured gate progress is deferred to B3. Current blocker context: {opportunity?.status === 'official' ? 'all existing policy gates passed' : opportunity?.reason ?? 'no structured gate rows available'}.
            </p>
          </article>
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-black text-white">Why This Opportunity</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
            {reasons.why.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-black text-white">Main Risks</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
            {reasons.risks.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-black text-white">What Would Change My Mind?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Could improve if stored odds become fresh, missing market evidence appears, or the existing policy blockers clear. This does not promise that an Official Pick will be created.
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Next action: {labelize(data.nextAction, 'Waiting for next lifecycle update')}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-black text-white">Alternatives Preview</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {alternatives.map(([label, value, href]) => (
              <a key={label} href={href} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 outline-none hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-300">
                <p className="text-sm font-black text-white">{label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{labelize(value, 'Open full view')}</p>
              </a>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetric label="Freshness" value={freshness} detail={dateTime(data.latestOddsTimestamp ?? data.generatedAt)} />
        <SummaryMetric label="Today API" value={labelize(data.status, 'Available')} detail={`Provider calls ${data.providerCallsMade ?? 0}; mutations ${data.remoteMutationsMade ?? 0}`} />
        <SummaryMetric label="Performance Context" value="Compact Link" detail="Open Performance for results, calibration and trust history." />
      </div>
    </section>
  )
}
