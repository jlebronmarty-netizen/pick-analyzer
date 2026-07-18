'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type DailyOpsResponse = {
  success: boolean
  generatedAt: string
  shouldBetToday: 'YES' | 'NO'
  answer: string
  aiBriefing?: Record<string, any>
  nextScheduledAction?: Record<string, any>
  topSection: Record<string, any>
  gameCards: Array<Record<string, any>>
  timeline: Array<Record<string, any>>
  systemHealth: Record<string, any>
  blockers: string[]
}

function numberText(value: unknown, suffix = '') {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Not ready'
  return `${parsed.toFixed(1).replace(/\.0$/, '')}${suffix}`
}

function oddsText(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'No price'
  return parsed > 0 ? `+${parsed}` : String(parsed)
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
  if (status.includes('official') || status.includes('healthy') || status.includes('complete')) return 'green'
  if (status.includes('waiting') || status.includes('watch')) return 'yellow'
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

function Metric({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'green' | 'yellow' | 'blue' | 'gray' | 'red' }) {
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

function BriefingCard({ data }: { data: DailyOpsResponse }) {
  const primary = data.topSection.primaryOpportunity ?? data.topSection.bestBetToday
  const shouldBet = data.shouldBetToday === 'YES'
  const reasons = data.blockers?.length ? data.blockers.slice(0, 3) : ['Current prices do not justify a wager.']

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 md:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Good Morning Jeffrey</p>
          <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Today's AI Briefing</h2>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Pill tone={shouldBet ? 'green' : 'yellow'}>{shouldBet ? 'Official bet available' : 'No official bet today'}</Pill>
            <Pill tone="blue">{data.gameCards.length} MLB games reviewed</Pill>
            <Pill tone="gray">Updated {timeText(data.generatedAt)}</Pill>
          </div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-200">{data.aiBriefing?.firstAnswer ?? data.answer}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            {data.aiBriefing?.why ?? 'The board is waiting for a price that gives the model enough value.'}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Recommendation" value={shouldBet ? 'Bet with official staking' : 'Preserve bankroll'} tone={shouldBet ? 'green' : 'yellow'} />
            <Metric label="Next Check" value={`${data.nextScheduledAction?.action ?? 'Waiting'} - ${data.nextScheduledAction?.estimate ?? 'No refresh is due right now.'}`} tone="blue" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Today's Best Opportunity</p>
          {primary ? (
            <>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black text-white">{primary.selection}</h3>
                  <p className="mt-1 text-sm text-slate-400">{primary.market} | {primary.matchup}</p>
                </div>
                <Pill tone={statusTone(primary.status)}>{primary.status ?? 'Informational'}</Pill>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Probability" value={numberText(primary.probability, '%')} tone="blue" />
                <Metric label="Confidence" value={numberText(primary.confidence)} tone="yellow" />
                <Metric label="Price" value={oddsText(primary.odds)} tone="gray" />
                <Metric label="Value" value={numberText(primary.value, '%')} tone={Number(primary.value ?? 0) > 0 ? 'green' : 'yellow'} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {primary.summary ?? 'Best informational read. Official value gates did not clear a wager.'}
              </p>
            </>
          ) : (
            <EmptyState title="No eligible opportunity yet" detail="Market prices are either unavailable or not attractive enough. The board will refresh automatically." />
          )}
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
  const pick = game.currentRecommendation
  const status = game.recommendationText ?? (pick ? 'Informational read only.' : 'Market prices are not ready yet.')
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{timeText(game.scheduledTime)}</p>
          <h4 className="mt-1 truncate text-lg font-black text-white">{game.matchup}</h4>
        </div>
        <Pill tone={statusTone(game.status)}>{game.status ?? 'Waiting'}</Pill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Probability" value={numberText(game.probability, '%')} tone="blue" />
        <Metric label="Confidence" value={numberText(game.confidence)} tone="yellow" />
        <Metric label="Projection" value="Score pending" tone="gray" />
        <Metric label="Price" value={oddsText(pick?.odds)} tone="gray" />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-200">{status}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {game.keyReason ?? pick?.summary ?? 'This game is available, but there is no official wager at the current price.'}
      </p>
    </article>
  )
}

function Timeline({ stages }: { stages: Array<Record<string, any>> }) {
  const ids = ['players', 'pitchers', 'weather', 'odds', 'predictions', 'best_bets', 'results', 'settlement', 'learning']
  const visible = ids.map((id) => stages.find((stage) => stage.id === id)).filter(Boolean) as Array<Record<string, any>>

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Today's Pipeline</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((stage) => (
          <div key={stage.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
            <span className="text-sm font-bold text-white">{stage.displayLabel ?? stage.label}</span>
            <Pill tone={statusTone(stage.displayStatus ?? stage.status)}>{stage.displayStatus ?? 'Waiting'}</Pill>
          </div>
        ))}
      </div>
    </section>
  )
}

function SystemStatus({ health }: { health: Record<string, any> }) {
  const rows = [
    ['Provider', health.provider?.displayStatus ?? health.provider?.status ?? 'Waiting', `${health.provider?.callsToday ?? 0} calls today`],
    ['Model', health.model?.displayStatus ?? 'Waiting', health.model?.promotion ?? 'Manual review required'],
    ['Learning', health.learningHealth?.displayStatus ?? 'Waiting', health.learningHealth?.status ?? 'Waiting for settled games'],
    ['Automation', health.automation?.displayStatus ?? 'Healthy', health.automation?.nextAction ?? 'Waiting'],
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
  const [data, setData] = useState<DailyOpsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/autonomous-daily-operations/status', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load today.')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load today.')
      }
    }
    load()
  }, [])

  const games = useMemo(() => data?.gameCards ?? [], [data])

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

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Today's Games</p>
            <h3 className="mt-1 text-2xl font-black text-white">Current MLB Board</h3>
          </div>
          <Pill tone={games.length ? 'green' : 'yellow'}>{games.length ? `${games.length} games` : 'Waiting'}</Pill>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {games.length ? games.map((game) => <GameCard key={game.eventId} game={game} />) : (
            <EmptyState title="No eligible MLB games are currently available" detail={`The next refresh is scheduled for ${data.nextScheduledAction?.action ?? 'the next safe refresh window'}.`} />
          )}
        </div>
      </section>

      <Timeline stages={data.timeline} />
      <SystemStatus health={data.systemHealth} />
    </section>
  )
}
