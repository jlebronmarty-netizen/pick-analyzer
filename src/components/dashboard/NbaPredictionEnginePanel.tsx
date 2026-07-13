'use client'

import { useEffect, useState, type ReactNode } from 'react'

type NbaPrediction = {
  id: string
  market: string
  team: string
  opponent: string
  sportsbook: string
  odds: number
  line: number | null
  projectedLine: number
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
  adaptiveScore: number
  riskGrade: string
  explanation: {
    summary: string
    reasons: string[]
    warnings: string[]
  }
}

type NbaPredictionResponse = {
  success: boolean
  validation: {
    checked: number
    valid: number
    skipped: number
    skippedReasons: Record<string, number>
  } | null
  summary: {
    eventsScanned: number
    predictionsGenerated: number
    recommended: number
    averageFeatureQuality: number
    averageDataSufficiency: number
    bestPrediction: NbaPrediction | null
    injuryFeedStatus?: string
    activeInjuryCount?: number
    unresolvedInjuryPlayers?: number
    unresolvedInjuryTeams?: number
    injuryConfidencePenalty?: number
    trialInjuryRowsExcluded?: boolean
    lineupFeedStatus?: string
  }
  predictions: NbaPrediction[]
  persisted: boolean
}

type HealthResponse = {
  success: boolean
  status: string
  issues: string[]
  coverage: {
    recentPredictions: number
    markets: string[]
  }
  injuryLineup?: {
    injuryFeed: {
      status: string
      activeInjuryCount: number
      unresolvedPlayerCount: number
      unresolvedTeamCount: number
      freshnessMinutes: number | null
      confidencePenalty: number
      productionEligible: boolean
      trialCount: number
    }
    lineupFeed: {
      availabilityStatus: string
    }
    confidence: {
      penalty: number
      trialDataExcludedFromProductionConfidence: boolean
    }
  }
}

type PerformanceSummary = {
  total: number
  settled: number
  pending: number
  wins: number
  losses: number
  pushes: number
  voids: number
  winRate: number
  profit: number
  units: number
  roi: number
  averageOdds: number
  averageEdge: number
  averageConfidence: number
}

type PerformanceResponse = {
  success: boolean
  overall: PerformanceSummary
  brierScore: number | null
  calibration: {
    bucket: string
    sample: number
    averageProbability: number
    actualWinRate: number
  }[]
  byMarket: (PerformanceSummary & { market: string })[]
  warnings: string[]
}

type ModelHealthV2Response = {
  success: boolean
  status: string
  issues: string[]
  warnings: string[]
  checks: {
    settlementBacklog: number
    staleOdds: number
    duplicateKeys: number
    leakageRisk: number
    missingFirstHalfScores: number
    insufficientSample: boolean
    injuryFeedStale?: boolean
    unresolvedInjuryPlayers?: number
    unresolvedInjuryTeams?: number
    trialInjuryRows?: number
    productionEligibleInjuryRows?: number
    contradictoryInjuryStatuses?: number
    injuryConfidencePenalty?: number
  }
}

type BacklogResponse = {
  success: boolean
  count: number
  backlog: {
    id: string
    gameId: string
    market: string
    selection: string
    sportsbook: string | null
    line: number | null
    eventStatus: string
    reason: string
  }[]
}

function pct(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`
}

function formatOdds(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-emerald-300'
  if (status === 'watch' || status === 'degraded') return 'text-amber-300'
  return 'text-red-300'
}

export default function NbaPredictionEnginePanel() {
  const [data, setData] = useState<NbaPredictionResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null)
  const [modelHealthV2, setModelHealthV2] = useState<ModelHealthV2Response | null>(null)
  const [backlog, setBacklog] = useState<BacklogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const [
        predictionResponse,
        healthResponse,
        performanceResponse,
        modelHealthResponse,
        backlogResponse,
      ] = await Promise.all([
        fetch('/api/nba/predictions?limit=12', { cache: 'no-store' }),
        fetch('/api/nba/predictions/health', { cache: 'no-store' }),
        fetch('/api/nba/predictions/performance', { cache: 'no-store' }),
        fetch('/api/nba/predictions/model-health', { cache: 'no-store' }),
        fetch('/api/nba/predictions/settlement-backlog', { cache: 'no-store' }),
      ])

      const predictionJson = await predictionResponse.json()
      const healthJson = await healthResponse.json()
      const performanceJson = await performanceResponse.json()
      const modelHealthJson = await modelHealthResponse.json()
      const backlogJson = await backlogResponse.json()

      if (!predictionResponse.ok || !predictionJson.success) {
        throw new Error(predictionJson.error ?? 'Unable to load NBA predictions')
      }

      setData(predictionJson)
      setHealth(healthJson)
      if (performanceResponse.ok && performanceJson.success) {
        setPerformance(performanceJson)
      }
      if (modelHealthResponse.ok && modelHealthJson.success) {
        setModelHealthV2(modelHealthJson)
      }
      if (backlogResponse.ok && backlogJson.success) {
        setBacklog(backlogJson)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load NBA predictions'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function refreshPreview() {
    try {
      setRunning(true)
      setError(null)
      await load()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'NBA prediction refresh failed'
      )
    } finally {
      setRunning(false)
    }
  }

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading NBA Prediction Engine V1...
      </section>
    )
  }

  const best = data?.summary.bestPrediction
  const warnings = [
    ...(modelHealthV2?.issues ?? []),
    ...(modelHealthV2?.warnings ?? []),
    ...(performance?.warnings ?? []),
  ]

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
            NBA Prediction Engine V1
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            NBA Market Predictions
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Generates moneyline, spread, total and first-half predictions using synced NBA data and existing Pick Analyzer intelligence.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(modelHealthV2?.status ?? health?.status ?? 'unavailable')}`}>
            {modelHealthV2?.status ?? health?.status ?? 'unavailable'}
          </p>
          <button
            type="button"
            onClick={refreshPreview}
            disabled={running}
            className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-2 text-sm font-bold text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
          >
            {running ? 'Refreshing...' : 'Refresh Preview'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Events" value={`${data?.summary.eventsScanned ?? 0}`} />
        <Stat label="Predictions" value={`${data?.summary.predictionsGenerated ?? 0}`} />
        <Stat label="Recommended" value={`${data?.summary.recommended ?? 0}`} />
        <Stat label="Feature Quality" value={`${data?.summary.averageFeatureQuality ?? 0}`} />
        <Stat label="Sufficiency" value={`${data?.summary.averageDataSufficiency ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Stat label="Settled" value={`${performance?.overall.settled ?? 0}`} />
        <Stat
          label="Record"
          value={`${performance?.overall.wins ?? 0}-${performance?.overall.losses ?? 0}-${performance?.overall.pushes ?? 0}`}
        />
        <Stat label="ROI" value={pct(performance?.overall.roi)} />
        <Stat label="Backlog" value={`${backlog?.count ?? 0}`} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Stat
          label="Injury Feed"
          value={data?.summary.injuryFeedStatus ?? health?.injuryLineup?.injuryFeed.status ?? 'unknown'}
        />
        <Stat
          label="Active Injuries"
          value={`${data?.summary.activeInjuryCount ?? health?.injuryLineup?.injuryFeed.activeInjuryCount ?? 0}`}
        />
        <Stat
          label="Unresolved"
          value={`${data?.summary.unresolvedInjuryPlayers ?? health?.injuryLineup?.injuryFeed.unresolvedPlayerCount ?? 0}/${data?.summary.unresolvedInjuryTeams ?? health?.injuryLineup?.injuryFeed.unresolvedTeamCount ?? 0}`}
        />
        <Stat
          label="Penalty"
          value={`${data?.summary.injuryConfidencePenalty ?? modelHealthV2?.checks.injuryConfidencePenalty ?? 0}`}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        <Panel title="Validation">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Mini label="Checked" value={`${data?.validation?.checked ?? 0}`} />
            <Mini label="Valid" value={`${data?.validation?.valid ?? 0}`} />
            <Mini label="Skipped" value={`${data?.validation?.skipped ?? 0}`} />
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            {Object.entries(data?.validation?.skippedReasons ?? {}).slice(0, 4).map(([reason, count]) => (
              <p key={reason}>{reason}: {count}</p>
            ))}
          </div>
        </Panel>

        <Panel title="Model Health V2">
          <p className={`text-xl font-black uppercase ${statusClass(modelHealthV2?.status ?? 'unavailable')}`}>
            {modelHealthV2?.status ?? 'unavailable'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Stale Odds" value={`${modelHealthV2?.checks.staleOdds ?? 0}`} />
            <Mini label="Dupes" value={`${modelHealthV2?.checks.duplicateKeys ?? 0}`} />
            <Mini label="Leakage" value={`${modelHealthV2?.checks.leakageRisk ?? 0}`} />
            <Mini label="1H Gaps" value={`${modelHealthV2?.checks.missingFirstHalfScores ?? 0}`} />
          </div>
        </Panel>

        <Panel title="Injury & Lineup">
          <p className="text-sm text-slate-400">
            Trial records validate architecture only and cannot improve production confidence.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini
              label="Trial Rows"
              value={`${modelHealthV2?.checks.trialInjuryRows ?? health?.injuryLineup?.injuryFeed.trialCount ?? 0}`}
            />
            <Mini
              label="Prod Rows"
              value={`${modelHealthV2?.checks.productionEligibleInjuryRows ?? 0}`}
            />
            <Mini
              label="Stale"
              value={modelHealthV2?.checks.injuryFeedStale ? 'yes' : 'no'}
            />
            <Mini
              label="Lineups"
              value={data?.summary.lineupFeedStatus ?? health?.injuryLineup?.lineupFeed.availabilityStatus ?? 'unknown'}
            />
          </div>
        </Panel>

        <Panel title="Settlement">
          <p className="text-sm text-slate-400">
            Browser settlement is disabled. Use the protected POST endpoint with CRON_SECRET.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Pending" value={`${performance?.overall.pending ?? 0}`} />
            <Mini label="Voids" value={`${performance?.overall.voids ?? 0}`} />
          </div>
        </Panel>
      </div>

      {best ? (
        <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-950/10 p-6">
          <p className="text-sm font-bold text-violet-300">Best NBA Prediction</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-2xl font-black text-white">
                {best.team} {formatOdds(best.odds)}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {best.market.replace('_', ' ')} vs {best.opponent} - {best.sportsbook}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                {best.explanation.summary}
              </p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-white">{best.adaptiveScore}</p>
              <p className="text-xs text-slate-500">Adaptive Score</p>
            </div>
          </div>
        </div>
      ) : null}

      {health?.issues.length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="font-bold text-amber-300">Model Health Notes</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {health.issues.slice(0, 5).map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="font-bold text-amber-300">Validation & Settlement Warnings</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {warnings.slice(0, 6).map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="Market Performance">
          <div className="space-y-2">
            {(performance?.byMarket ?? []).slice(0, 6).map((row) => (
              <div key={row.market} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{row.market.replace('_', ' ')}</span>
                <span className="font-bold text-white">
                  {row.wins}-{row.losses}-{row.pushes} / {pct(row.roi)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Moneyline Calibration">
          <div className="space-y-2">
            {(performance?.calibration ?? []).slice(0, 6).map((row) => (
              <div key={row.bucket} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{row.bucket}</span>
                <span className="font-bold text-white">
                  {pct(row.actualWinRate)} actual / {row.sample} samples
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {backlog?.backlog.length ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-bold text-white">Settlement Backlog</p>
          <div className="mt-3 space-y-2">
            {backlog.backlog.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-col gap-1 border-t border-slate-800 pt-2 text-sm first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between">
                <span className="text-slate-300">
                  {item.selection} - {item.market.replace('_', ' ')}
                </span>
                <span className="text-xs font-bold uppercase text-amber-300">
                  {item.eventStatus} / {item.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 xl:grid-cols-2">
        {(data?.predictions ?? []).slice(0, 8).map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="mb-3 text-sm font-bold text-white">{title}</p>
      {children}
    </div>
  )
}

function PredictionCard({ prediction }: { prediction: NbaPrediction }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">
            {prediction.team} {formatOdds(prediction.odds)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {prediction.market.replace('_', ' ')} - {prediction.sportsbook}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-violet-300">
            {prediction.adaptiveScore}
          </p>
          <p className="text-xs text-slate-500">{prediction.riskGrade}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <Mini label="Prob" value={pct(prediction.modelProbability)} />
        <Mini label="EV" value={pct(prediction.ev)} />
        <Mini label="Edge" value={pct(prediction.edge)} />
        <Mini label="Conf" value={pct(prediction.confidence)} />
      </div>
    </article>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}
