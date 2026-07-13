import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProviderIntelligence } from '@/services/provider-intelligence.service'

type SyncJobRow = {
  id: string
  sport_key: string
  job_type: string
  provider: string
  status: string
  started_at: string | null
  completed_at: string | null
  records_fetched: number | null
  records_inserted: number | null
  records_updated: number | null
  records_skipped: number | null
  error_count: number | null
  last_error: string | null
  duration_ms: number | null
}

type PredictionRow = {
  id: string
  sport_key: string
  market: string | null
  result: string | null
  lifecycle_status: string | null
  validation_status: string | null
  created_at: string | null
  generated_at: string | null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (!clean.length) return 0
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length)
}

function groupCount<T>(rows: T[], keyFn: (row: T) => string) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

function isStaleRunning(job: SyncJobRow) {
  if (job.status !== 'running' || !job.started_at) return false
  const startedAt = new Date(job.started_at).getTime()
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt > 1000 * 60 * 60
}

async function loadRows() {
  const [jobs, predictions] = await Promise.all([
    supabaseAdmin
      .from('sports_sync_jobs')
      .select(
        'id, sport_key, job_type, provider, status, started_at, completed_at, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms'
      )
      .order('started_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, market, result, lifecycle_status, validation_status, created_at, generated_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (jobs.error) throw jobs.error
  if (predictions.error) throw predictions.error

  return {
    jobs: (jobs.data ?? []) as SyncJobRow[],
    predictions: (predictions.data ?? []) as PredictionRow[],
  }
}

export async function getRuntimeObservability() {
  const rows = await loadRows()
  const providerIntel = getProviderIntelligence()
  const failedJobs = rows.jobs.filter((job) => job.status === 'failed')
  const staleRunningJobs = rows.jobs.filter(isStaleRunning)
  const partialJobs = rows.jobs.filter((job) => job.status === 'partial')
  const pendingPredictions = rows.predictions.filter(
    (row) => row.result === 'pending' || row.lifecycle_status === 'active'
  )
  const failedValidations = rows.predictions.filter(
    (row) => row.validation_status === 'failed'
  )
  const unsettledClosed = rows.predictions.filter(
    (row) =>
      row.result === 'pending' &&
      row.lifecycle_status &&
      !['settled', 'void', 'skipped'].includes(row.lifecycle_status)
  )
  const warningCount =
    partialJobs.length +
    staleRunningJobs.length +
    pendingPredictions.length +
    providerIntel.summary.degradedProviders
  const errorCount =
    failedJobs.length +
    failedValidations.length +
    providerIntel.summary.unavailableProviders

  return {
    success: true,
    mode: 'runtime_observability_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_tables_and_static_provider_registry',
    },
    status:
      errorCount > 0
        ? 'error'
        : warningCount > 0
          ? 'warning'
          : 'healthy',
    summary: {
      syncJobs: rows.jobs.length,
      failedJobs: failedJobs.length,
      partialJobs: partialJobs.length,
      staleRunningJobs: staleRunningJobs.length,
      predictions: rows.predictions.length,
      pendingPredictions: pendingPredictions.length,
      failedValidations: failedValidations.length,
      unsettledClosed: unsettledClosed.length,
      warningCount,
      errorCount,
      averageJobDurationMs: avg(
        rows.jobs.map((job) => Number(job.duration_ms ?? 0)).filter(Boolean)
      ),
      providers: providerIntel.summary.providers,
      unavailableProviders: providerIntel.summary.unavailableProviders,
    },
    syncJobs: {
      byStatus: groupCount(rows.jobs, (job) => job.status),
      byType: groupCount(rows.jobs, (job) => job.job_type),
      bySport: groupCount(rows.jobs, (job) => job.sport_key),
      recentFailures: failedJobs.slice(0, 10).map((job) => ({
        id: job.id,
        sportKey: job.sport_key,
        jobType: job.job_type,
        provider: job.provider,
        startedAt: job.started_at,
        lastError: job.last_error,
        errorCount: job.error_count ?? 0,
      })),
    },
    predictions: {
      bySport: groupCount(rows.predictions, (row) => row.sport_key),
      byResult: groupCount(rows.predictions, (row) => row.result ?? 'unknown'),
      byLifecycle: groupCount(
        rows.predictions,
        (row) => row.lifecycle_status ?? 'legacy'
      ),
      byValidation: groupCount(
        rows.predictions,
        (row) => row.validation_status ?? 'legacy'
      ),
    },
    providers: {
      status: providerIntel.status,
      summary: providerIntel.summary,
      unavailable: providerIntel.providers
        .filter((provider) => provider.health === 'unavailable')
        .map((provider) => ({
          id: provider.id,
          name: provider.name,
          reason: provider.unavailableReason,
        })),
    },
    warnings: [
      ...(staleRunningJobs.length
        ? [`${staleRunningJobs.length} sync job(s) appear stale while running.`]
        : []),
      ...(pendingPredictions.length
        ? [`${pendingPredictions.length} prediction(s) are pending or active.`]
        : []),
      ...(providerIntel.summary.unavailableProviders
        ? [`${providerIntel.summary.unavailableProviders} provider(s) are unavailable by configuration.`]
        : []),
    ],
  }
}
