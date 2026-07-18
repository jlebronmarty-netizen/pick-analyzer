'use client'

import { useEffect, useMemo, useState } from 'react'

type DailyOpsResponse = {
  success: boolean
  generatedAt: string
  selectedDate: string
  providerCallsMade: number
  shouldBetToday: 'YES' | 'NO'
  answer: string
  displayDate?: string
  aiBriefing?: Record<string, any>
  nextScheduledAction?: Record<string, any>
  bankrollRecommendation: string
  topSection: Record<string, any>
  gameCards: Array<Record<string, any>>
  timeline: Array<Record<string, any>>
  systemHealth: Record<string, any>
  aiCoach: Record<string, any>
  learningReport: Record<string, any>
  promotionReadiness: Record<string, any>
  blockers: string[]
  sectionErrors: string[]
}

function fmt(value: unknown, suffix = '') {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toFixed(1).replace(/\.0$/, '')}${suffix}` : 'n/a'
}

function odds(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'n/a'
  return parsed > 0 ? `+${parsed}` : String(parsed)
}

function time(value: unknown) {
  if (!value) return 'TBD'
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return 'TBD'
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Puerto_Rico', timeZoneName: 'short' })
}

function statusClass(status: string) {
  if (status === 'OFFICIAL') return 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100'
  if (status === 'INFORMATIONAL') return 'border-sky-500/40 bg-sky-950/30 text-sky-100'
  if (status === 'WATCH') return 'border-amber-500/40 bg-amber-950/30 text-amber-100'
  if (status === 'NO VALUE' || status === 'PASS') return 'border-slate-700 bg-slate-900 text-slate-200'
  if (status === 'UNAVAILABLE' || status === 'NO OFFICIAL PICK' || status === 'NONE QUALIFIED') return 'border-slate-700 bg-slate-950 text-slate-400'
  return 'border-slate-700 bg-slate-950 text-slate-300'
}

function stageClass(status: string) {
  if (status === 'complete') return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-100'
  if (status === 'warning') return 'border-amber-500/40 bg-amber-950/20 text-amber-100'
  return 'border-slate-700 bg-slate-950 text-slate-300'
}

function MiniPick({ title, pick }: { title: string; pick: any }) {
  const displayStatus = pick?.status ?? (title === 'Official Pick' ? 'NO OFFICIAL PICK' : 'UNAVAILABLE')
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusClass(String(displayStatus))}`}>
          {displayStatus}
        </span>
      </div>
      {pick ? (
        <>
          <p className="mt-3 text-sm font-black text-white">{pick.selection}</p>
          <p className="mt-1 text-xs text-slate-400">{pick.market} | {pick.matchup}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Metric label="Prob" value={fmt(pick.probability, '%')} />
            <Metric label="Conf" value={fmt(pick.confidence)} />
            <Metric label="EV" value={fmt(pick.value, '%')} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Unavailable</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const help: Record<string, string> = {
    Prob: 'Model-estimated chance for this selection.',
    Conf: 'How reliable the model considers this candidate given available data.',
    EV: 'Expected value at the displayed price. Positive is required for value.',
    Value: 'Expected value at the displayed price. Negative value means pass.',
    Edge: 'Difference between model probability and sportsbook implied probability.',
    AI: 'Composite display rating from model, value, data quality, and reliability.',
    Odds: 'Current stored Consensus American odds.',
  }
  return (
    <div title={help[label] ?? undefined}>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  )
}

function GameCard({ game }: { game: any }) {
  const pick = game.currentRecommendation
  const starter = pick?.starter ?? {}
  const weather = pick?.weather ?? {}
  return (
    <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusClass(String(game.status ?? 'UNAVAILABLE'))}`}>
                {game.status ?? 'UNAVAILABLE'}
              </span>
              <span className="text-xs font-bold text-slate-500">{time(game.scheduledTime)}</span>
            </div>
            <p className="mt-2 text-base font-black text-white">{game.matchup}</p>
            <p className="mt-1 text-xs text-slate-400">{pick?.selection ?? 'No current recommendation'} {pick?.market ? `| ${pick.market}` : ''}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric label="Prob" value={fmt(game.probability, '%')} />
            <Metric label="Conf" value={fmt(game.confidence)} />
            <Metric label="Value" value={fmt(game.value, '%')} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="AI" value={fmt(pick?.aiRating)} />
            <Metric label="Odds" value={odds(pick?.odds)} />
          </div>
        </div>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 text-sm md:grid-cols-4">
        <Info label="Starter" value={starter.away?.name || starter.away?.playerId || starter.home?.name || starter.home?.playerId || 'Unknown'} />
        <Info label="Weather" value={weather.description || weather.runEnvironment || 'Unavailable'} />
        <Info label="Wind" value={weather.windSpeed ? `${weather.windSpeed} mph` : 'Unavailable'} />
        <Info label="Why" value={pick?.summary || 'Stored model output only.'} />
      </div>
    </details>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div title={{
      Probability: 'Model-estimated chance for this selection.',
      Confidence: 'Reliability of the model signal.',
      'Feature Quality': 'How complete and trustworthy the feature set is.',
      'Critical Completeness': 'Coverage of required production inputs.',
      'Data Sufficiency': 'Whether the model has enough useful data.',
      'AI Rating': 'Composite opportunity score.',
    }[label]}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  )
}

export default function ProductionTodayPanel() {
  const [data, setData] = useState<DailyOpsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/autonomous-daily-operations/status', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error ?? 'Unable to load Today')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Today')
      }
    }
    load()
  }, [])

  const timeline = useMemo(() => data?.timeline ?? [], [data])
  const visibleGames = data?.gameCards?.slice(0, 8) ?? []
  const primary = data?.topSection?.primaryOpportunity ?? data?.topSection?.bestBetToday
  const secondaryTags = data?.topSection?.primaryTags ?? []

  if (error) {
    return <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div>
  }

  if (!data) {
    return <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-5 text-slate-300">Loading Today...</div>
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Should I Bet Today?</p>
            <div className="mt-3 flex items-end gap-4">
              <p className={data.shouldBetToday === 'YES' ? 'text-7xl font-black text-emerald-300' : 'text-7xl font-black text-red-300'}>
                {data.shouldBetToday}
              </p>
              <p className="pb-2 text-sm text-slate-300">{data.displayDate ?? data.selectedDate}</p>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{data.aiBriefing?.firstAnswer ?? data.answer}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{data.aiBriefing?.why ?? data.answer}</p>
            <p className="mt-3 text-xs text-slate-500">
              Last updated {time(data.generatedAt)} | Next scheduled action: {data.nextScheduledAction?.action ?? 'Waiting'} ({data.nextScheduledAction?.estimate ?? 'No action due.'})
            </p>
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Bankroll Recommendation</p>
              <p className="mt-2 text-lg font-black text-white">{data.bankrollRecommendation}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Today's AI Briefing</p>
                <h3 className="mt-2 text-2xl font-black text-white">{data.topSection.primaryTitle ?? data.aiBriefing?.bestOpportunityTitle ?? 'No Attractive Bet Available'}</h3>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(String(primary?.status ?? 'UNAVAILABLE'))}`}>
                {primary?.status ?? 'UNAVAILABLE'}
              </span>
            </div>
            {primary ? (
              <>
                <p className="mt-4 text-xl font-black text-white">
                  {primary.selection} {primary.market}{primary.line === null || primary.line === undefined ? '' : ` ${primary.line}`} {primary.odds ? `(${odds(primary.odds)})` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-400">{primary.matchup} | {time(primary.scheduledTime)}</p>
                <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
                  <Metric label="Prob" value={fmt(primary.probability, '%')} />
                  <Metric label="Conf" value={fmt(primary.confidence)} />
                  <Metric label="EV" value={fmt(primary.value, '%')} />
                  <Metric label="Edge" value={fmt(primary.edge, '%')} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {secondaryTags.map((item: any) => (
                    <span key={item.label} title={item.note ?? undefined} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200">
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{primary.summary}</p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-300">No attractive current opportunity is available.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MiniPick title="Official Pick" pick={data.topSection.officialPick} />
        <MiniPick title="Best Value" pick={data.topSection.bestValue} />
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Most Likely Parlay</p>
          <p className="mt-3 text-sm font-black text-white">
            {data.topSection.mostLikelyParlay?.available
              ? `2 legs | ${fmt(data.topSection.mostLikelyParlay.adjustedJointProbability, '%')}`
              : 'Unavailable'}
          </p>
          <p className="mt-1 text-xs text-slate-400">{data.topSection.mostLikelyParlay?.reason ?? 'Not enough eligible games remain.'}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Game Cards</p>
              <h3 className="mt-1 text-xl font-black text-white">Current Board</h3>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
              {data.gameCards.length} games
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {visibleGames.length ? visibleGames.map((game) => <GameCard key={game.eventId} game={game} />) : (
              <p className="text-sm text-slate-400">No current games available.</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">System Health</p>
            <div className="mt-4 grid gap-3 text-sm">
              <Info label="Provider Health" value={`${data.systemHealth.provider?.status ?? 'Unknown'} | calls today ${data.systemHealth.provider?.callsToday ?? 0}`} />
              <Info label="Last Sync" value={data.systemHealth.provider?.lastSync ?? 'No sync recorded'} />
              <Info label="System Health" value={data.systemHealth.system?.status ?? data.systemHealth.board ?? 'Unknown'} />
              <Info label="Model Health" value={`${data.systemHealth.model?.current ?? 'Champion'} | ${data.systemHealth.model?.status ?? data.systemHealth.calibration ?? 'unknown'}`} />
              <Info label="Learning Health" value={data.systemHealth.learningHealth?.status ?? 'Waiting for settled production history'} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Today's Timeline</p>
            <div className="mt-4 grid gap-2">
              {timeline.slice(0, 12).map((stage) => (
                <div key={stage.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${stageClass(String(stage.status))}`}>
                  <span className="font-bold">{stage.label}</span>
                  <span className="uppercase">{stage.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Today's Learning</p>
          <p className="mt-2 text-lg font-black text-white">{data.systemHealth.learningHealth?.status ?? 'Waiting for settled production history'}</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {(data.learningReport.narrative ?? []).map((item: string) => <p key={item}>{item}</p>)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Promotion Readiness</p>
          <p className="mt-2 text-2xl font-black text-white">{data.promotionReadiness.state ?? 'unknown'}</p>
          <p className="mt-2 text-sm text-slate-300">{data.promotionReadiness.recommendation}</p>
          <div className="mt-3 grid gap-2">
            {(data.promotionReadiness.checklist ?? []).map((item: any) => (
              <div key={item.item} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-xs">
                <span className="text-slate-300">{item.item}</span>
                <span className={item.passed ? 'font-black text-emerald-300' : 'font-black text-amber-300'}>{item.passed ? 'PASS' : 'WAIT'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.blockers.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Why not an official bet?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.blockers.slice(0, 8).map((blocker) => (
              <span key={blocker} className="rounded-full bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-100">{blocker}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
