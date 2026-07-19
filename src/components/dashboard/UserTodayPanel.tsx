'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type CategoryCounts = {
  official: number
  aiLeans: number
  watchlist: number
  avoid: number
}

type TodayResponse = {
  success: boolean
  generatedAt: string
  operatingDate: string
  nextSlateDate: string | null
  currentGames: number
  upcomingGames: number
  finalGames: number
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  marketIntelligence?: CategoryCounts
  freshness: 'fresh' | 'stale' | 'empty'
  nextAction: string
  summary: {
    recommendation: string
    aiBriefing: string
    currentOperatingDay: string
    nextSlate: string
    marketPrices: string
  }
  currentGameCards: Array<Record<string, any>>
  nextSlateGames: Array<Record<string, any>>
}

type TopOpportunity = {
  title?: string
  matchup?: string
  marketLabel?: string
  selection?: string
  probability?: number
  confidence?: number
  statusLabel?: string
  opportunityCategory?: string
  marketIntelligenceCategory?: 'official' | 'ai_lean' | 'watchlist' | 'avoid'
  scheduledTime?: string
  gameTime?: string
}

type TopOpportunityResponse = {
  success: boolean
  topPick?: { candidate?: TopOpportunity }
  opportunities?: TopOpportunity[]
}

const cardMotion = 'transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl hover:shadow-black/20'

function dateText(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function timeText(value: unknown) {
  if (!value) return 'Time pending'
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return 'Time pending'
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  })
}

function humanStatus(value: unknown) {
  const raw = String(value ?? '').toLowerCase()
  if (raw.includes('in_progress') || raw.includes('started') || raw.includes('live')) return 'Live'
  if (raw.includes('final') || raw.includes('complete')) return 'Final'
  if (raw.includes('scheduled')) return 'Scheduled'
  if (raw.includes('waiting')) return 'Waiting'
  return 'Tracking'
}

function simpleAction(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('sync final')) return 'Waiting for final scores.'
  if (lower.includes('morning')) return 'Next check is tomorrow morning.'
  if (lower.includes('odds')) return 'Waiting for updated betting odds.'
  if (lower.includes('refresh')) return 'The AI will refresh when odds update.'
  return text.replaceAll('_', ' ')
}

function categoryTone(category?: string): 'green' | 'yellow' | 'blue' | 'red' | 'gray' {
  if (category === 'official' || category === 'Official') return 'green'
  if (category === 'ai_lean' || category === 'AI Lean') return 'yellow'
  if (category === 'watchlist' || category === 'Watchlist') return 'blue'
  if (category === 'avoid' || category === 'Avoid') return 'red'
  return 'gray'
}

function toneClasses(tone: 'green' | 'yellow' | 'blue' | 'red' | 'gray') {
  return {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    red: 'border-red-500/30 bg-red-500/10 text-red-100',
    gray: 'border-slate-700 bg-slate-900/80 text-slate-100',
  }[tone]
}

function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${toneClasses(tone)}`}>{children}</span>
}

function formatPercent(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not available'
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  if (percent < 0) return 'Not available'
  return `${Math.min(100, percent).toFixed(1)}%`
}

function percentNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
  if (percent < 0) return null
  return Math.min(100, percent)
}

function meterColor(tone: 'green' | 'yellow' | 'blue' | 'red' | 'gray') {
  return {
    green: 'bg-emerald-400',
    yellow: 'bg-amber-300',
    blue: 'bg-sky-300',
    red: 'bg-red-300',
    gray: 'bg-slate-400',
  }[tone]
}

function Meter({ label, value, tone = 'blue' }: { label: string; value: unknown; tone?: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }) {
  const percent = percentNumber(value)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="text-sm font-black text-white">{formatPercent(value)}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
        {percent !== null && <div className={`h-full rounded-full ${meterColor(tone)} transition-all duration-700 ease-out`} style={{ width: `${percent}%` }} />}
      </div>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6">
      <p className="text-base font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

function QuickNumber({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'blue' | 'red' }) {
  const color = {
    green: 'text-emerald-200',
    yellow: 'text-amber-200',
    blue: 'text-sky-200',
    red: 'text-red-200',
  }[tone]
  return (
    <div className={`rounded-lg border border-white/10 bg-slate-950/70 p-4 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function marketSentiment(data: TodayResponse, counts: CategoryCounts) {
  if (counts.official > 0) return { label: 'AGGRESSIVE', tone: 'green' as const }
  if (counts.aiLeans > 0 || data.gamesReadyForAnalysis > 0 || data.predictionCandidates > 0) return { label: 'SELECTIVE', tone: 'yellow' as const }
  if (data.gamesWaitingForOdds > 0 || data.freshness === 'empty') return { label: 'WAITING', tone: 'blue' as const }
  return { label: 'DEFENSIVE', tone: 'red' as const }
}

function DecisionHero({ data, counts }: { data: TodayResponse; counts: CategoryCounts }) {
  const decision = data.officialPicks > 0
    ? 'BET TODAY'
    : counts.aiLeans > 0 || counts.watchlist > 0 || data.gamesWaitingForOdds > 0 || data.upcomingGames > 0
      ? 'WAIT TODAY'
      : 'STAY OUT'
  const tone = data.officialPicks > 0 ? 'green' : counts.aiLeans > 0 ? 'yellow' : data.gamesWaitingForOdds > 0 || data.upcomingGames > 0 ? 'blue' : 'gray'
  const sentiment = marketSentiment(data, counts)
  const gamesToday = data.currentGames || data.upcomingGames
  const summary = data.officialPicks > 0
    ? `${data.officialPicks} Official Pick${data.officialPicks === 1 ? '' : 's'} meet the standard.`
    : counts.aiLeans > 0
      ? `${counts.aiLeans} AI Lean${counts.aiLeans === 1 ? '' : 's'} are available, but no Official Pick.`
      : data.gamesWaitingForOdds > 0
        ? 'New odds are needed before picks can be finalized.'
        : 'No play meets the Official standard right now.'

  return (
    <section className={`overflow-hidden rounded-lg border p-5 md:p-6 ${toneClasses(tone)} ${cardMotion}`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">AI Market Outlook</p>
          <h2 className="mt-2 text-4xl font-black tracking-normal text-white md:text-6xl">{decision}</h2>
          <p className="mt-3 max-w-2xl text-base font-semibold leading-6 text-slate-100">{summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={sentiment.tone}>Market Mood: {sentiment.label}</Badge>
            <Badge tone="gray">Updated {timeText(data.generatedAt)}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-96">
          <QuickNumber label="Official Picks" value={counts.official} tone="green" />
          <QuickNumber label="Games Today" value={gamesToday} tone="blue" />
          <a href="/most-likely" className="col-span-2 inline-flex items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white sm:col-span-1">View Opportunities</a>
        </div>
      </div>
    </section>
  )
}

function CategoryCard({ title, value, tone, icon, href, status, tooltip }: { title: string; value: number; tone: 'green' | 'yellow' | 'blue' | 'red'; icon: string; href: string; status: string; tooltip: string }) {
  return (
    <article className={`rounded-lg border p-5 ${toneClasses(tone)} ${cardMotion}`} title={tooltip}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 text-sm font-black text-white">{icon}</span>
          <p className="mt-4 text-sm font-black text-white">{title}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${meterColor(tone)}`} />
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">{status}</p>
          </div>
        </div>
        <p className="text-4xl font-black text-white">{value}</p>
      </div>
      <a href={href} className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 px-4 py-2 text-sm font-black text-white outline-none transition hover:bg-slate-950/80 focus-visible:ring-2 focus-visible:ring-white">View</a>
    </article>
  )
}

function fieldValue(value: unknown, fallback = 'Pending') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function TopOpportunityCard({ opportunity }: { opportunity: TopOpportunity | null }) {
  if (!opportunity) return <EmptyState title="Top AI Opportunity" detail="No opportunity is ready to display yet." />
  const category = opportunity.opportunityCategory ?? opportunity.statusLabel ?? 'Tracking'
  const tone = categoryTone(opportunity.marketIntelligenceCategory ?? category)

  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Top AI Opportunity</p>
          <h3 className="mt-3 text-3xl font-black text-white">{fieldValue(opportunity.matchup, 'Teams pending')}</h3>
        </div>
        <Badge tone={tone}>{category}</Badge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Market</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(opportunity.marketLabel)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Selection</p>
          <p className="mt-2 text-base font-black text-white">{fieldValue(opportunity.selection, opportunity.title ?? 'Pending')}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Category</p>
          <p className="mt-2 text-base font-black text-white">{category}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Game Time</p>
          <p className="mt-2 text-base font-black text-white">{timeText(opportunity.scheduledTime ?? opportunity.gameTime)}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Meter label="Probability" value={opportunity.probability} tone="blue" />
        <Meter label="Confidence" value={opportunity.confidence} tone={tone} />
      </div>
      <div className="mt-5">
        <a href="/most-likely" className="inline-flex rounded-full bg-white px-5 py-2 text-sm font-black text-slate-950 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-white">View Details</a>
      </div>
    </section>
  )
}

function confidenceLabel(value: number | null) {
  if (value === null) return 'Unavailable'
  if (value >= 85) return 'Very High'
  if (value >= 70) return 'High'
  if (value >= 50) return 'Moderate'
  return 'Low'
}

function AIConfidenceCard({ opportunity }: { opportunity: TopOpportunity | null }) {
  const confidence = percentNumber(opportunity?.confidence)
  const label = confidenceLabel(confidence)
  const tone = confidence === null ? 'gray' : confidence >= 70 ? 'green' : confidence >= 50 ? 'yellow' : 'red'
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">AI Confidence</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-black text-white">{confidence === null ? '--' : `${confidence.toFixed(1)}%`}</p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label="AI Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence ?? undefined}>
        {confidence !== null && <div className={`h-full rounded-full ${meterColor(tone)} transition-all duration-700 ease-out`} style={{ width: `${confidence}%` }} />}
      </div>
    </section>
  )
}

function categoryLabel(value: unknown) {
  const raw = String(value ?? '').toLowerCase()
  if (raw === 'official') return 'Official'
  if (raw === 'ai_lean') return 'AI Lean'
  if (raw === 'watchlist') return 'Watchlist'
  if (raw === 'avoid') return 'Avoid'
  return ''
}

function gameCategory(game: Record<string, any>) {
  const grounded = categoryLabel(game.marketIntelligenceCategory ?? game.opportunityCategory ?? game.recommendationCategory)
  if (grounded) return grounded
  if (game.oddsPresent === false) return 'Waiting'
  if (game.predictionReady === false) return 'Tracking'
  return 'Ready'
}

function GameCard({ game }: { game: Record<string, any> }) {
  const status = humanStatus(game.status)
  const aiCategory = gameCategory(game)
  const probability = percentNumber(game.probability)
  const statusTone = status === 'Final' ? 'gray' : status === 'Live' ? 'yellow' : 'blue'
  const categoryCardTone = categoryTone(aiCategory)
  const categoryBadgeTone = aiCategory === 'Waiting' ? 'yellow' : aiCategory === 'Tracking' || aiCategory === 'Ready' ? 'blue' : categoryCardTone

  return (
    <details className={`group rounded-lg border border-slate-800 bg-slate-950/70 p-4 ${cardMotion}`}>
      <summary className="list-none cursor-pointer">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.55fr_0.7fr_0.55fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold text-slate-500">{timeText(game.scheduledTime)}</p>
            <p className="mt-1 text-lg font-black text-white">{fieldValue(game.matchup, 'Matchup pending')}</p>
          </div>
          <Badge tone={statusTone}>{status}</Badge>
          <Badge tone={categoryBadgeTone}>{aiCategory}</Badge>
          <p className="text-sm font-black text-white">{probability === null ? '--' : `${probability.toFixed(1)}%`}</p>
          <span className="text-sm font-bold text-sky-300">Details</span>
        </div>
      </summary>
      <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2">
        <Meter label="Probability" value={game.probability} tone="blue" />
        <Meter label="Confidence" value={game.confidence} tone="green" />
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
          <p className="text-sm font-black text-white">AI Decision</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {game.oddsPresent === false
              ? 'Waiting for updated odds.'
              : game.predictionReady === false
                ? 'Tracking current market state.'
                : `${aiCategory} status from the current board.`}
          </p>
        </div>
      </div>
    </details>
  )
}

function ProgressPipeline({ data }: { data: TodayResponse }) {
  const steps = [
    { label: 'Schedule', mark: 'S', state: data.currentGames > 0 || data.upcomingGames > 0 ? 'Complete' : 'Waiting' },
    { label: 'Odds', mark: 'O', state: data.gamesWaitingForOdds > 0 || data.freshness === 'empty' ? 'Waiting' : 'Complete' },
    { label: 'Predictions', mark: 'P', state: data.predictionCandidates > 0 ? 'Complete' : data.gamesWaitingForOdds > 0 ? 'Waiting' : 'Updating' },
    { label: 'Picks', mark: 'R', state: data.officialPicks > 0 ? 'Complete' : data.predictionCandidates > 0 ? 'Not Due' : 'Waiting' },
    { label: 'Results', mark: 'F', state: data.finalGames > 0 ? 'Complete' : data.currentGames > 0 ? 'Not Due' : 'Waiting' },
  ]
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-5 ${cardMotion}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Today at a Glance</p>
          <h3 className="mt-1 text-xl font-black text-white">{dateText(data.operatingDate)}</h3>
        </div>
        <Badge tone="gray">{simpleAction(data.nextAction)}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => {
          const tone = step.state === 'Complete' ? 'green' : step.state === 'Updating' ? 'blue' : step.state === 'Not Due' ? 'gray' : 'yellow'
          return (
            <div key={step.label} className={`rounded-lg border border-slate-800 bg-slate-950/70 p-3 ${cardMotion}`} title={step.label}>
              <div className="flex items-center justify-between gap-2">
                <span aria-label={step.label} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black ${toneClasses(tone)}`}>{step.mark}</span>
                <Badge tone={tone}>{step.state}</Badge>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HealthCard({ data }: { data: TodayResponse }) {
  const status = data.gamesWaitingForOdds > 0
    ? 'Waiting for Markets'
    : data.freshness === 'stale'
      ? 'Updating'
      : data.freshness === 'empty'
        ? 'Waiting for Markets'
        : data.success
          ? 'Ready'
          : 'Issue Detected'
  const tone = status === 'Ready' ? 'green' : status === 'Issue Detected' ? 'red' : status === 'Waiting for Markets' ? 'yellow' : 'blue'
  const detail = status === 'Waiting for Markets'
    ? 'Market prices are needed before recommendations can be finalized.'
    : status === 'Updating'
      ? simpleAction(data.nextAction)
      : status === 'Issue Detected'
        ? 'The dashboard needs attention before recommendations are reviewed.'
        : 'The main board is ready for review.'
  return (
    <section className={`rounded-lg border p-5 ${toneClasses(tone)} ${cardMotion}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">System Health</p>
          <h3 className="mt-1 text-2xl font-black text-white">{status}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
        </div>
        <a href="#advanced-details" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-slate-950/50 px-4 py-2 text-sm font-black text-white outline-none transition hover:bg-slate-950/80 focus-visible:ring-2 focus-visible:ring-white">Advanced Status</a>
      </div>
    </section>
  )
}

function HistoryCard({ data }: { data: TodayResponse }) {
  const source = data as TodayResponse & { history?: unknown; recentHistory?: unknown; settledHistory?: unknown }
  const history = Array.isArray(source.history)
    ? source.history
    : Array.isArray(source.recentHistory)
      ? source.recentHistory
      : Array.isArray(source.settledHistory)
        ? source.settledHistory
        : []
  if (!history.length) return null
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">History</p>
      <div className="mt-4 grid gap-3">
        {history.slice(0, 3).map((item, index) => (
          <div key={index} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-black text-white">{fieldValue((item as Record<string, unknown>).label ?? (item as Record<string, unknown>).title, 'Settled result')}</p>
            <p className="mt-1 text-sm text-slate-400">{fieldValue((item as Record<string, unknown>).summary ?? (item as Record<string, unknown>).result, 'Stored settled history')}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function UserTodayPanel() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [topOpportunity, setTopOpportunity] = useState<TopOpportunity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [todayResponse, opportunityResponse] = await Promise.all([
          fetch('/api/dashboard?mode=today', { cache: 'no-store' }),
          fetch('/api/market-opportunities/most-likely?sort=highest_probability&mode=current_board&limit=1', { cache: 'no-store' }),
        ])
        const todayJson = await todayResponse.json()
        if (!todayResponse.ok || !todayJson.success) throw new Error(todayJson.error?.message ?? 'Unable to load today.')
        setData(todayJson)
        if (opportunityResponse.ok) {
          const opportunityJson = await opportunityResponse.json() as TopOpportunityResponse
          setTopOpportunity(opportunityJson.topPick?.candidate ?? opportunityJson.opportunities?.[0] ?? null)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load today.')
      }
    }
    load()
  }, [])

  const games = useMemo(() => {
    if (data?.currentGameCards?.length) return data.currentGameCards
    return data?.nextSlateGames ?? []
  }, [data])

  if (error) return <EmptyState title="Today is temporarily unavailable" detail={error} />
  if (!data) {
    return (
      <section className="space-y-5">
        <div className="h-80 animate-pulse rounded-lg bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-4">
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
        </div>
      </section>
    )
  }

  const counts = data.marketIntelligence ?? { official: data.officialPicks, aiLeans: 0, watchlist: 0, avoid: 0 }

  return (
    <section className="space-y-6">
      <DecisionHero data={data} counts={counts} />
      <section className="grid gap-4 lg:grid-cols-4">
        <CategoryCard title="Official Picks" value={counts.official} tone="green" icon="OP" href="/dashboard" status={counts.official ? 'Ready' : 'None'} tooltip="Recommendation-policy picks only." />
        <CategoryCard title="AI Leans" value={counts.aiLeans} tone="yellow" icon="AL" href="/most-likely" status={counts.aiLeans ? 'Available' : 'None'} tooltip="Grounded informational opportunities." />
        <CategoryCard title="Watchlist" value={counts.watchlist} tone="blue" icon="WL" href="/best-value" status={counts.watchlist ? 'Tracking' : 'Clear'} tooltip="Markets to watch without official recommendation status." />
        <CategoryCard title="Avoid" value={counts.avoid} tone="red" icon="AV" href="/ai-bet-finder" status={counts.avoid ? 'Avoid' : 'Clear'} tooltip="Markets blocked by policy or weak value." />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <TopOpportunityCard opportunity={topOpportunity} />
        <AIConfidenceCard opportunity={topOpportunity} />
      </section>
      <HistoryCard data={data} />
      <section className={`rounded-lg border border-slate-800 bg-slate-900/80 p-6 ${cardMotion}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Today's Games</p>
            <h3 className="mt-2 text-3xl font-black text-white">{games.length} game{games.length === 1 ? '' : 's'}</h3>
          </div>
          <Badge tone={games.length ? 'blue' : 'yellow'}>{games.length ? 'AI Tracking' : 'Waiting'}</Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {games.length ? games.map((game, index) => <GameCard key={game.eventId ?? game.id ?? `${game.matchup}-${index}`} game={game} />) : (
            <EmptyState title="No games to show" detail="The next slate has not been resolved yet." />
          )}
        </div>
      </section>
      <ProgressPipeline data={data} />
      <HealthCard data={data} />
    </section>
  )
}