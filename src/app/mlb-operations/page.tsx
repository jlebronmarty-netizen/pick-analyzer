import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'MLB Operations Center | Pick Analyzer',
  description: 'Internal MLB platform operations monitor.',
}

type OperationsData = Awaited<ReturnType<typeof import('@/services/mlb-operations-center.service')['getMlbOperationsCenter']>>
type Tone = 'ready' | 'partial' | 'blocked' | 'waiting' | 'degraded'

const toneStyles: Record<Tone, string> = {
  ready: 'border-emerald-400/40 bg-emerald-950/30 text-emerald-100',
  partial: 'border-amber-400/40 bg-amber-950/30 text-amber-100',
  blocked: 'border-rose-400/40 bg-rose-950/30 text-rose-100',
  waiting: 'border-sky-400/40 bg-sky-950/30 text-sky-100',
  degraded: 'border-zinc-400/40 bg-zinc-900/50 text-zinc-100',
}

const dotStyles: Record<Tone, string> = {
  ready: 'bg-emerald-400',
  partial: 'bg-amber-400',
  blocked: 'bg-rose-400',
  waiting: 'bg-sky-400',
  degraded: 'bg-zinc-400',
}

function toneFrom(value: unknown): Tone {
  const normalized = String(value ?? '').toLowerCase()
  if (['ready', 'healthy', 'complete', 'completed', 'available', 'fresh', 'enabled'].some((term) => normalized.includes(term))) return 'ready'
  if (['blocked', 'failed', 'missing', 'subscription'].some((term) => normalized.includes(term))) return 'blocked'
  if (['waiting', 'pending', 'insufficient', 'planned', 'empty'].some((term) => normalized.includes(term))) return 'waiting'
  if (['partial', 'warning', 'degraded', 'limited'].some((term) => normalized.includes(term))) return 'partial'
  return 'degraded'
}

function fmt(value: unknown, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function pct(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

function StatusPill({ value, tone }: { value: unknown; tone?: Tone }) {
  const resolved = tone ?? toneFrom(value)
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-bold ${toneStyles[resolved]}`}>
      <span className={`h-2 w-2 rounded-full ${dotStyles[resolved]}`} />
      {fmt(value)}
    </span>
  )
}

function Panel({
  title,
  status,
  children,
}: {
  title: string
  status?: unknown
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {status !== undefined ? <StatusPill value={status} /> : null}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, tone }: { label: string; value: unknown; tone?: Tone }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <div className="mt-2 text-lg font-black text-white">{tone ? <StatusPill value={value} tone={tone} /> : fmt(value)}</div>
    </div>
  )
}

function Rows({ items }: { items: Array<[string, unknown, Tone?]> }) {
  return (
    <div className="grid gap-2">
      {items.map(([label, value, tone]) => (
        <div key={label} className="flex min-h-9 items-center justify-between gap-3 border-b border-zinc-900 py-2 last:border-0">
          <span className="text-sm text-zinc-400">{label}</span>
          <span className="text-right text-sm font-semibold text-zinc-100">
            {tone ? <StatusPill value={value} tone={tone} /> : fmt(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function StageGrid({ data }: { data: OperationsData }) {
  const day = data.operatingDay
  const stages = [
    ['Morning Sync', day.morningSync.status, day.morningSync.at],
    ['Pregame Refresh', day.pregameRefresh.status, day.pregameRefresh.at],
    ['Final Refresh', day.finalRefresh.status, day.finalRefresh.at],
    ['Results Sync', day.resultsSync.status, day.resultsSync.at],
    ['Settlement', day.settlement.status, day.settlement.at],
    ['Replay', day.replay.status, day.replay.at],
    ['Calibration', day.calibration.status, day.calibration.at],
    ['Learning', day.learning.status, day.learning.at],
  ] as const
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {stages.map(([label, status, at]) => (
        <div key={label} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-400">{label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[toneFrom(status)]}`} />
          </div>
          <p className="mt-2 text-sm font-bold text-white">{fmt(status)}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{fmt(at)}</p>
        </div>
      ))}
    </div>
  )
}

function CoverageTable({ data }: { data: OperationsData }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {data.coverage.map((item) => (
        <div key={item.label} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">{item.label}</p>
            <StatusPill value={item.status} tone={toneFrom(item.tone)} />
          </div>
          <div className="mt-3 h-2 rounded-full bg-zinc-800">
            <div
              className={`h-2 rounded-full ${dotStyles[toneFrom(item.tone)]}`}
              style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>{pct(item.value)}</span>
            <span className="text-right">{item.detail}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Readiness({ data }: { data: OperationsData }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {data.readiness.components.map((item) => (
        <div key={item.label} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">{item.label}</p>
            <StatusPill value={item.score} tone={toneFrom(item.tone)} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export default async function MlbOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ selectedDate?: string; date?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const { getMlbOperationsCenter } = await import('@/services/mlb-operations-center.service')
  const data = await getMlbOperationsCenter({ selectedDate: params.selectedDate ?? params.date })
  const current = data.currentBoard
  const provider = data.providerHealth
  const quality = data.modelQuality
  const prediction = data.predictionEngine
  const settlement = data.settlement
  const automation = data.automation
  const budget = provider.budget

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-cyan-300">Internal Admin</p>
              <h1 className="mt-1 text-3xl font-black text-white">MLB Operations Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                One-screen operational health for MLB platform V1. Read-only, provider-budget guarded, no threshold or model-promotion changes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Operating Date" value={data.operatingDay.operatingDate} />
              <Metric label="MLB Readiness" value={pct(data.readiness.overallMlbReadiness)} tone={toneFrom(data.readiness.overallTone)} />
              <Metric label="Provider Calls" value={data.providerCallsMade} tone="ready" />
              <Metric label="Official Picks" value={current.officialPicks} tone={current.officialPicks > 0 ? 'ready' : 'waiting'} />
            </div>
          </div>
        </header>

        {data.sectionErrors.length ? (
          <Panel title="Subsystem Errors" status="degraded">
            <div className="grid gap-2">
              {data.sectionErrors.map((error) => (
                <p key={error} className="rounded-md border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-100">{error}</p>
              ))}
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Operating Day" status={data.operatingDay.currentStageStatus}>
            <Rows
              items={[
                ['Current Stage', data.operatingDay.currentStage],
                ['Next Scheduled Action', data.operatingDay.nextScheduledAction],
                ['Last Successful Run', data.operatingDay.lastSuccessfulRun],
                ['Next Planned Run', data.operatingDay.nextPlannedRun],
                ['Elapsed Time', data.operatingDay.elapsedTime],
                ['Failures', data.operatingDay.failures],
                ['Retries', data.operatingDay.retries],
              ]}
            />
          </Panel>

          <Panel title="Current Board" status={current.currentBoardHealth}>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Games Today" value={current.gamesToday} />
              <Metric label="Games Ready" value={current.gamesReady} />
              <Metric label="Games Waiting" value={current.gamesWaiting} />
              <Metric label="Final/Postponed/Cancelled" value={`${current.gamesFinal}/${current.gamesPostponed}/${current.gamesCancelled}`} />
              <Metric label="Odds Ready" value={current.oddsReady} />
              <Metric label="Prediction Ready" value={current.predictionReady} />
              <Metric label="Informational Picks" value={current.informationalPicks} />
              <Metric label="Freshness" value={current.freshness} tone={toneFrom(current.freshness)} />
            </div>
          </Panel>

          <Panel title="Provider Health" status={provider.healthy ? 'healthy' : 'limited'}>
            <Rows
              items={[
                ['SportsDataIO', provider.sportsDataIO],
                ['API Key', provider.apiKey, toneFrom(provider.apiKey)],
                ['Calls Today', provider.callsToday],
                ['Remaining Budget', provider.remainingBudget],
                ['Cache Hit/Miss', provider.cacheHitMiss],
                ['TTL / Next Eligible', provider.ttl],
                ['Last Successful Call', provider.lastSuccessfulProviderCall],
                ['Blocked Endpoints', provider.blockedEndpoints.join(', '), 'blocked'],
              ]}
            />
          </Panel>
        </div>

        <Panel title="Operating Stages" status={data.operatingDay.currentStageStatus}>
          <StageGrid data={data} />
        </Panel>

        <Panel title="Intelligence Coverage" status={quality.coverageLabel}>
          <CoverageTable data={data} />
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Prediction Engine" status={prediction.predictionHealth}>
            <Rows
              items={[
                ['Champion', prediction.champion],
                ['Challenger', prediction.challenger],
                ['Shadow', prediction.shadow],
                ['Current Version', prediction.currentVersion],
                ['Feature Version', prediction.featureVersion],
                ['Confidence Engine', prediction.confidenceEngine],
                ['Current Candidates', prediction.currentCandidates],
                ['Official Picks', prediction.officialPicks],
                ['Recommendation Health', prediction.recommendationHealth],
              ]}
            />
          </Panel>

          <Panel title="Model Quality" status={quality.coverageLabel}>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Feature Quality" value={quality.featureQuality} tone={toneFrom(quality.modelConfidence)} />
              <Metric label="Data Sufficiency" value={quality.dataSufficiency} tone={toneFrom(quality.dataConfidence)} />
              <Metric label="Critical Completeness" value={quality.criticalCompleteness} tone={toneFrom(quality.coverageLabel)} />
              <Metric label="Market Confidence" value={quality.marketConfidence} tone={toneFrom(quality.marketConfidence)} />
              <Metric label="Recommendation Confidence" value={quality.recommendationConfidence} tone={toneFrom(quality.recommendationConfidence)} />
              <Metric label="Severity Inferred" value={quality.confidenceImpact.injurySeverityInferred} tone={quality.confidenceImpact.injurySeverityInferred ? 'blocked' : 'ready'} />
            </div>
            <div className="mt-4 grid gap-2">
              {quality.knownBlockers.map((blocker) => (
                <p key={blocker} className="rounded-md border border-amber-400/30 bg-amber-950/20 p-2 text-sm text-amber-100">{blocker}</p>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title="Settlement" status={settlement.calibrationStatus}>
            <Rows
              items={[
                ['Pending Results', settlement.pendingResults],
                ['Settled Today', settlement.settledToday],
                ['Wins/Losses/Pushes', `${settlement.wins}/${settlement.losses}/${settlement.pushes}`],
                ['Replay Status', settlement.replayStatus],
                ['Calibration Status', settlement.calibrationStatus],
                ['Learning Status', settlement.learningStatus],
              ]}
            />
          </Panel>

          <Panel title="Automation" status={automation.automationStatus}>
            <Rows
              items={[
                ['Vercel Cron', automation.vercelCron],
                ['GitHub Actions', automation.githubActions],
                ['Last Execution', automation.lastExecution],
                ['Next Execution', automation.nextExecution],
                ['Scheduler Health', automation.schedulerHealth],
                ['Off-PC Automation', automation.offPcAutomation],
                ['Cron Failures', automation.cronFailures],
              ]}
            />
          </Panel>

          <Panel title="Provider Budget" status={budget.remaining > 0 ? 'healthy' : 'blocked'}>
            <Rows
              items={[
                ['Budget', budget.budget],
                ['Used', budget.used],
                ['Remaining', budget.remaining],
                ['Estimated Today', budget.estimatedToday],
                ['Current Tier', budget.currentTier],
                ['Largest Consumer', budget.largestConsumer],
                ['Historical Imports', budget.historicalImports],
                ['Warnings', budget.warnings.length ? budget.warnings.join(', ') : 'none'],
              ]}
            />
          </Panel>
        </div>

        <Panel title="MLB Readiness Score" status={data.readiness.overallTone}>
          <Readiness data={data} />
          <p className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">{data.readiness.doNotInflateReason}</p>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Known Limitations" status="partial">
            <div className="grid gap-2">
              {data.knownLimitations.map((item) => (
                <p key={item} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-sm text-zinc-300">{item}</p>
              ))}
            </div>
          </Panel>

          <Panel title="Developer Links" status="ready">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {data.developerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm font-bold text-cyan-200 hover:border-cyan-400/60 hover:bg-cyan-950/30"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  )
}
