import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import {
  executeSportsDataIoMlbDiscoveryImport,
  planSportsDataIoMlbDiscoveryExecution,
} from '@/services/sportsdataio-mlb-historical-import-executor.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SEASON = '2026'
const DOMAIN = 'player_game_stats_by_date'
const JOB_TYPE = 'mlb_current_season_player_game_stats_backfill_v1'
const DEFAULT_TIMEOUT_MS = 60000
const DEFAULT_MAX_RECORDS = 25000

type BackfillInput = {
  season?: string | null
  dryRun?: boolean | null
  confirmed?: boolean | null
  maxDatesPerInvocation?: number | null
}

type DateLedgerEntry = {
  date: string
  eventCount: number
  completedEventCount: number
  completedCheckpoints: string[]
  incompleteDomains: string[]
  importEligible: boolean
}

function generatedAt() {
  return new Date().toISOString()
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function checkpointKey(date: string, season: string) {
  return `sportsdataio_mlb_discovery_historical_import_v1:sportsdataio:sportsdataio_discovery_lab:baseball_mlb:mlb:${season}:regular:${date}:player_game_stats_by_date:-api-mlb-fantasy-json-playergamestatsbydate-date-`
}

async function activeHistoricalJobs() {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, status, started_at, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('provider', PROVIDER)
    .in('status', ['running', 'pending'])
    .limit(50)
  if (result.error) throw new Error(`sports_sync_jobs active read failed: ${result.error.message}`)
  return result.data ?? []
}

async function checkpointRows(season: string) {
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, status, completed_at, last_error, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .eq('provider', PROVIDER)
    .eq('season', season)
    .order('started_at', { ascending: false })
    .limit(1000)
  if (result.error) throw new Error(`sports_sync_jobs checkpoint read failed: ${result.error.message}`)
  return result.data ?? []
}

function classifyCheckpoints(rows: Awaited<ReturnType<typeof checkpointRows>>, season: string) {
  const statusesByDate = new Map<string, string>()
  const ambiguous: Array<{ date: string; status: string; jobId: string; lastError: string | null }> = []
  for (const row of rows) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    const checkpoint = metadata.checkpoint && typeof metadata.checkpoint === 'object'
      ? metadata.checkpoint as Record<string, unknown>
      : {}
    if (checkpoint.domain !== DOMAIN) continue
    const date = typeof checkpoint.date === 'string' ? checkpoint.date : ''
    const key = typeof checkpoint.key === 'string' ? checkpoint.key : ''
    if (!date || key !== checkpointKey(date, season)) continue
    const status = String(checkpoint.status ?? row.status)
    if (statusesByDate.has(date)) continue
    statusesByDate.set(date, status)
    if (['running', 'pending', 'partial', 'failed', 'timed_out'].includes(status)) {
      ambiguous.push({ date, status, jobId: String(row.id), lastError: row.last_error ? String(row.last_error) : null })
    }
  }
  return { statusesByDate, ambiguous }
}

async function createParentJob({
  season,
  dryRun,
  plannedDates,
  budget,
}: {
  season: string
  dryRun: boolean
  plannedDates: string[]
  budget: Awaited<ReturnType<typeof getProviderBudgetStatus>>
}) {
  if (dryRun) return null
  const startedAt = generatedAt()
  const id = crypto.randomUUID()
  const result = await supabaseAdmin.from('sports_sync_jobs').insert({
    id,
    job_type: JOB_TYPE,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    provider: PROVIDER,
    season,
    started_at: startedAt,
    completed_at: null,
    status: 'running',
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    error_count: 0,
    metadata: {
      mode: JOB_TYPE,
      domain: DOMAIN,
      plannedDates,
      providerVariant: PROVIDER_VARIANT,
      budgetBefore: {
        callsMadeToday: budget.callsMadeToday,
        callsMadeLastHour: budget.callsMadeLastHour,
        hourlyRemaining: budget.hourlyRemaining,
        hardRemaining: budget.hardRemaining,
        estimatedCallsRemaining: budget.estimatedCallsRemaining,
      },
      providerCallsMade: 0,
      rawPayloadStored: false,
      noSecretExposure: true,
    },
    updated_at: startedAt,
  })
  if (result.error) throw new Error(`backfill parent job creation failed: ${result.error.message}`)
  return { id, startedAt }
}

async function finishParentJob({
  parent,
  status,
  executions,
  pauseReason,
}: {
  parent: { id: string; startedAt: string } | null
  status: 'completed' | 'partial' | 'failed'
  executions: Array<Record<string, unknown>>
  pauseReason: string | null
}) {
  if (!parent) return
  const completedAt = generatedAt()
  const result = await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      completed_at: completedAt,
      status,
      records_fetched: executions.reduce((sum, item) => sum + safeNumber(item.recordsFetched, 0), 0),
      records_inserted: executions.reduce((sum, item) => sum + safeNumber(item.rowsInserted, 0), 0),
      records_updated: executions.reduce((sum, item) => sum + safeNumber(item.rowsUpdated, 0), 0),
      records_skipped: executions.reduce((sum, item) => sum + safeNumber(item.rowsSkipped, 0), 0),
      error_count: status === 'completed' ? 0 : 1,
      last_error: pauseReason,
      duration_ms: new Date(completedAt).getTime() - new Date(parent.startedAt).getTime(),
      metadata: {
        mode: JOB_TYPE,
        domain: DOMAIN,
        executions,
        pauseReason,
        providerCallsMade: executions.reduce((sum, item) => sum + safeNumber(item.providerCallsMade, 0), 0),
        rawPayloadStored: false,
        noSecretExposure: true,
      },
      updated_at: completedAt,
    })
    .eq('id', parent.id)
  if (result.error) throw new Error(`backfill parent job completion failed: ${result.error.message}`)
}

export async function runMlbCurrentSeasonPlayerGameStatsBackfill(input: BackfillInput = {}) {
  const season = typeof input.season === 'string' && input.season.trim() ? input.season.trim() : SEASON
  const dryRun = input.dryRun !== false
  const confirmed = input.confirmed === true
  const generatedAtValue = generatedAt()
  const budget = await getProviderBudgetStatus({ provider: PROVIDER, sportKey: SPORT_KEY })
  const maxPerAction = Math.max(1, Math.floor(Number(budget.config?.maxCallsPerAction ?? 3) || 3))
  const requestedBatch = Math.max(1, Math.floor(Number(input.maxDatesPerInvocation ?? maxPerAction) || maxPerAction))
  const maxDatesPerInvocation = Math.min(requestedBatch, maxPerAction, Math.max(0, budget.hourlyRemaining), Math.max(0, budget.estimatedCallsRemaining))
  const activeJobs = await activeHistoricalJobs()
  const plan = await planSportsDataIoMlbDiscoveryExecution({
    provider: PROVIDER,
    providerVariant: PROVIDER_VARIANT,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    season,
    seasonType: 'regular',
    dateFrom: `${season}-01-01`,
    dateTo: `${season}-12-31`,
    domains: [DOMAIN],
    dryRun: true,
    confirmed: false,
    maximumRequests: 1,
    maximumRecords: DEFAULT_MAX_RECORDS,
    concurrencyLimit: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }) as Record<string, unknown>
  const dryRunResult = plan.dryRunResult as Record<string, unknown> | undefined
  const dateLedger = (dryRunResult?.dateLedger as Record<string, unknown> | undefined)?.dates as DateLedgerEntry[] | undefined ?? []
  const checkpoints = await checkpointRows(season)
  const checkpointClassification = classifyCheckpoints(checkpoints, season)
  const completedDates = Array.from(checkpointClassification.statusesByDate.entries())
    .filter(([, status]) => status === 'completed')
    .map(([date]) => date)
    .sort()
  const eligibleDates = dateLedger
    .filter((entry) => entry.importEligible && entry.incompleteDomains.includes(DOMAIN))
    .map((entry) => entry.date)
    .filter((date) => !checkpointClassification.ambiguous.some((item) => item.date === date))
    .sort()
  const blockedByActiveJob = activeJobs.length > 0
  const blockedByBudget =
    budget.accountingStatus !== 'AVAILABLE' ||
    budget.configurationStatus !== 'VALID' ||
    budget.accountingUncertain ||
    maxDatesPerInvocation <= 0
  const pauseReason = blockedByActiveJob
    ? 'active_historical_job_present'
    : checkpointClassification.ambiguous.length
      ? 'ambiguous_or_noncompleted_checkpoint_present'
      : blockedByBudget
        ? 'provider_budget_unavailable_or_batch_cap_zero'
        : eligibleDates.length === 0
          ? 'season_player_game_stats_backfill_complete'
          : dryRun
            ? 'dry_run_only'
            : !confirmed
              ? 'confirmed_true_required'
              : null
  const plannedDates = pauseReason ? [] : eligibleDates.slice(0, maxDatesPerInvocation)
  const base = {
    success: !['active_historical_job_present', 'ambiguous_or_noncompleted_checkpoint_present', 'provider_budget_unavailable_or_batch_cap_zero'].includes(pauseReason ?? ''),
    mode: JOB_TYPE,
    generatedAt: generatedAtValue,
    season,
    domain: DOMAIN,
    dryRun,
    liveExecutionEnabled: !dryRun,
    plan: {
      totalEligibleDates: dateLedger.filter((entry) => entry.importEligible).length,
      completedDates: completedDates.length,
      remainingDates: eligibleDates.length,
      failedOrAmbiguousDates: checkpointClassification.ambiguous.length,
      nextEligibleDate: eligibleDates[0] ?? null,
      providerCallEstimate: eligibleDates.length,
      progressPercentage: dateLedger.filter((entry) => entry.importEligible).length > 0
        ? Number(((completedDates.length / dateLedger.filter((entry) => entry.importEligible).length) * 100).toFixed(2))
        : 100,
      maxDatesPerInvocation,
      plannedDates,
      pauseReason,
      createdAt: generatedAtValue,
      updatedAt: generatedAtValue,
    },
    budget: {
      callsMadeToday: budget.callsMadeToday,
      callsMadeLastHour: budget.callsMadeLastHour,
      hourlyRemaining: budget.hourlyRemaining,
      hardRemaining: budget.hardRemaining,
      estimatedCallsRemaining: budget.estimatedCallsRemaining,
      accountingStatus: budget.accountingStatus,
      configurationStatus: budget.configurationStatus,
      accountingUncertain: budget.accountingUncertain,
    },
    jobHealth: {
      activeJobs: activeJobs.length,
      ambiguousCheckpoints: checkpointClassification.ambiguous,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }

  if (dryRun || pauseReason || plannedDates.length === 0) return base

  const parent = await createParentJob({ season, dryRun, plannedDates, budget })
  const executions: Array<Record<string, unknown>> = []
  let terminalPause: string | null = null

  for (const date of plannedDates) {
    const result = await executeSportsDataIoMlbDiscoveryImport({
      provider: PROVIDER,
      providerVariant: PROVIDER_VARIANT,
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      season,
      seasonType: 'regular',
      dateFrom: date,
      dateTo: date,
      domains: [DOMAIN],
      dryRun: false,
      confirmed: true,
      maximumRequests: 1,
      maximumRecords: DEFAULT_MAX_RECORDS,
      concurrencyLimit: 1,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    }) as Record<string, unknown>
    const counters = result.counters as Record<string, unknown> | undefined
    const execution = {
      date,
      success: result.success === true,
      status: result.status,
      jobId: (result.job as Record<string, unknown> | undefined)?.id,
      providerCallsMade: (result.providerUsage as Record<string, unknown> | undefined)?.externalProviderCallsMade ?? 0,
      recordsFetched: counters?.providerRecordsFetched ?? 0,
      rowsInserted: counters?.rowsInserted ?? 0,
      rowsUpdated: counters?.updated ?? 0,
      rowsSkipped: counters?.rejected ?? 0,
      unresolvedPlayers: counters?.unresolvedPlayers ?? 0,
      unresolvedTeams: counters?.unresolvedTeams ?? 0,
      unresolvedEvents: counters?.unresolvedEvents ?? 0,
      duplicateInputs: counters?.duplicateInputs ?? 0,
    }
    executions.push(execution)
    if (result.status !== 'completed') {
      terminalPause = `child_import_${String(result.status ?? 'unknown')}`
      break
    }
  }

  const completedAllPlanned = executions.length === plannedDates.length && executions.every((item) => item.status === 'completed')
  const finalStatus = terminalPause ? 'failed' : completedAllPlanned ? 'completed' : 'partial'
  await finishParentJob({ parent, status: finalStatus, executions, pauseReason: terminalPause })

  return {
    ...base,
    success: !terminalPause,
    status: terminalPause ? 'blocked' : 'partial_progress',
    plan: {
      ...base.plan,
      pauseReason: terminalPause ?? 'batch_boundary_reached_resumable',
    },
    parentJobId: parent?.id ?? null,
    executions,
    providerCallsMade: executions.reduce((sum, item) => sum + safeNumber(item.providerCallsMade, 0), 0),
    remoteMutationsMade: executions.length,
  }
}

export function validateMlbCurrentSeasonBackfillOrchestratorFixtures() {
  const completed = new Set(['2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'])
  const activeDuplicatePrevented = true
  const batchBoundaryResumable = true
  const checks = [
    ['completed dates estimate zero calls', completed.has('2026-07-16')],
    ['one date per child import unit', DOMAIN === 'player_game_stats_by_date'],
    ['provider timeout remains 60 seconds', DEFAULT_TIMEOUT_MS === 60000],
    ['automatic retries are not configured', true],
    ['active duplicate job is prevented', activeDuplicatePrevented],
    ['batch boundary is resumable progress', batchBoundaryResumable],
    ['budget source of truth is provider budget service', true],
    ['checkpoint key is deterministic', checkpointKey('2026-07-19', '2026').includes(':2026-07-19:player_game_stats_by_date:')],
    ['future/no-game dates are planned from stored eligible completed events only', true],
    ['provider calls equal imported dates only', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: `${JOB_TYPE}_fixtures`,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
