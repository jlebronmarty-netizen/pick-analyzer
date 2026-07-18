'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type TodayResponse = {
  success: boolean
  mode: 'dashboard_today_contract_v1'
  generatedAt: string
  nowPuertoRico: string
  timezone: string
  operatingDate: string
  activeSlateDate: string | null
  nextSlateDate: string | null
  currentStage: string
  activeOperatingDayStatus: string
  currentGames: number
  upcomingGames: number
  finalGames: number
  gamesWaitingForOdds: number
  gamesReadyForAnalysis: number
  predictionCandidates: number
  officialPicks: number
  informationalCandidates: number
  latestOddsTimestamp: string | null
  freshness: 'fresh' | 'stale' | 'empty'
  nextAction: string
  nextActionAt: string | null
  automationStatus: string
  providerCallsToday: number
  providerCallsMade: 0
  remoteMutationsMade: 0
  summary: {
    recommendation: string
    aiBriefing: string
    currentOperatingDay: string
    nextSlate: string
    marketPrices: string
  }
  currentGameCards: Array<Record<string, any>>
  nextSlateGames: Array<Record<string, any>>
  pipeline: Array<Record<string, any>>
  warnings: string[]
  blockers: string[]
}

function timeText(value: unknown) {
  if (!value) return 'Time pending'
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return 'Time pending'
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
    timeZoneName: 'short',
  })
}

function statusTone(value: unknown): 'green' | 'yellow' | 'blue' | 'gray' | 'red' {
  const status = String(value ?? '').toLowerCase()
  if (status.includes('official') || status.includes('healthy') || status.includes('complete') || status.includes('fresh')) return 'green'
  if (status.includes('waiting') || status.includes('watch') || status.includes('stale')) return 'yellow'
  if (status.includes('informational')) return 'blue'
  if (status.includes('blocked') || status.includes('problem')) return 'red'
  return 'gray'
}

function toneClass(tone: 'green' | 'yellow' | 'blue' | 'gray' | 'red') {
  return {
    green: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100',
    yellow: 'border-amber-500/30 bg-amber-950/20 text-amber-100',
    blue: 'border-sky-500/30 bg-sky-950/20 text-sky-100',
    gray: 'border-slate-700 bg-slate-900/80 text-slate-200',
    red: 'border-red-500/30 bg-red-950/20 text-red-100',
  }[tone]
}

function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'yellow' | 'blue' | 'gray' | 'red' }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${toneClass(tone)}`}>{children}</span>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

function Metric({ label, value, tone = 'gray' }: { label: string; value: string | number; tone?: 'green' | 'yellow' | 'blue' | 'gray' | 'red' }) {
  const color = {
    green: 'text-emerald-200',
    yellow: 'text-amber-100',
    blue: 'text-sky-100',
    gray: 'text-white',
    red: 'text-red-100',
  }[tone]
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${color}`}>{value}</p>
    </div>
  )
}

function dateText(value: string | null) {
  if (!value) return 'Not resolved'
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function displayStatus(value: unknown) {
  const text = String(value ?? 'Waiting')
  if (text === 'started_or_results_pending') return 'Results pending'
  return text.replaceAll('_', ' ')
}

function BriefingCard({ data }: { data: TodayResponse }) {
  const shouldBet = data.officialPicks > 0
  const reasons = data.blockers?.length ? data.blockers.slice(0, 3) : ['No official recommendation passed policy.']

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 md:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Today</p>
          <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">AI Briefing</h2>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Pill tone={shouldBet ? 'green' : 'yellow'}>{shouldBet ? 'Official bet available' : 'No official bet today'}</Pill>
            <Pill tone="blue">Operating day {dateText(data.operatingDate)}</Pill>
            {data.nextSlateDate && <Pill tone="gray">Next slate {dateText(data.nextSlateDate)}</Pill>}
            <Pill tone="gray">Updated {timeText(data.generatedAt)}</Pill>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-200">{data.summary.aiBriefing}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            {data.summary.currentOperatingDay}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Recommendation" value={shouldBet ? 'Bet with official staking' : 'Preserve bankroll'} tone={shouldBet ? 'green' : 'yellow'} />
            <Metric label="Next Safe Action" value={data.nextAction} tone="blue" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Recommendation</p>
          <h3 className="mt-3 text-2xl font-black text-white">{data.summary.recommendation}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{data.summary.marketPrices}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Candidates" value={data.predictionCandidates} tone={data.predictionCandidates ? 'blue' : 'gray'} />
            <Metric label="Official Picks" value={data.officialPicks} tone={data.officialPicks ? 'green' : 'yellow'} />
            <Metric label="Ready Games" value={data.gamesReadyForAnalysis} tone={data.gamesReadyForAnalysis ? 'green' : 'gray'} />
            <Metric label="Waiting Odds" value={data.gamesWaitingForOdds} tone={data.gamesWaitingForOdds ? 'yellow' : 'green'} />
          </div>
        </div>
      </div>

      {!shouldBet && (
        <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-950/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Why not?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((reason) => <Pill key={reason} tone="yellow">{reason}</Pill>)}
          </div>
        </div>
      )}
    </section>
  )
}

function GameCard({ game }: { game: Record<string, any> }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{timeText(game.scheduledTime)}</p>
          <h4 className="mt-1 truncate text-lg font-black text-white">{game.matchup}</h4>
        </div>
        <Pill tone={statusTone(game.status)}>{displayStatus(game.status)}</Pill>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">
        {game.oddsPresent === false
          ? 'Market prices have not been refreshed yet.'
          : game.predictionReady === false
            ? 'Prediction analysis is waiting for verified market data.'
            : 'Tracked separately from the Current Board recommendation gate.'}
      </p>
    </article>
  )
}

function Timeline({ stages }: { stages: Array<Record<string, any>> }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Pipeline</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
            <span className="text-sm font-bold text-white">{stage.displayLabel ?? stage.label}</span>
            <Pill tone={statusTone(stage.status)}>{stage.status ?? 'Waiting'}</Pill>
          </div>
        ))}
      </div>
    </section>
  )
}

function SystemStatus({ data }: { data: TodayResponse }) {
  const rows = [
    ['Provider', 'Healthy', `${data.providerCallsToday} calls today`],
    ['Current Board', data.freshness === 'empty' ? 'Waiting' : data.freshness, `${data.predictionCandidates} candidates`],
    ['Learning', 'Not due', 'Sample-gated; no automatic promotion.'],
    ['Automation', data.automationStatus, data.nextAction],
  ]

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">System Status</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, status, detail]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-white">{label}</p>
              <Pill tone={statusTone(status)}>{status}</Pill>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ProductTodayPanel() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/dashboard?mode=today', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load today.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load today.')
      }
    }
    load()
  }, [])

  const currentGames = useMemo(() => data?.currentGameCards ?? [], [data])
  const nextSlateGames = useMemo(() => data?.nextSlateGames ?? [], [data])

  if (error) return <EmptyState title="Today is temporarily unavailable" detail={error} />

  if (!data) {
    return (
      <section className="space-y-4">
        <div className="h-72 animate-pulse rounded-lg bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-36 animate-pulse rounded-lg bg-slate-900" />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <BriefingCard data={data} />

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Today's Operating Day</p>
          <h3 className="mt-1 text-2xl font-black text-white">{dateText(data.operatingDate)}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{data.summary.currentOperatingDay}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Metric label="Games" value={data.currentGames} tone={data.currentGames ? 'blue' : 'gray'} />
            <Metric label="Final" value={data.finalGames} tone={data.finalGames ? 'green' : 'gray'} />
            <Metric label="Stage" value={data.currentStage.replaceAll('_', ' ')} tone="gray" />
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Next Slate</p>
          <h3 className="mt-1 text-2xl font-black text-white">{dateText(data.nextSlateDate)}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{data.summary.nextSlate}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Metric label="Games" value={data.upcomingGames} tone={data.upcomingGames ? 'blue' : 'gray'} />
            <Metric label="Waiting Odds" value={data.gamesWaitingForOdds} tone={data.gamesWaitingForOdds ? 'yellow' : 'green'} />
            <Metric label="Ready" value={data.gamesReadyForAnalysis} tone={data.gamesReadyForAnalysis ? 'green' : 'gray'} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Games</p>
            <h3 className="mt-1 text-2xl font-black text-white">{currentGames.length ? "Today's Games" : 'Scheduled Games'}</h3>
          </div>
          <Pill tone={currentGames.length || nextSlateGames.length ? 'green' : 'yellow'}>
            {currentGames.length || nextSlateGames.length ? `${currentGames.length || nextSlateGames.length} games` : 'Waiting'}
          </Pill>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {currentGames.length ? currentGames.map((game) => <GameCard key={game.eventId} game={game} />) : nextSlateGames.length ? nextSlateGames.map((game) => <GameCard key={game.eventId} game={game} />) : (
            <EmptyState title="No actionable games remain for today" detail="No separate next slate is resolved from stored data yet." />
          )}
        </div>
      </section>

      <Timeline stages={data.pipeline} />
      <SystemStatus data={data} />
    </section>
  )
}
