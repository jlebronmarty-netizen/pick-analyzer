import { SportKey } from '@/config/sports.config'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getLeaguesForSport, getSportsRegistry } from '@/services/multi-sport-registry.service'
import {
  CostTier,
  ProviderDataType,
  planProviderRoute,
} from '@/services/provider-intelligence.service'
import {
  createCursorContract,
  getDefaultRetryPolicy,
  idempotencyKey,
} from '@/services/sync-reliability.service'

export type HistoricalImportScope = 'date_range' | 'season'
export type HistoricalImportStatus =
  | 'planned'
  | 'blocked'
  | 'running'
  | 'partial'
  | 'completed'
  | 'failed'

export type HistoricalImportRequest = {
  sportKey?: string | null
  leagueKey?: string | null
  providerId?: string | null
  season?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  dataTypes?: string[] | null
  dryRun?: boolean | null
  batchSizeDays?: number | null
}

export type HistoricalImportCheckpoint = {
  id: string
  sequence: number
  scope: HistoricalImportScope
  sportKey: SportKey
  leagueKey: string | null
  providerId: string | null
  dataType: ProviderDataType
  season: string | null
  dateFrom: string | null
  dateTo: string | null
  status: 'planned' | 'blocked'
  cursor: ReturnType<typeof createCursorContract>
  idempotencyKey: string
  dedupeKey: string
  estimatedProviderCalls: number
  warnings: string[]
}

export type HistoricalImportPlan = {
  success: boolean
  mode: 'historical_import_engine_core_v1'
  dryRun: true
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'dry_run_planner_only'
  }
  request: {
    sportKey: SportKey | null
    leagueKey: string | null
    providerId: string | null
    season: string | null
    dateFrom: string | null
    dateTo: string | null
    dataTypes: ProviderDataType[]
    batchSizeDays: number
  }
  status: HistoricalImportStatus
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  job: {
    id: string
    status: HistoricalImportStatus
    progressPercent: number
    totalCheckpoints: number
    blockedCheckpoints: number
    executableCheckpoints: number
    recordsFetched: 0
    recordsInserted: 0
    recordsUpdated: 0
    recordsSkipped: 0
    errorCount: number
  }
  quotaEstimate: {
    estimatedProviderCalls: number
    costTier: CostTier
    quotaImpact: 'none' | 'low' | 'medium' | 'high'
    recommendedBatchSizeDays: number
    warning: string
  }
  executionPlan: {
    order: string[]
    retryPolicy: ReturnType<typeof getDefaultRetryPolicy>
    partialFailureIsolation: string
    idempotency: string
    deduplication: string
    providerEntityMapping: string
    persistence: string
  }
  checkpoints: HistoricalImportCheckpoint[]
}

type SyncJobRow = {
  id: string
  job_type: string
  sport_key: string
  league_key: string | null
  provider: string
  season: string | null
  started_at: string | null
  completed_at: string | null
  status: string
  records_fetched: number | null
  records_inserted: number | null
  records_updated: number | null
  records_skipped: number | null
  error_count: number | null
  last_error: string | null
  duration_ms: number | null
  metadata: Record<string, unknown> | null
}

const IMPORT_DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
]

const DEFAULT_DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'odds',
]

const DATA_TYPE_ORDER: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
  'player_props',
  'play_by_play',
  'live_data',
]

function generatedAt() {
  return new Date().toISOString()
}

function isSportKey(value: string | null | undefined): value is SportKey {
  return getSportsRegistry().some((sport) => sport.key === value)
}

function isImportDataType(value: string): value is ProviderDataType {
  return IMPORT_DATA_TYPES.includes(value as ProviderDataType)
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1
}

function clampBatchSize(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 7
  return Math.max(1, Math.min(Math.floor(value), 31))
}

function normalizeDataTypes(values: string[] | null | undefined) {
  if (!values || values.length === 0) return DEFAULT_DATA_TYPES

  const unique = Array.from(new Set(values.map((value) => value.trim())))
  return DATA_TYPE_ORDER.filter((dataType) =>
    unique.includes(dataType)
  ) as ProviderDataType[]
}

function costTierRank(costTier: CostTier) {
  if (costTier === 'internal') return 0
  if (costTier === 'low') return 1
  if (costTier === 'medium') return 2
  if (costTier === 'high') return 3
  return 2
}

function maxCostTier(values: CostTier[]): CostTier {
  return values.sort((a, b) => costTierRank(b) - costTierRank(a))[0] ?? 'unknown'
}

function quotaImpact(calls: number, costTier: CostTier) {
  if (calls === 0) return 'none'
  if (costTier === 'high' || calls > 250) return 'high'
  if (costTier === 'medium' || calls > 50) return 'medium'
  return 'low'
}

function buildDateWindows({
  dateFrom,
  dateTo,
  batchSizeDays,
}: {
  dateFrom: string | null
  dateTo: string | null
  batchSizeDays: number
}) {
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)

  if (!from || !to || from.getTime() > to.getTime()) return []

  const windows: Array<{ dateFrom: string; dateTo: string }> = []
  let cursor = from

  while (cursor.getTime() <= to.getTime()) {
    const end = new Date(Math.min(addDays(cursor, batchSizeDays - 1).getTime(), to.getTime()))
    windows.push({
      dateFrom: dateOnly(cursor),
      dateTo: dateOnly(end),
    })
    cursor = addDays(end, 1)
  }

  return windows
}

function buildCheckpoints({
  sportKey,
  leagueKey,
  providerId,
  season,
  dateFrom,
  dateTo,
  dataTypes,
  batchSizeDays,
}: {
  sportKey: SportKey
  leagueKey: string | null
  providerId: string | null
  season: string | null
  dateFrom: string | null
  dateTo: string | null
  dataTypes: ProviderDataType[]
  batchSizeDays: number
}) {
  const windows = buildDateWindows({ dateFrom, dateTo, batchSizeDays })
  const hasDateScope = windows.length > 0
  const dateScopes = hasDateScope
    ? windows
    : [{ dateFrom: null, dateTo: null }]
  const checkpoints: HistoricalImportCheckpoint[] = []
  const costTiers: CostTier[] = []
  const validationWarnings: string[] = []

  for (const dataType of dataTypes) {
    const route = planProviderRoute({
      sportKey,
      leagueKey,
      providerId,
      dataType,
      dryRun: true,
    })
    const selectedProvider = route.success ? route.selectedProvider : null
    const warnings =
      route.success && route.explanation.length
        ? route.explanation
        : ['Provider route could not be planned for this data type.']
    const status = route.success && route.supported ? 'planned' : 'blocked'

    if (selectedProvider?.costTier) {
      costTiers.push(selectedProvider.costTier)
    }

    if (status === 'blocked') {
      validationWarnings.push(
        `No executable provider route for ${dataType} on ${sportKey}.`
      )
    }

    for (const scope of dateScopes) {
      const sequence = checkpoints.length + 1
      const checkpointProvider = selectedProvider?.providerId ?? providerId
      const key = idempotencyKey([
        'historical-import',
        sportKey,
        leagueKey,
        checkpointProvider,
        dataType,
        season,
        scope.dateFrom,
        scope.dateTo,
      ])

      checkpoints.push({
        id: key,
        sequence,
        scope: hasDateScope ? 'date_range' : 'season',
        sportKey,
        leagueKey,
        providerId: checkpointProvider ?? null,
        dataType,
        season,
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
        status,
        cursor: createCursorContract({
          cursor: null,
          nextCursor: null,
          pageSize: batchSizeDays,
          returned: 0,
        }),
        idempotencyKey: key,
        dedupeKey: idempotencyKey([
          sportKey,
          leagueKey,
          dataType,
          scope.dateFrom ?? season,
        ]),
        estimatedProviderCalls: status === 'planned' ? 1 : 0,
        warnings,
      })
    }
  }

  return {
    checkpoints,
    costTier: maxCostTier(costTiers),
    validationWarnings,
  }
}

export function planHistoricalImport(
  request: HistoricalImportRequest = {}
): HistoricalImportPlan {
  const errors: string[] = []
  const warnings: string[] = []
  const sportKey = isSportKey(request.sportKey) ? request.sportKey : null
  const leagueKey = request.leagueKey?.trim() || null
  const providerId = request.providerId?.trim() || null
  const season = request.season?.trim() || null
  const dateFrom = request.dateFrom?.trim() || null
  const dateTo = request.dateTo?.trim() || null
  const batchSizeDays = clampBatchSize(request.batchSizeDays)
  const dataTypes = normalizeDataTypes(request.dataTypes)
  const invalidDataTypes =
    request.dataTypes?.filter((value) => !isImportDataType(value)) ?? []

  if (!sportKey) {
    errors.push('sportKey must be a configured sport.')
  }

  if (sportKey && leagueKey) {
    const leagues = getLeaguesForSport(sportKey).map((league) => league.key)
    if (!leagues.includes(leagueKey)) {
      warnings.push(`${leagueKey} is not registered for ${sportKey}; plan will remain dry-run.`)
    }
  }

  if (invalidDataTypes.length > 0) {
    errors.push(
      `Unsupported import dataTypes: ${invalidDataTypes.join(', ')}.`
    )
  }

  if (!season && (!dateFrom || !dateTo)) {
    errors.push('Provide either a season or dateFrom/dateTo.')
  }

  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  if ((dateFrom || dateTo) && (!from || !to)) {
    errors.push('dateFrom and dateTo must be valid YYYY-MM-DD dates.')
  }

  if (from && to && from.getTime() > to.getTime()) {
    errors.push('dateFrom must be before or equal to dateTo.')
  }

  if (request.dryRun === false) {
    warnings.push('Execution is disabled in Historical Import Engine Core; dryRun was forced to true.')
  }

  const checkpointResult =
    errors.length === 0 && sportKey
      ? buildCheckpoints({
          sportKey,
          leagueKey,
          providerId,
          season,
          dateFrom,
          dateTo,
          dataTypes,
          batchSizeDays,
        })
      : {
          checkpoints: [] as HistoricalImportCheckpoint[],
          costTier: 'unknown' as CostTier,
          validationWarnings: [] as string[],
        }
  const allWarnings = [...warnings, ...checkpointResult.validationWarnings]
  const estimatedProviderCalls = checkpointResult.checkpoints.reduce(
    (sum, item) => sum + item.estimatedProviderCalls,
    0
  )
  const blockedCheckpoints = checkpointResult.checkpoints.filter(
    (item) => item.status === 'blocked'
  ).length
  const status =
    errors.length > 0
      ? 'blocked'
      : blockedCheckpoints === checkpointResult.checkpoints.length &&
          checkpointResult.checkpoints.length > 0
        ? 'blocked'
        : 'planned'
  const jobId = idempotencyKey([
    'historical-import-plan',
    sportKey,
    leagueKey,
    providerId,
    season,
    dateFrom,
    dateTo,
    dataTypes.join('-'),
    batchSizeDays,
  ])

  return {
    success: errors.length === 0,
    mode: 'historical_import_engine_core_v1',
    dryRun: true,
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'dry_run_planner_only',
    },
    request: {
      sportKey,
      leagueKey,
      providerId,
      season,
      dateFrom,
      dateTo,
      dataTypes,
      batchSizeDays,
    },
    status,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings: allWarnings,
    },
    job: {
      id: jobId,
      status,
      progressPercent: 0,
      totalCheckpoints: checkpointResult.checkpoints.length,
      blockedCheckpoints,
      executableCheckpoints: checkpointResult.checkpoints.length - blockedCheckpoints,
      recordsFetched: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errorCount: errors.length,
    },
    quotaEstimate: {
      estimatedProviderCalls,
      costTier: checkpointResult.costTier,
      quotaImpact: quotaImpact(estimatedProviderCalls, checkpointResult.costTier),
      recommendedBatchSizeDays: batchSizeDays,
      warning:
        estimatedProviderCalls === 0
          ? 'No provider calls are required for this dry-run response.'
          : 'These calls are estimates only; Core V1 does not execute external provider imports.',
    },
    executionPlan: {
      order: dataTypes,
      retryPolicy: getDefaultRetryPolicy(),
      partialFailureIsolation:
        'Each checkpoint is independently idempotent and can be retried without advancing sibling checkpoints.',
      idempotency:
        'Idempotency keys combine sport, league, provider, data type, season and date window.',
      deduplication:
        'Normalized persistence must upsert by provider entity mapping or table-specific natural keys.',
      providerEntityMapping:
        'Provider IDs should resolve through provider_entity_mappings before writing normalized entities.',
      persistence:
        'Core V1 is read-only/dry-run; future execution can record status in sports_sync_jobs metadata.',
    },
    checkpoints: checkpointResult.checkpoints,
  }
}

export async function getHistoricalImportHealth() {
  const [jobsResult, mappingsResult] = await Promise.allSettled([
    supabaseAdmin
      .from('sports_sync_jobs')
      .select(
        'id, job_type, sport_key, league_key, provider, season, started_at, completed_at, status, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms, metadata'
      )
      .order('started_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('provider_entity_mappings')
      .select('sport_key, entity_type, provider, season')
      .limit(5000),
  ])

  const jobWarning =
    jobsResult.status === 'rejected'
      ? `sports_sync_jobs unavailable: ${jobsResult.reason instanceof Error ? jobsResult.reason.message : 'unknown error'}`
      : jobsResult.value.error
        ? `sports_sync_jobs unavailable: ${jobsResult.value.error.message}`
        : null
  const mappingWarning =
    mappingsResult.status === 'rejected'
      ? `provider_entity_mappings unavailable: ${mappingsResult.reason instanceof Error ? mappingsResult.reason.message : 'unknown error'}`
      : mappingsResult.value.error
        ? `provider_entity_mappings unavailable: ${mappingsResult.value.error.message}`
        : null

  const jobsData =
    jobsResult.status === 'fulfilled' && !jobsResult.value.error
      ? jobsResult.value.data
      : []
  const mappingsData =
    mappingsResult.status === 'fulfilled' && !mappingsResult.value.error
      ? mappingsResult.value.data
      : []
  const jobs = ((jobsData ?? []) as SyncJobRow[]).map((job) => ({
    ...job,
    error_count: job.error_count ?? 0,
  }))
  const mappings = mappingsData ?? []
  const failedJobs = jobs.filter((job) => job.status === 'failed')
  const runningJobs = jobs.filter((job) => job.status === 'running')
  const partialJobs = jobs.filter((job) => job.status === 'partial')
  const status =
    jobWarning || mappingWarning
      ? 'degraded'
      : failedJobs.length > 0
      ? 'degraded'
      : runningJobs.length > 0 || partialJobs.length > 0
        ? 'watch'
        : 'ready'

  return {
    success: true,
    mode: 'historical_import_engine_core_health_v1',
    generatedAt: generatedAt(),
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_metadata_only',
    },
    status,
    summary: {
      recentJobs: jobs.length,
      failedJobs: failedJobs.length,
      runningJobs: runningJobs.length,
      partialJobs: partialJobs.length,
      providerMappings: mappings.length,
      sportsWithMappings: new Set(mappings.map((row) => row.sport_key)).size,
      providersWithMappings: new Set(mappings.map((row) => row.provider)).size,
    },
    capabilities: {
      dryRunPlanning: true,
      resumableCheckpoints: true,
      providerEntityMapping: true,
      idempotencyKeys: true,
      retryPolicy: true,
      externalExecution: false,
    },
    warnings: [
      ...[jobWarning, mappingWarning].filter((item): item is string => Boolean(item)),
      'Core V1 does not execute provider imports.',
      'Manual provider activation, quota caps and optional persistence migrations belong to a later execution phase.',
    ],
  }
}

export async function listHistoricalImportJobs() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select(
      'id, job_type, sport_key, league_key, provider, season, started_at, completed_at, status, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms, metadata'
    )
    .order('started_at', { ascending: false })
    .limit(100)
    .then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    )

  const warning =
    result.status === 'rejected'
      ? `sports_sync_jobs unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`
      : result.value.error
        ? `sports_sync_jobs unavailable: ${result.value.error.message}`
        : null

  const data =
    result.status === 'fulfilled' && !result.value.error ? result.value.data : []
  const jobs = ((data ?? []) as SyncJobRow[]).map((job) => ({
    id: job.id,
    jobType: job.job_type,
    sportKey: job.sport_key,
    leagueKey: job.league_key,
    provider: job.provider,
    season: job.season,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    status: job.status,
    durationMs: job.duration_ms,
    counters: {
      fetched: job.records_fetched ?? 0,
      inserted: job.records_inserted ?? 0,
      updated: job.records_updated ?? 0,
      skipped: job.records_skipped ?? 0,
      errors: job.error_count ?? 0,
    },
    lastError: job.last_error,
    metadata: job.metadata ?? {},
  }))

  return {
    success: true,
    mode: 'historical_import_engine_core_jobs_v1',
    generatedAt: generatedAt(),
    dryRun: true,
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'sports_sync_jobs_read_only',
    },
    summary: {
      jobs: jobs.length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      running: jobs.filter((job) => job.status === 'running').length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      partial: jobs.filter((job) => job.status === 'partial').length,
    },
    warnings: [
      ...(warning ? [warning] : []),
      'Core V1 jobs endpoint is read-only and returns an empty typed response when Supabase metadata is unavailable.',
    ],
    jobs,
  }
}
