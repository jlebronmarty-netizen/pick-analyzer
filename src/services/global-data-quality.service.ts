import { supabaseAdmin } from '@/lib/supabase-admin'
import { SportKey } from '@/config/sports.config'
import { getSportsRegistry } from '@/services/multi-sport-registry.service'
import { planProviderRoute } from '@/services/provider-intelligence.service'

type Severity = 'info' | 'warning' | 'error' | 'critical'

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  updated_at: string | null
}

type OddsRow = {
  id: string
  sport_key: string
  event_id: string
  sportsbook: string
  market: string
  snapshot_time: string | null
  updated_at: string | null
}

type JobRow = {
  id: string
  sport_key: string
  job_type: string
  status: string
  started_at: string | null
  completed_at: string | null
  error_count: number | null
  last_error: string | null
}

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string | null
  result: string | null
  lifecycle_status: string | null
  commence_time: string | null
}

type QualityRows = {
  events: EventRow[]
  odds: OddsRow[]
  jobs: JobRow[]
  predictions: PredictionRow[]
}

type QualityIssue = {
  id: string
  sportKey: SportKey
  severity: Severity
  category: string
  message: string
  count: number
  recommendation: string
  sampleIds: string[]
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function dateValue(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function isRunningTooLong(job: JobRow) {
  const startedAt = dateValue(job.started_at)
  if (!startedAt || job.status !== 'running') return false
  return Date.now() - startedAt.getTime() > 1000 * 60 * 60
}

function isStale(value: string | null | undefined, hours: number) {
  const date = dateValue(value)
  if (!date) return true
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000
}

async function loadRows(): Promise<QualityRows> {
  const [events, odds, jobs, predictions] = await Promise.all([
    supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, league_key, season, start_time, status, home_score, away_score, updated_at')
      .limit(5000),
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('id, sport_key, event_id, sportsbook, market, snapshot_time, updated_at')
      .limit(5000),
    supabaseAdmin
      .from('sports_sync_jobs')
      .select('id, sport_key, job_type, status, started_at, completed_at, error_count, last_error')
      .limit(1000),
    supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, game_id, result, lifecycle_status, commence_time')
      .limit(5000),
  ])

  if (events.error) throw events.error
  if (odds.error) throw odds.error
  if (jobs.error) throw jobs.error
  if (predictions.error) throw predictions.error

  return {
    events: (events.data ?? []) as EventRow[],
    odds: (odds.data ?? []) as OddsRow[],
    jobs: (jobs.data ?? []) as JobRow[],
    predictions: (predictions.data ?? []) as PredictionRow[],
  }
}

function issue({
  sportKey,
  severity,
  category,
  message,
  rows,
  recommendation,
}: {
  sportKey: SportKey
  severity: Severity
  category: string
  message: string
  rows: { id?: string | null }[]
  recommendation: string
}): QualityIssue | null {
  if (rows.length === 0) return null

  return {
    id: `${sportKey}:${category}:${message}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    sportKey,
    severity,
    category,
    message,
    count: rows.length,
    recommendation,
    sampleIds: rows
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, 10),
  }
}

function sportIssues(sportKey: SportKey, rows: QualityRows) {
  const events = rows.events.filter((row) => row.sport_key === sportKey)
  const odds = rows.odds.filter((row) => row.sport_key === sportKey)
  const jobs = rows.jobs.filter((row) => row.sport_key === sportKey)
  const predictions = rows.predictions.filter((row) => row.sport_key === sportKey)
  const eventIds = new Set(events.map((row) => row.id))

  return [
    issue({
      sportKey,
      severity: 'warning',
      category: 'events',
      message: 'No synced events found',
      rows: events.length === 0 ? [{ id: sportKey }] : [],
      recommendation: 'Run a capped provider-approved schedule sync before prediction generation.',
    }),
    issue({
      sportKey,
      severity: 'error',
      category: 'events',
      message: 'Completed events missing final scores',
      rows: events.filter(
        (row) =>
          row.status === 'completed' &&
          (row.home_score === null || row.away_score === null)
      ),
      recommendation: 'Reconcile scores before settlement or backtesting.',
    }),
    issue({
      sportKey,
      severity: 'warning',
      category: 'odds',
      message: 'No stored odds snapshots found',
      rows: odds.length === 0 ? [{ id: sportKey }] : [],
      recommendation: 'Run only approved capped odds syncs; empty stored odds are valid but block odds-history modules.',
    }),
    issue({
      sportKey,
      severity: 'warning',
      category: 'odds',
      message: 'Stored odds snapshots are stale',
      rows: odds.filter((row) => isStale(row.snapshot_time, 24)),
      recommendation: 'Refresh current/upcoming odds only after confirming provider quota.',
    }),
    issue({
      sportKey,
      severity: 'error',
      category: 'predictions',
      message: 'Predictions reference missing synced events',
      rows: predictions.filter((row) => row.game_id && !eventIds.has(row.game_id)),
      recommendation: 'Do not settle or backtest predictions until event mappings are reconciled.',
    }),
    issue({
      sportKey,
      severity: 'warning',
      category: 'settlement',
      message: 'Completed predictions are not settled',
      rows: predictions.filter(
        (row) =>
          row.result === 'pending' &&
          row.lifecycle_status &&
          !['settled', 'void', 'skipped'].includes(row.lifecycle_status)
      ),
      recommendation: 'Run settlement only after scores are available.',
    }),
    issue({
      sportKey,
      severity: 'error',
      category: 'sync_jobs',
      message: 'Sync jobs failed',
      rows: jobs.filter((row) => row.status === 'failed' || Number(row.error_count ?? 0) > 0),
      recommendation: 'Inspect last_error and rerun only small, idempotent sync windows.',
    }),
    issue({
      sportKey,
      severity: 'warning',
      category: 'sync_jobs',
      message: 'Sync jobs are still running or stale',
      rows: jobs.filter((row) => isRunningTooLong(row)),
      recommendation: 'Check job observability before starting overlapping sync work.',
    }),
  ].filter((item): item is QualityIssue => Boolean(item))
}

function coveragePercent(total: number, expected: number) {
  if (expected <= 0) return total > 0 ? 100 : 0
  return round(Math.min(100, (total / expected) * 100))
}

function sportSummary(sportKey: SportKey, rows: QualityRows) {
  const events = rows.events.filter((row) => row.sport_key === sportKey)
  const odds = rows.odds.filter((row) => row.sport_key === sportKey)
  const jobs = rows.jobs.filter((row) => row.sport_key === sportKey)
  const predictions = rows.predictions.filter((row) => row.sport_key === sportKey)
  const completedEvents = events.filter((row) => row.status === 'completed')
  const settledPredictions = predictions.filter((row) =>
    ['settled', 'void'].includes(String(row.lifecycle_status ?? ''))
  )
  const expectedEvents = Math.max(1, events.length)

  return {
    sportKey,
    coverage: {
      events: {
        total: events.length,
        expected: expectedEvents,
        percent: coveragePercent(events.length, expectedEvents),
      },
      completedScores: {
        total: completedEvents.filter(
          (row) => row.home_score !== null && row.away_score !== null
        ).length,
        expected: Math.max(1, completedEvents.length),
        percent: coveragePercent(
          completedEvents.filter(
            (row) => row.home_score !== null && row.away_score !== null
          ).length,
          Math.max(1, completedEvents.length)
        ),
      },
      oddsSnapshots: {
        total: odds.length,
        expected: expectedEvents,
        percent: coveragePercent(odds.length, expectedEvents),
      },
      predictions: {
        total: predictions.length,
        expected: expectedEvents,
        percent: coveragePercent(predictions.length, expectedEvents),
      },
      settledPredictions: {
        total: settledPredictions.length,
        expected: Math.max(1, predictions.length),
        percent: coveragePercent(settledPredictions.length, Math.max(1, predictions.length)),
      },
    },
    freshness: {
      latestEventUpdate:
        events
          .map((row) => row.updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      latestOddsSnapshot:
        odds
          .map((row) => row.snapshot_time)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      latestSyncJob:
        jobs
          .map((row) => row.started_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
    },
    counts: {
      events: events.length,
      odds: odds.length,
      jobs: jobs.length,
      predictions: predictions.length,
    },
  }
}

function statusFromIssues(issues: QualityIssue[]) {
  if (issues.some((item) => item.severity === 'critical')) return 'critical'
  if (issues.some((item) => item.severity === 'error')) return 'error'
  if (issues.some((item) => item.severity === 'warning')) return 'warning'
  return 'healthy'
}

function estimateCalls(summary: ReturnType<typeof sportSummary>, sportKey: SportKey) {
  const eventCalls = summary.counts.events === 0 ? 1 : 0
  const oddsCalls = summary.counts.odds === 0 ? 1 : 0
  const scoreCalls =
    summary.coverage.completedScores.percent < 100 && summary.counts.events > 0 ? 1 : 0
  const providerPlan = planProviderRoute({
    sportKey,
    dataType: 'schedules',
    dryRun: true,
  })

  return {
    eventCalls,
    oddsCalls,
    scoreCalls,
    total: eventCalls + oddsCalls + scoreCalls,
    providerSupported: providerPlan.success && providerPlan.supported,
    selectedProvider: providerPlan.selectedProvider?.providerName ?? null,
  }
}

export async function getGlobalDataQualityAudit() {
  const rows = await loadRows()
  const sports = getSportsRegistry()
  const summaries = sports.map((sport) => sportSummary(sport.key, rows))
  const issues = sports.flatMap((sport) => sportIssues(sport.key, rows))
  const severityCounts = {
    info: issues.filter((item) => item.severity === 'info').length,
    warning: issues.filter((item) => item.severity === 'warning').length,
    error: issues.filter((item) => item.severity === 'error').length,
    critical: issues.filter((item) => item.severity === 'critical').length,
  }

  return {
    success: true,
    mode: 'global_data_quality_framework_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_tables',
    },
    status: statusFromIssues(issues),
    summary: {
      sportsChecked: sports.length,
      issues: issues.length,
      severityCounts,
      events: rows.events.length,
      oddsSnapshots: rows.odds.length,
      syncJobs: rows.jobs.length,
      predictions: rows.predictions.length,
    },
    sports: summaries,
    issues,
  }
}

export async function getGlobalReconciliationPlan() {
  const audit = await getGlobalDataQualityAudit()
  const plans = audit.sports.map((summary) => {
    const estimates = estimateCalls(summary, summary.sportKey)
    return {
      sportKey: summary.sportKey,
      dryRun: true,
      externalProviderCallsMade: 0,
      estimatedProviderCalls: estimates.total,
      estimatedQuotaImpact:
        estimates.total === 0 ? 'none' : estimates.total <= 2 ? 'low' : 'medium',
      selectedProvider: estimates.selectedProvider,
      providerSupported: estimates.providerSupported,
      recommendedBatchSize: estimates.total > 2 ? 3 : 1,
      executionOrder: [
        ...(estimates.eventCalls ? ['events'] : []),
        ...(estimates.scoreCalls ? ['scores'] : []),
        ...(estimates.oddsCalls ? ['odds'] : []),
        'quality_audit',
      ],
      blockers: estimates.providerSupported
        ? []
        : ['No configured provider capability supports the estimated refresh path.'],
    }
  })

  const totalEstimatedProviderCalls = plans.reduce(
    (sum, plan) => sum + plan.estimatedProviderCalls,
    0
  )

  return {
    success: true,
    mode: 'global_reconciliation_plan_v1',
    generatedAt: new Date().toISOString(),
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
    },
    status: audit.status,
    totalEstimatedProviderCalls,
    estimatedQuotaImpact:
      totalEstimatedProviderCalls === 0
        ? 'none'
        : totalEstimatedProviderCalls <= 10
          ? 'low'
          : 'medium',
    plans,
    warnings: [
      'This is a planning response only. It does not execute provider calls.',
      ...(totalEstimatedProviderCalls > 0
        ? ['Provider quota approval is required before executing any plan.']
        : []),
    ],
  }
}
