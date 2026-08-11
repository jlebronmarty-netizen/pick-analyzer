import 'server-only'

import {
  MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES,
  MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES,
} from '@/config/mlb-operating-day-scheduler'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdaptiveRefreshStatus } from '@/services/adaptive-refresh-orchestrator.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { getUniversalProjectionEngine } from '@/services/universal-projection-engine.service'
import { ACTIVE_EVENT_TIMEZONE, puertoRicoUtcRange } from '@/services/active-event.service'
import { resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import { localDateInTimeZone } from '@/services/provider-time-normalization.service'

type MigrationCheck = {
  table: string
  status: 'APPLIED' | 'MISSING' | 'UNKNOWN'
  error: string | null
}

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = ACTIVE_EVENT_TIMEZONE
const EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES = MLB_OPERATING_DAY_WRITE_SCHEDULER_INTERVAL_MINUTES
const EXTERNAL_SCHEDULER_GRACE_MINUTES = MLB_OPERATING_DAY_SCHEDULER_GRACE_MINUTES

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function ageMinutes(value: string | null | undefined, now = new Date()) {
  if (!value) return null
  const ms = now.getTime() - new Date(value).getTime()
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null
}

function addMinutes(value: string | null | undefined, minutes: number) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Date(date.getTime() + minutes * 60000).toISOString()
}

async function tableExists(table: string): Promise<MigrationCheck> {
  try {
    const { error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).limit(1)
    if (error) {
      const code = String((error as { code?: string }).code ?? '')
      const message = error.message ?? ''
      const details = String((error as { details?: string }).details ?? '')
      const evidence = [code, message, details].filter(Boolean).join(': ')
      const explicitlyMissing =
        code === '42P01' ||
        code === 'PGRST205' ||
        /does not exist|could not find|relation .* not found|relation .* does not exist/i.test(evidence)
      return { table, status: explicitlyMissing ? 'MISSING' : 'UNKNOWN', error: evidence || 'ambiguous table check failure' }
    }
    return { table, status: 'APPLIED', error: null }
  } catch (error) {
    return { table, status: 'UNKNOWN', error: error instanceof Error ? error.message : 'unknown migration check error' }
  }
}

async function latestLifecycleEvents() {
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('action,status,started_at,completed_at,provider_calls_made,blocking_reason,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null }
}

async function latestPrimarySchedulerSyncJobs() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,job_type,status,started_at,completed_at,provider,records_fetched,records_inserted,records_updated,error_count,metadata,created_at')
    .eq('sport_key', SPORT_KEY)
    .in('job_type', [
      'odds03d_stage3_product_primary_v1',
      'odds03a_natural_dual_read_v1',
      'sdio_exit_03a_mlb_official_shadow_v1',
    ])
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null }
}

type CurrentBoardHealthSummary = Pick<Awaited<ReturnType<typeof getCurrentBoard>>,
  | 'candidates'
  | 'officialPickCount'
  | 'latestOddsTimestamp'
  | 'latestOddsSourceTimestamp'
  | 'latestVisibleMarketSnapshotTimestamp'
  | 'oldestVisibleMarketSnapshotTimestamp'
  | 'dataFreshness'
  | 'boardHealth'
>

async function safeCurrentBoardHealthSummary(): Promise<CurrentBoardHealthSummary & { readError: string | null }> {
  try {
    const board = await getCurrentBoard({
      sportKey: SPORT_KEY,
      mode: 'CURRENT',
      limit: 200,
      includeMlbContext: false,
    })
    return { ...board, readError: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown current board read failure'
    return {
      candidates: [],
      officialPickCount: 0,
      latestOddsTimestamp: null,
      latestOddsSourceTimestamp: null,
      latestVisibleMarketSnapshotTimestamp: null,
      oldestVisibleMarketSnapshotTimestamp: null,
      dataFreshness: {
        status: 'empty',
        latestOddsTimestamp: null,
        latestOddsAgeMinutes: null,
        maxAllowedAgeMinutes: 0,
        nextRecommendedRefreshTime: null,
        timestampSemantics: 'selected_visible_market_snapshot',
        latestSourceTimestamp: null,
        latestVisibleMarketSnapshotTimestamp: null,
        oldestVisibleMarketSnapshotTimestamp: null,
        visibleMarketCount: 0,
        freshVisibleMarketCount: 0,
        staleVisibleMarketCount: 0,
        freshnessTimestampSource: null,
      },
      boardHealth: {
        status: 'DEGRADED',
        warnings: [`CURRENT_BOARD_READ_FAILED:${message}`],
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      readError: message,
    }
  }
}

async function settlementBacklog() {
  const { count, error } = await supabaseAdmin
    .from('prediction_history')
    .select('*', { count: 'exact', head: true })
    .eq('sport_key', SPORT_KEY)
    .in('status', ['PENDING', 'pending', 'ACTIVE', 'active'])
  return {
    pendingPredictions: error ? null : count ?? 0,
    error: error?.message ?? null,
  }
}

async function statusRefreshEvidence(lifecycleRows: Array<Record<string, unknown>>, now = new Date()) {
  const latestLedger = lifecycleRows.find((row) => String(row.action) === 'status_refresh')
  const latestMetadata = asRecord(latestLedger?.metadata)
  const ledgerCheckCompleted =
    latestMetadata.providerCheckCompleted === true ||
    ['SUCCESS_CHANGED', 'SUCCESS_NO_CHANGE'].includes(String(latestLedger?.status ?? ''))
  if (latestLedger && ledgerCheckCompleted) {
    const checkedAt = String(latestMetadata.lastProviderCheckAt ?? latestLedger.completed_at ?? latestLedger.created_at ?? '') || null
    return {
      status: String(latestLedger.status ?? 'SUCCESS_NO_CHANGE'),
      provider: String(latestMetadata.provider ?? 'mlb_stats_api'),
      endpoint: latestMetadata.endpoint ?? null,
      providerCheckRequired: true,
      providerCheckAttempted: latestMetadata.providerCheckAttempted === true || Number(latestLedger.provider_calls_made ?? 0) > 0,
      providerCheckCompleted: true,
      providerCallsMade: Number(latestLedger.provider_calls_made ?? latestMetadata.providerCallsMade ?? 0),
      rowsReceived: Number(latestMetadata.rowsReceived ?? 0),
      statusesChanged: Number(latestMetadata.statusesChanged ?? 0),
      rowsUpdated: Number(latestMetadata.rowsUpdated ?? 0),
      lastProviderCheckAt: checkedAt,
      lastStatusChangeAt: latestMetadata.lastStatusChangeAt ?? null,
      latestSourceTimestamp: latestMetadata.latestSourceTimestamp ?? null,
      failureReason: null,
      evidenceSource: 'operating_day_lifecycle_events',
    }
  }
  const operatingDate = localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
  const range = puertoRicoUtcRange(operatingDate)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, start_time, status, updated_at, metadata, sport_key, league_key')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) {
    return {
      status: 'QUERY_FAILED',
      provider: 'mlb_stats_api',
      providerCheckRequired: false,
      providerCheckAttempted: false,
      providerCheckCompleted: false,
      providerCallsMade: 0,
      rowsReceived: 0,
      statusesChanged: 0,
      lastProviderCheckAt: null,
      lastStatusChangeAt: null,
      failureReason: error.message,
      evidenceSource: 'sport_events_read_fallback',
    }
  }
  const rows = (data ?? []) as Array<{ id: string; start_time: string | null; status: string | null; updated_at: string | null; metadata: Record<string, unknown> | null; sport_key: string; league_key: string | null }>
  const lifecycles = rows.map((event) => resolveMlbGameLifecycle(event, now))
  const staleStatusCount = lifecycles.filter((lifecycle) => lifecycle.lifecycle === 'STATUS_UNCONFIRMED' || (!lifecycle.statusFresh && lifecycle.lifecycle === 'PREGAME')).length
  const lastStatusChangeAt = rows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  return {
    status: staleStatusCount > 0 ? 'MISSED_REFRESH' : 'NOT_DUE',
    provider: 'mlb_stats_api',
    providerCheckRequired: staleStatusCount > 0,
    providerCheckAttempted: false,
    providerCheckCompleted: false,
    providerCallsMade: 0,
    rowsReceived: rows.length,
    statusesChanged: 0,
    lastProviderCheckAt: null,
    lastStatusChangeAt,
    failureReason: staleStatusCount > 0 ? 'MLB Stats API status refresh is due but was not executed by this read-only health request.' : null,
    evidenceSource: 'sport_events_read_fallback',
  }
}

function statusRank(status: string) {
  if (['FAILED', 'BLOCKED'].includes(status)) return 5
  if (['PARTIAL', 'DEGRADED'].includes(status)) return 4
  if (status === 'UNKNOWN') return 3
  if (status === 'HEALTHY') return 1
  return 2
}

function overallStatus(input: {
  pendingMigration: boolean
  adaptiveBlocked: boolean
  staleCritical: boolean
  failedSteps: number
}) {
  const candidates = [
    input.pendingMigration ? 'BLOCKED' : 'HEALTHY',
    input.adaptiveBlocked ? 'DEGRADED' : 'HEALTHY',
    input.staleCritical ? 'PARTIAL' : 'HEALTHY',
    input.failedSteps > 0 ? 'DEGRADED' : 'HEALTHY',
  ]
  return candidates.sort((a, b) => statusRank(b) - statusRank(a))[0]
}

function latestAction(rows: Array<Record<string, unknown>>, actions: string[]) {
  return rows.find((row) => actions.includes(String(row.action ?? ''))) ?? null
}

function freshnessByDomain(adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>, domain: string) {
  return adaptive.freshness.find((item) => item.domain === domain) ?? null
}

type CanonicalHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'

type CanonicalHealthDomain = {
  status: CanonicalHealthStatus
  summary: string
  reasonCodes: string[]
  observedAt: string
  sourceTimestamps: Record<string, string | null>
  evidence: Record<string, unknown>
  blockers: string[]
  warnings: string[]
  nextExpectedAction: string | null
  humanInterventionRequired: boolean
}

function severity(status: CanonicalHealthStatus) {
  return { HEALTHY: 0, UNKNOWN: 1, DEGRADED: 2, CRITICAL: 3 }[status]
}

function schedulerDomain(input: {
  observedAt: string
  schedulerCadenceStatus: string
  lastSuccessfulProtectedInvocationAt: string | null
  lastSchedulerFailure: unknown
  evidenceAge: number | null
  missedSchedulerIntervals: number | null
  nextExpectedSchedulerWindow: string | null
  automaticMultiRefreshActive: boolean
  failedSteps: Array<Record<string, unknown>>
}): CanonicalHealthDomain {
  const status: CanonicalHealthStatus =
    input.schedulerCadenceStatus === 'CRITICAL'
      ? 'CRITICAL'
      : input.schedulerCadenceStatus === 'LATE'
        ? 'DEGRADED'
        : input.schedulerCadenceStatus === 'NO_EVIDENCE'
          ? 'UNKNOWN'
          : 'HEALTHY'
  const reasonCodes = [
    input.schedulerCadenceStatus === 'HEALTHY' ? 'SCHEDULER_CURRENT' : null,
    input.schedulerCadenceStatus === 'IDLE' ? 'SCHEDULER_IDLE' : null,
    input.schedulerCadenceStatus === 'LATE' ? 'SCHEDULER_LATE' : null,
    input.schedulerCadenceStatus === 'CRITICAL' ? 'SCHEDULER_CRITICAL' : null,
    input.schedulerCadenceStatus === 'NO_EVIDENCE' ? 'WRITER_INVOCATION_MISSING' : null,
    input.failedSteps.length ? 'WRITER_EXECUTION_FAILED' : null,
  ].filter(Boolean) as string[]
  return {
    status,
    summary:
      status === 'HEALTHY'
        ? 'Scheduler execution is based on protected invocation evidence and is current.'
        : status === 'UNKNOWN'
          ? 'Scheduler execution evidence is unavailable.'
          : `Scheduler execution is ${input.schedulerCadenceStatus.toLowerCase()} based only on invocation cadence evidence.`,
    reasonCodes,
    observedAt: input.observedAt,
    sourceTimestamps: {
      lastSuccessfulProtectedInvocationAt: input.lastSuccessfulProtectedInvocationAt,
      nextExpectedSchedulerWindow: input.nextExpectedSchedulerWindow,
    },
    evidence: {
      schedulerCadenceStatus: input.schedulerCadenceStatus,
      evidenceAgeMinutes: input.evidenceAge,
      missedSchedulerIntervals: input.missedSchedulerIntervals,
      automaticMultiRefreshActive: input.automaticMultiRefreshActive,
      failedSteps: input.failedSteps.length,
      independenceRule: 'Scheduler execution health never reads odds freshness, Official Pick availability, provider data completeness, or settlement row counts.',
    },
    blockers: status === 'CRITICAL' ? ['scheduler_execution_critical'] : [],
    warnings: status === 'DEGRADED' ? ['scheduler_execution_late'] : [],
    nextExpectedAction: input.nextExpectedSchedulerWindow,
    humanInterventionRequired: status === 'CRITICAL' || status === 'UNKNOWN',
  }
}

function marketDomain(input: {
  observedAt: string
  oddsFreshness: ReturnType<typeof freshnessByDomain>
  board: CurrentBoardHealthSummary
  adaptiveBlockers: string[]
  nextDueAt: string | null
}): CanonicalHealthDomain {
  const boardFreshness = input.board.dataFreshness.status
  const oddsStatus = String(input.oddsFreshness?.status ?? 'UNKNOWN')
  const visibleMarketCount = Number(input.board.dataFreshness.visibleMarketCount ?? 0)
  const freshVisibleMarketCount = Number(input.board.dataFreshness.freshVisibleMarketCount ?? 0)
  const staleVisibleMarketCount = Number(input.board.dataFreshness.staleVisibleMarketCount ?? 0)
  const hasFreshCoverage = freshVisibleMarketCount > 0
  const hasStaleCoverage = staleVisibleMarketCount > 0
  const allVisibleMarketsStale = visibleMarketCount > 0 && staleVisibleMarketCount >= visibleMarketCount
  const oddsNotCurrent = input.adaptiveBlockers.includes('odds_not_current')
  const status: CanonicalHealthStatus =
    oddsStatus === 'FAILED' || boardFreshness === 'stale' || allVisibleMarketsStale || (oddsNotCurrent && !hasFreshCoverage)
      ? 'CRITICAL'
      : ['STALE', 'PENDING'].includes(oddsStatus) || boardFreshness === 'partial' || hasStaleCoverage || oddsNotCurrent
        ? 'DEGRADED'
      : oddsStatus === 'NOT_AVAILABLE' || boardFreshness === 'empty'
        ? 'UNKNOWN'
        : 'HEALTHY'
  const reasonCodes = [
    status === 'HEALTHY' ? 'MARKET_FRESH' : null,
    input.board.boardHealth.warnings.some((warning) => warning.startsWith('CURRENT_BOARD_READ_FAILED')) ? 'CURRENT_BOARD_READ_FAILED' : null,
    oddsStatus === 'PENDING' || boardFreshness === 'empty' ? 'NO_ODDS_AVAILABLE' : null,
    oddsStatus === 'STALE' || boardFreshness === 'stale' ? 'STALE_ODDS' : null,
    boardFreshness === 'partial' ? 'PARTIAL_MARKET_FRESHNESS' : null,
    hasStaleCoverage && hasFreshCoverage ? 'PARTIAL_FAIL_CLOSED_MARKET_STALENESS' : null,
    oddsNotCurrent && hasFreshCoverage ? 'ODDS_NOT_CURRENT_WITH_PARTIAL_FRESH_COVERAGE' : null,
    input.board.dataFreshness.freshnessTimestampSource === null ? 'UNKNOWN_TIMESTAMP' : null,
  ].filter(Boolean) as string[]
  return {
    status,
    summary:
      status === 'HEALTHY'
        ? 'Market freshness is current from stored market timestamps.'
        : 'Market freshness is limited by stored odds age or missing market evidence, independent of scheduler execution.',
    reasonCodes,
    observedAt: input.observedAt,
    sourceTimestamps: {
      latestOddsTimestamp: input.board.latestOddsTimestamp,
      latestOddsSourceTimestamp: input.board.latestOddsSourceTimestamp,
      oldestVisibleMarketSnapshotTimestamp: input.board.oldestVisibleMarketSnapshotTimestamp,
      nextRecommendedRefreshTime: input.board.dataFreshness.nextRecommendedRefreshTime,
    },
    evidence: {
      adaptiveOddsStatus: oddsStatus,
      currentBoardFreshness: boardFreshness,
      latestOddsAgeMinutes: input.board.dataFreshness.latestOddsAgeMinutes,
      visibleMarketCount,
      freshVisibleMarketCount,
      staleVisibleMarketCount,
      freshCoveragePercent: visibleMarketCount > 0 ? Number(((freshVisibleMarketCount / visibleMarketCount) * 100).toFixed(2)) : null,
      staleCoveragePercent: visibleMarketCount > 0 ? Number(((staleVisibleMarketCount / visibleMarketCount) * 100).toFixed(2)) : null,
      failClosedStaleMarkets: staleVisibleMarketCount,
      timestampSemantics: input.board.dataFreshness.timestampSemantics,
      independenceRule: 'Market freshness never falls back to scheduler invocation time, page fetch time, or API generatedAt.',
    },
    blockers: status === 'CRITICAL' ? ['market_freshness_critical'] : [],
    warnings: [
      ...(status === 'DEGRADED' ? ['market_freshness_degraded'] : []),
      ...input.board.boardHealth.warnings.filter((warning) => warning.startsWith('CURRENT_BOARD_READ_FAILED')),
    ],
    nextExpectedAction: input.nextDueAt,
    humanInterventionRequired: status === 'CRITICAL' && oddsNotCurrent && !hasFreshCoverage,
  }
}

function providerBudgetDomain(input: {
  observedAt: string
  adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>
  budget: Awaited<ReturnType<typeof getProviderBudgetStatus>>
}): CanonicalHealthDomain {
  const exhausted = input.adaptive.providerBudget.mode === 'EXHAUSTED' || input.budget.stopThresholdReached
  const uncertain = input.budget.accountingUncertain || input.budget.configurationStatus !== 'VALID'
  const low = input.adaptive.providerBudget.mode === 'CRITICAL' || input.adaptive.providerBudget.mode === 'CONSERVATIVE'
  const status: CanonicalHealthStatus = exhausted ? 'CRITICAL' : uncertain ? 'UNKNOWN' : low ? 'DEGRADED' : 'HEALTHY'
  return {
    status,
    summary:
      status === 'HEALTHY'
        ? 'Provider budget capacity is available; market freshness is reported separately.'
        : 'Provider budget capacity needs attention; this is provider-specific and separate from market freshness.',
    reasonCodes: [
      status === 'HEALTHY' ? 'PROVIDER_BUDGET_AVAILABLE' : null,
      exhausted ? 'PROVIDER_BUDGET_EXHAUSTED' : null,
      uncertain ? 'PROVIDER_BUDGET_ACCOUNTING_UNKNOWN' : null,
      low ? 'PROVIDER_BUDGET_LOW' : null,
      'SPORTSDATAIO_PROVIDER_SPECIFIC',
      'THE_ODDS_API_SEPARATE_POOL',
      'BSN_SOURCE_SEPARATE',
    ].filter(Boolean) as string[],
    observedAt: input.observedAt,
    sourceTimestamps: {
      sportsdataioLastProviderCall: input.budget.lastProviderCall,
      sportsdataioLocalDate: input.budget.localDate,
      theOddsApiLastQuotaProof: null,
      bsnLastSourceProof: null,
    },
    evidence: {
      providers: {
        sportsdataio: {
          status: input.adaptive.providerBudget.mode,
          canonicalBudget: input.budget.canonicalBudget,
          allowanceClassification: 'CONFIGURED_ONLY',
          resetSemantics: 'CONFIGURED_ONLY',
          callsMadeToday: input.budget.callsMadeToday,
          estimatedCallsRemaining: input.budget.estimatedCallsRemaining,
          hardRemaining: input.budget.hardRemaining,
          softReserve: input.budget.config.softReserve,
          hourlyRemaining: input.budget.hourlyRemaining,
          accountingStatus: input.budget.accountingStatus,
        },
        theOddsApi: {
          status: 'UNKNOWN',
          allowanceClassification: 'UNKNOWN_CURRENT_REMAINING_NOT_RECHECKED',
          reserveCredits: 2000,
          combinedWithSportsDataIO: false,
        },
        bsn: {
          status: 'SOURCE_SPECIFIC_PREVIEW',
          providerPath: 'official_bsn_homepage_csv_manual_future_provider',
          combinedWithTheOddsApi: false,
        },
      },
      canonicalBudget: input.budget.canonicalBudget,
      providerPools: input.budget.providerPools,
      independenceRule: 'Provider budget health does not use odds_not_current as an outage signal.',
    },
    blockers: exhausted ? ['provider_budget_exhausted'] : [],
    warnings: [...input.budget.budgetWarnings, low ? 'provider_budget_low' : null].filter(Boolean) as string[],
    nextExpectedAction: input.budget.nextEligibleRefresh,
    humanInterventionRequired: exhausted || uncertain,
  }
}

function settlementDomain(input: {
  observedAt: string
  adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>
  backlogError: string | null
  pendingPredictions: number | null
}): CanonicalHealthDomain {
  const settlementBacklog = input.adaptive.settlementBacklog
  const ready = Number(settlementBacklog?.settlementReadyRows ?? 0)
  const missingResults = Number(settlementBacklog?.completedMissingResultRows ?? 0)
  const awaitingResults = Number(settlementBacklog?.awaitingResultRows ?? 0)
  const status: CanonicalHealthStatus = input.backlogError
    ? 'UNKNOWN'
    : ready > 0
      ? 'CRITICAL'
      : 'HEALTHY'
  return {
    status,
    summary:
      status === 'HEALTHY'
        ? missingResults > 0
          ? 'Settlement closure is clean for settlement-ready rows; historical result recovery debt remains visible as a non-blocking warning.'
          : 'Settlement closure has no ready backlog in the adaptive evidence.'
        : 'Settlement closure requires action from settlement readiness evidence.',
    reasonCodes: [
      status === 'HEALTHY' ? 'SETTLEMENT_CLOSED' : null,
      ready > 0 ? 'SETTLEMENT_READY_ROWS_REMAIN' : null,
      missingResults > 0 ? 'HISTORICAL_RESULT_RECOVERY_DEBT_VISIBLE' : null,
      input.backlogError ? 'SETTLEMENT_BACKLOG_READ_FAILED' : null,
    ].filter(Boolean) as string[],
    observedAt: input.observedAt,
    sourceTimestamps: {
      oldestReadyDate: settlementBacklog?.oldestReadyDate ?? null,
      oldestMissingResultDate: settlementBacklog?.oldestMissingResultDate ?? null,
      latestResultUpdatedAt: settlementBacklog?.latestResultUpdatedAt ?? null,
    },
    evidence: {
      checkedRows: settlementBacklog?.checkedRows ?? 0,
      settlementReadyRows: ready,
      completedMissingResultRows: missingResults,
      historicalRecoveryDebtRows: missingResults,
      historicalRecoveryDebtBlocksProductReadiness: false,
      awaitingResultRows: awaitingResults,
      pendingPredictions: input.pendingPredictions,
      validationStatus: input.backlogError ? 'UNKNOWN' : 'READ_OK',
      independenceRule: 'Settlement closure can be healthy while market odds are stale.',
    },
    blockers: ready > 0 ? ['settlement_closure_action_required'] : [],
    warnings: [
      awaitingResults > 0 ? 'results_awaiting_final_state' : null,
      missingResults > 0 ? 'historical_result_recovery_debt_visible' : null,
    ].filter(Boolean) as string[],
    nextExpectedAction: missingResults > 0 ? 'sync_results' : ready > 0 ? 'settle' : null,
    humanInterventionRequired: Boolean(input.backlogError),
  }
}

function productReadinessDomain(input: {
  observedAt: string
  scheduler: CanonicalHealthDomain
  market: CanonicalHealthDomain
  provider: CanonicalHealthDomain
  settlement: CanonicalHealthDomain
  boardCandidates: number
  officialPicks: number
}): CanonicalHealthDomain {
  const domains = [
    ['schedulerExecution', input.scheduler],
    ['marketFreshness', input.market],
    ['providerBudget', input.provider],
    ['settlementClosure', input.settlement],
  ] as const
  const limiting = domains.slice().sort((a, b) => severity(b[1].status) - severity(a[1].status))[0]
  const hasBoard = input.boardCandidates > 0
  const status: CanonicalHealthStatus =
    limiting[1].status === 'CRITICAL'
      ? 'CRITICAL'
      : limiting[1].status === 'DEGRADED' || !hasBoard
        ? 'DEGRADED'
        : limiting[1].status === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'HEALTHY'
  const limitingDomain = !hasBoard ? 'currentBoard' : limiting[0]
  return {
    status,
    summary:
      status === 'HEALTHY'
        ? 'Product readiness is available from current independent health domains.'
        : `Product readiness is limited by ${limitingDomain}.`,
    reasonCodes: [
      status === 'HEALTHY' ? 'PRODUCT_READY' : null,
      !hasBoard ? 'CURRENT_BOARD_NO_CANDIDATES' : null,
      `LIMITING_DOMAIN_${String(limitingDomain).toUpperCase()}`,
    ].filter(Boolean) as string[],
    observedAt: input.observedAt,
    sourceTimestamps: {
      schedulerObservedAt: input.scheduler.observedAt,
      marketObservedAt: input.market.observedAt,
      providerObservedAt: input.provider.observedAt,
      settlementObservedAt: input.settlement.observedAt,
    },
    evidence: {
      limitingDomain,
      schedulerExecution: input.scheduler.status,
      marketFreshness: input.market.status,
      providerBudget: input.provider.status,
      settlementClosure: input.settlement.status,
      currentBoardCandidates: input.boardCandidates,
      officialPicks: input.officialPicks,
      example: 'Scheduler can be HEALTHY while product readiness is DEGRADED by stale market freshness.',
    },
    blockers: status === 'CRITICAL' ? [`product_readiness_blocked_by_${limitingDomain}`] : [],
    warnings: status === 'DEGRADED' ? [`product_readiness_degraded_by_${limitingDomain}`] : [],
    nextExpectedAction: limiting[1].nextExpectedAction,
    humanInterventionRequired: limiting[1].humanInterventionRequired,
  }
}

function overallHealthDomain(domains: {
  schedulerExecution: CanonicalHealthDomain
  marketFreshness: CanonicalHealthDomain
  providerBudget: CanonicalHealthDomain
  settlementClosure: CanonicalHealthDomain
  productReadiness: CanonicalHealthDomain
}) {
  const ordered = Object.entries(domains).sort((a, b) => severity(b[1].status) - severity(a[1].status))
  const [limitingDomain, limiting] = ordered[0]
  return {
    status: limiting.status,
    summary: `Overall operations health follows explicit precedence from ${limitingDomain}.`,
    limitingDomain,
    precedence: ['CRITICAL', 'DEGRADED', 'UNKNOWN', 'HEALTHY'],
    reasonCodes: [`OVERALL_LIMITING_DOMAIN_${limitingDomain.toUpperCase()}`, ...limiting.reasonCodes],
  }
}

export async function getOperationsHealth() {
  const generatedAt = new Date().toISOString()
  const [adaptive, budget, lifecycle, primarySyncJobs, backlog, migrations, projections, board] = await Promise.all([
    getAdaptiveRefreshStatus(),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY }),
    latestLifecycleEvents(),
    latestPrimarySchedulerSyncJobs(),
    settlementBacklog(),
    Promise.all([
      tableExists('universal_projection_history'),
      tableExists('ai_performance_snapshots'),
      tableExists('operating_days'),
      tableExists('operating_day_lifecycle_events'),
      tableExists('sports_sync_jobs'),
      tableExists('provider_entity_mappings'),
    ]),
    getUniversalProjectionEngine({ sportKey: SPORT_KEY, date: undefined, dryRun: true }),
    safeCurrentBoardHealthSummary(),
  ])
  const statusRefresh = await statusRefreshEvidence(lifecycle.rows as Array<Record<string, unknown>>)
  const lifecycleRows = lifecycle.rows as Array<Record<string, unknown>>
  const latestOddsRefresh = latestAction(lifecycleRows, ['midday_refresh', 'morning_sync', 'final_refresh', 'prepare_next_slate'])
  const latestResultsRefresh = latestAction(lifecycleRows, ['sync_results'])
  const latestPredictionRefresh = latestAction(lifecycleRows, ['midday_refresh', 'morning_sync', 'final_refresh', 'prepare_next_slate'])
  const latestRecommendationRefresh = latestPredictionRefresh
  const oddsFreshness = freshnessByDomain(adaptive, 'odds')
  const predictionFreshness = freshnessByDomain(adaptive, 'prediction')
  const recommendationFreshness = freshnessByDomain(adaptive, 'recommendation')
  const resultsFreshness = freshnessByDomain(adaptive, 'results')
  const successfulProtectedRow = (row: Record<string, unknown>) => {
    const status = String(row.status ?? '')
    const metadata = asRecord(row.metadata)
    const successfulSchedulerHeartbeat =
      String(row.action ?? '') === 'scheduler_heartbeat' &&
      metadata.protectedInvocationRecorded === true &&
      metadata.heartbeatUpdatesHealthMarker === true &&
      metadata.productDataMutated === false
    return successfulSchedulerHeartbeat || ['SUCCESS_CHANGED', 'SUCCESS_NO_CHANGE', 'completed', 'morning_synced', 'midday_refreshed', 'results_synced'].some((needle) => status.includes(needle))
  }
  const sourceOf = (row: Record<string, unknown> | null | undefined) => {
    const metadata = asRecord(row?.metadata)
    return String(metadata.source ?? metadata.schedulerSource ?? '')
  }
  const successfulPrimarySyncJob = (row: Record<string, unknown>) => {
    const metadata = asRecord(row.metadata)
    const status = String(row.status ?? '').toLowerCase()
    const source = String(metadata.source ?? metadata.schedulerSource ?? '')
    const providerCalls = Number(metadata.providerCallsMade ?? metadata.externalCallsUsed ?? 0)
    return (
      source === 'VERCEL_OPERATING_DAY_CRON_PRIMARY' &&
      ['completed', 'success_changed', 'success_no_change'].includes(status) &&
      providerCalls >= 0
    )
  }
  const timestampOf = (row: Record<string, unknown> | null | undefined) => String(row?.completed_at ?? row?.created_at ?? '') || null
  const newerTimestamp = (left: string | null, right: string | null) => {
    if (!left) return right
    if (!right) return left
    return new Date(left).getTime() >= new Date(right).getTime() ? left : right
  }
  const latestSuccessfulProtected = (lifecycle.rows as Array<Record<string, unknown>>).find((row) => {
    return successfulProtectedRow(row)
  })
  const latestVercelPrimary = lifecycleRows.find((row) => successfulProtectedRow(row) && sourceOf(row) === 'VERCEL_OPERATING_DAY_CRON_PRIMARY')
  const latestGithubFallback = lifecycleRows.find((row) => successfulProtectedRow(row) && sourceOf(row) === 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK')
  const latestVercelPrimarySyncJob = (primarySyncJobs.rows as Array<Record<string, unknown>>).find(successfulPrimarySyncJob)
  const lastLifecycleProtectedSuccessAt = timestampOf(latestSuccessfulProtected)
  const lastLifecycleVercelPrimarySuccessAt = timestampOf(latestVercelPrimary)
  const lastVercelPrimarySyncJobSuccessAt = timestampOf(latestVercelPrimarySyncJob)
  const lastVercelPrimarySuccessAt = newerTimestamp(lastLifecycleVercelPrimarySuccessAt, lastVercelPrimarySyncJobSuccessAt)
  const lastGithubFallbackSuccessAt = timestampOf(latestGithubFallback)
  const lastSuccessfulProtectedInvocationAt = lastVercelPrimarySuccessAt ?? lastLifecycleProtectedSuccessAt
  const evidenceAge = ageMinutes(lastSuccessfulProtectedInvocationAt)
  const vercelPrimaryEvidenceAge = ageMinutes(lastVercelPrimarySuccessAt)
  const externalSchedulerVerified = Boolean(lastSuccessfulProtectedInvocationAt)
  const automaticMultiRefreshActive = externalSchedulerVerified && evidenceAge !== null && evidenceAge <= EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES * 3
  const failedSteps = lifecycle.rows.filter((row: Record<string, unknown>) => {
    const status = String(row.status ?? '').toLowerCase()
    return status.includes('failed') || status.includes('error')
  })
  const retryingSteps = lifecycle.rows.filter((row: Record<string, unknown>) => {
    const status = String(row.status ?? '').toLowerCase()
    return status.includes('retry') || status.includes('partial')
  })
  const missingMigrations = migrations.filter((migration) => migration.status === 'MISSING')
  const unknownMigrations = migrations.filter((migration) => migration.status === 'UNKNOWN')
  const staleFreshness = adaptive.freshness.filter((item) => ['STALE', 'FAILED', 'PENDING'].includes(item.status) && item.supported)
  const userVisibleProjections = Number(projections.summary.userVisible ?? 0)
  const blockers = [
    ...adaptive.blockers,
    ...missingMigrations.map((migration) => `migration_${migration.table}_${migration.status.toLowerCase()}`),
    lifecycle.error ? `lifecycle_ledger_read_failed:${lifecycle.error}` : null,
    primarySyncJobs.error ? `primary_scheduler_sync_jobs_read_failed:${primarySyncJobs.error}` : null,
    backlog.error ? `settlement_backlog_read_failed:${backlog.error}` : null,
    board.readError ? `current_board_read_failed:${board.readError}` : null,
  ].filter(Boolean) as string[]
  const projectionBlocked = Number(projections.projectionHealth?.blocked ?? 0)
  const projectionVisible = userVisibleProjections
  const platformHealth = blockers.length || staleFreshness.length ? 'DEGRADED' : 'HEALTHY'
  const providerHealth = adaptive.providerBudget.mode === 'EXHAUSTED' || budget.stopThresholdReached
    ? 'BLOCKED'
    : budget.accountingUncertain || budget.configurationStatus !== 'VALID'
      ? 'UNKNOWN'
      : ['CRITICAL', 'CONSERVATIVE'].includes(adaptive.providerBudget.mode)
        ? 'DEGRADED'
        : 'HEALTHY'
  const projectionHealth = projectionVisible > 0
    ? 'OPERATIONAL'
    : projectionBlocked > 0
      ? 'LIMITED_BLOCKED_BY_INTEGRITY'
      : 'INSUFFICIENT_DATA'
  const predictionHealth = board.candidates.length > 0
    ? 'OPERATIONAL'
    : adaptive.gamesReadyForAnalysis > 0
      ? 'DEGRADED'
      : 'WAITING_FOR_VALID_INPUTS'
  const status = overallStatus({
    pendingMigration: missingMigrations.length > 0,
    adaptiveBlocked: adaptive.blockers.length > 0,
    staleCritical: staleFreshness.some((item) => ['odds', 'prediction', 'recommendation'].includes(item.domain)),
    failedSteps: failedSteps.length,
  })
  const skippedCalls = adaptive.refreshPlan
    .filter((item) => item.estimatedProviderCalls > 0 && item.decision !== 'DUE_NOW')
    .reduce((sum, item) => sum + item.estimatedProviderCalls, 0)
  const skipReason = adaptive.providerBudget.mode === 'EXHAUSTED'
    ? 'provider_budget_exhausted'
    : adaptive.refreshPlan.find((item) => item.estimatedProviderCalls > 0 && item.decision === 'NOT_DUE')?.reason ?? null
  const refreshWindow = asRecord((adaptive as unknown as Record<string, unknown>).freshnessPolicy)
  const currentRefreshWindow = String(refreshWindow.window ?? 'UNKNOWN')
  const schedulerWindowMinutes = EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES + EXTERNAL_SCHEDULER_GRACE_MINUTES
  const missedSchedulerIntervals = evidenceAge === null
    ? null
    : Math.max(0, Math.floor(Math.max(0, evidenceAge - schedulerWindowMinutes) / EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES) + (evidenceAge > schedulerWindowMinutes ? 1 : 0))
  const activeSchedulerWindow = ['EARLY', 'PREGAME', 'NEAR_START', 'LIVE'].includes(currentRefreshWindow) ||
    adaptive.refreshPlan.some((item) => item.decision === 'DUE_NOW' || item.decision === 'DUE_SOON')
  const schedulerCadenceStatus =
    !externalSchedulerVerified ? 'NO_EVIDENCE'
      : !activeSchedulerWindow ? 'IDLE'
        : (missedSchedulerIntervals ?? 0) >= 2 ? 'CRITICAL'
          : (missedSchedulerIntervals ?? 0) >= 1 ? 'LATE'
            : 'HEALTHY'
  const schedulerLate = schedulerCadenceStatus === 'LATE' || schedulerCadenceStatus === 'CRITICAL'
  const schedulerCritical = schedulerCadenceStatus === 'CRITICAL'
  const nextExpectedSchedulerWindow = addMinutes(
    lastSuccessfulProtectedInvocationAt,
    EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES
  )
  const operationalSeverity =
    adaptive.providerBudget.mode === 'EXHAUSTED' || adaptive.providerBudget.stopThresholdReached
      ? 'CRITICAL'
      : schedulerCritical
        ? 'CRITICAL'
        : adaptive.blockers.length || !automaticMultiRefreshActive || schedulerLate
        ? 'WARNING'
        : 'HEALTHY'
  const schedulerExecutionHealth = schedulerDomain({
    observedAt: generatedAt,
    schedulerCadenceStatus,
    lastSuccessfulProtectedInvocationAt,
    lastSchedulerFailure: failedSteps[0]?.created_at ?? null,
    evidenceAge,
    missedSchedulerIntervals,
    nextExpectedSchedulerWindow,
    automaticMultiRefreshActive,
    failedSteps,
  })
  const marketFreshnessHealth = marketDomain({
    observedAt: generatedAt,
    oddsFreshness,
    board,
    adaptiveBlockers: adaptive.blockers,
    nextDueAt: oddsFreshness?.nextRecommendedRefreshAt ?? adaptive.nextActionAt,
  })
  const providerBudgetHealth = providerBudgetDomain({ observedAt: generatedAt, adaptive, budget })
  const settlementClosureHealth = settlementDomain({
    observedAt: generatedAt,
    adaptive,
    backlogError: backlog.error,
    pendingPredictions: backlog.pendingPredictions,
  })
  const productReadinessHealth = productReadinessDomain({
    observedAt: generatedAt,
    scheduler: schedulerExecutionHealth,
    market: marketFreshnessHealth,
    provider: providerBudgetHealth,
    settlement: settlementClosureHealth,
    boardCandidates: board.candidates.length,
    officialPicks: board.officialPickCount,
  })
  const healthDomains = {
    contractVersion: 'operational_health_domains_v1',
    observedAt: generatedAt,
    schedulerExecution: schedulerExecutionHealth,
    marketFreshness: marketFreshnessHealth,
    providerBudget: providerBudgetHealth,
    settlementClosure: settlementClosureHealth,
    productReadiness: productReadinessHealth,
    overall: overallHealthDomain({
      schedulerExecution: schedulerExecutionHealth,
      marketFreshness: marketFreshnessHealth,
      providerBudget: providerBudgetHealth,
      settlementClosure: settlementClosureHealth,
      productReadiness: productReadinessHealth,
    }),
    compatibilityAliasesPreserved: [
      'scheduler.schedulerRunning',
      'scheduler.missedSchedulerIntervals',
      'scheduler.schedulerCadenceStatus',
      'refreshOperations.providerStatus',
      'providerBudgets.sportsdataio',
      'componentHealth',
      'currentBoard',
      'freshness',
    ],
  }
  return {
    success: true,
    status: healthDomains.overall.status,
    legacyStatus: status,
    mode: 'operations_health_v1',
    contractVersion: 'operations_health_v2_additive_domains',
    generatedAt,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    operatingDate: adaptive.operatingDate,
    deployment: {
      productionUrl: 'https://pick-analyzer.vercel.app',
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    scheduler: {
      configured: adaptive.schedulerAudit.configuredCronCount > 0,
      configuredCrons: adaptive.schedulerAudit.configuredCrons,
      primaryScheduler: 'VERCEL_OPERATING_DAY_CRON_PRIMARY',
      fallbackScheduler: 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK',
      primaryFallbackContract: 'GitHub fallback uses the same protected endpoint and exits without provider calls when Vercel primary lease evidence is current.',
      lastCronInvocation: adaptive.schedulerAudit.jobs[0]?.lastRunAt ?? null,
      nextScheduledRun: adaptive.schedulerAudit.jobs[0]?.nextRunAt ?? null,
      limitation: 'Vercel Cron owns the frequent operating-day scheduler. GitHub Actions remains fallback through the same protected endpoint and primary-success lease.',
      schedulerEvidenceSource: lastVercelPrimarySyncJobSuccessAt
        ? 'sports_sync_jobs_stage3_primary'
        : lastSuccessfulProtectedInvocationAt ? 'operating_day_lifecycle_events' : 'none',
      lastExternalSchedulerInvocationAt: lastSuccessfulProtectedInvocationAt,
      lastSuccessfulProtectedInvocationAt,
      lastLifecycleProtectedSuccessAt,
      lastLifecycleVercelPrimarySuccessAt,
      lastVercelPrimarySyncJobSuccessAt,
      lastVercelPrimarySuccessAt,
      lastGithubFallbackSuccessAt,
      fallbackHealth: {
        lastSuccessAt: lastGithubFallbackSuccessAt,
        lastFailureAt: failedSteps.find((row) => sourceOf(row) === 'GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK')?.created_at ?? null,
        status: lastGithubFallbackSuccessAt ? 'AVAILABLE' : 'NO_RECENT_SUCCESS_EVIDENCE',
        affectsPrimarySchedulerHealth: false,
      },
      vercelPrimaryEvidenceAgeMinutes: vercelPrimaryEvidenceAge,
      externalSchedulerVerified,
      automaticMultiRefreshActive,
      evidenceAgeMinutes: evidenceAge,
      schedulerRunning: automaticMultiRefreshActive,
      lastSchedulerRun: lifecycleRows[0]?.created_at ?? null,
      lastSchedulerSuccess: lastSuccessfulProtectedInvocationAt,
      lastSchedulerFailure: failedSteps[0]?.created_at ?? null,
      lastSchedulerFailureReason: failedSteps[0]?.blocking_reason ?? null,
      expectedSchedulerIntervalMinutes: EXTERNAL_SCHEDULER_EXPECTED_CADENCE_MINUTES,
      schedulerGraceMinutes: EXTERNAL_SCHEDULER_GRACE_MINUTES,
      lastSchedulerRunAgeMinutes: evidenceAge,
      missedSchedulerIntervals,
      schedulerCadenceStatus,
      nextExpectedSchedulerWindow,
      schedulerLate,
      schedulerCritical,
      healthDomain: schedulerExecutionHealth,
    },
    refreshOperations: {
      providerStatus: providerHealth,
      marketFreshnessStatus: marketFreshnessHealth.status,
      productReadinessStatus: productReadinessHealth.status,
      currentRefreshWindow,
      health: operationalSeverity,
      lastOddsRefresh: String(latestOddsRefresh?.completed_at ?? latestOddsRefresh?.created_at ?? '') || null,
      lastPredictionRefresh: (predictionFreshness?.lastUpdated ?? String(latestPredictionRefresh?.completed_at ?? latestPredictionRefresh?.created_at ?? '')) || null,
      lastRecommendationRefresh: (recommendationFreshness?.lastUpdated ?? String(latestRecommendationRefresh?.completed_at ?? latestRecommendationRefresh?.created_at ?? '')) || null,
      lastResultsRefresh: String(latestResultsRefresh?.completed_at ?? latestResultsRefresh?.created_at ?? resultsFreshness?.lastUpdated ?? '') || null,
      nextRefreshDue: adaptive.refreshPlan
        .filter((item) => item.decision === 'DUE_NOW' || item.decision === 'DUE_SOON')
        .map((item) => ({ domain: item.domain, decision: item.decision, reason: item.reason }))
        .at(0) ?? null,
      nextRefreshDueAt: oddsFreshness?.nextRecommendedRefreshAt ?? adaptive.nextActionAt,
      skippedCalls,
      skipReason,
      activeDueSteps: adaptive.refreshPlan.filter((item) => item.decision === 'DUE_NOW'),
      eventRefreshWindows: Array.isArray((adaptive as unknown as Record<string, unknown>).eventRefreshWindows)
        ? (adaptive as unknown as Record<string, unknown>).eventRefreshWindows
        : [],
    },
    adaptiveExecution: {
      mode: 'protected_existing_operating_day_bridge',
      currentRunStatus: adaptive.automationStatus,
      nextAction: adaptive.nextAction,
      nextActionAt: adaptive.nextActionAt,
      dueSteps: adaptive.refreshPlan.filter((item) => item.decision === 'DUE_NOW'),
      planOnly: false,
      blockers: adaptive.blockers,
      statusRefresh,
    },
    providerBudgets: {
      sportsdataio: {
        status: adaptive.providerBudget.mode,
        canonicalBudget: budget.canonicalBudget,
        callsMadeToday: budget.callsMadeToday,
        callsMadeLastHour: budget.callsMadeLastHour,
        callsPlannedToday: budget.callsPlannedToday,
        hardRemaining: budget.hardRemaining,
        estimatedCallsRemaining: budget.estimatedCallsRemaining,
        hourlyRemaining: budget.hourlyRemaining,
        dailyBudget: budget.config.dailyCallBudget,
        softReserve: budget.config.softReserve,
        maxCallsPerAction: budget.config.maxCallsPerAction,
        maxRefreshCallsPerHour: budget.config.maxRefreshCallsPerHour,
        warningThresholdPercent: budget.config.warningThresholdPercent,
        stopThresholdPercent: budget.config.stopThresholdPercent,
        usagePercent: budget.usagePercent,
        warningThresholdReached: budget.warningThresholdReached,
        stopThresholdReached: budget.stopThresholdReached,
        budgetWarnings: budget.budgetWarnings,
        monthlyEstimateAtCurrentDailyBudget: budget.config.dailyCallBudget * 30,
        lastProviderCall: budget.lastProviderCall,
        healthDomain: providerBudgetHealth,
      },
      theOddsApi: {
        status: 'UNKNOWN',
        classification: 'UNKNOWN_CURRENT_REMAINING_NOT_RECHECKED',
        configuredReserveCredits: 2000,
        combinedWithSportsDataIO: false,
        canonicalBudget: budget.providerPools.theOddsApi,
      },
      bsn: {
        status: 'SOURCE_SPECIFIC_PREVIEW',
        providerPath: 'official_bsn_homepage_csv_manual_future_provider',
        combinedWithTheOddsApi: false,
        canonicalBudget: budget.providerPools.bsn,
      },
      providerPools: budget.providerPools,
    },
    healthDomains,
    componentHealth: {
      platform: {
        status: platformHealth,
        blocker: blockers[0] ?? null,
        explanation: platformHealth === 'HEALTHY' ? 'No critical production blocker is currently active.' : 'One or more critical operational dependencies is degraded.',
      },
      provider: {
        status: providerHealth,
        blocker: providerBudgetHealth.blockers[0] ?? null,
        explanation: providerHealth === 'HEALTHY' ? 'Provider budget capacity is acceptable; market freshness is reported separately.' : 'Provider budget evidence is degraded, blocked or unknown.',
      },
      marketFreshness: {
        status: marketFreshnessHealth.status,
        blocker: marketFreshnessHealth.blockers[0] ?? null,
        explanation: marketFreshnessHealth.summary,
      },
      settlementClosure: {
        status: settlementClosureHealth.status,
        blocker: settlementClosureHealth.blockers[0] ?? null,
        explanation: settlementClosureHealth.summary,
      },
      productReadiness: {
        status: productReadinessHealth.status,
        blocker: productReadinessHealth.blockers[0] ?? productReadinessHealth.warnings[0] ?? null,
        explanation: productReadinessHealth.summary,
      },
      projection: {
        status: projectionHealth,
        visible: projectionVisible,
        blocked: projectionBlocked,
        explanation: projectionVisible > 0
          ? 'Projection board has user-visible rows that satisfy integrity gates.'
          : 'Projection integrity is blocking user-visible rows until entity, feature, starter, validity or sample contracts are satisfied.',
      },
      prediction: {
        status: predictionHealth,
        candidates: board.candidates.length,
        officialPicks: board.officialPickCount,
        explanation: board.candidates.length ? 'Current Board has stored candidates.' : 'Prediction candidates are waiting for valid current inputs.',
      },
    },
    freshness: adaptive.freshness.map((item) => ({
      domain: item.domain,
      label: item.label,
      lastAttemptAt: item.fetchedAt,
      lastSuccessAt: item.lastUpdated,
      lastChangeAt: item.lastUpdated,
      sourceTimestamp: item.lastUpdated,
      ageMinutes: item.ageMinutes,
      thresholdMinutes: item.staleAfterMinutes,
      status: item.status,
      executionMode: item.supported ? 'scheduled_or_protected' : 'unsupported',
      nextDueAt: item.nextRecommendedRefreshAt,
      currentRunStatus: adaptive.automationStatus,
      failureReason: item.staleReason,
      retryAt: item.nextRecommendedRefreshAt,
    })),
    projections: {
      summary: projections.summary,
      health: projections.projectionHealth,
      persistence: projections.persistence,
      userVisible: userVisibleProjections,
    },
    currentBoard: {
      candidates: board.candidates.length,
      officialPicks: board.officialPickCount,
      latestOddsTimestamp: board.latestOddsTimestamp,
      latestOddsSourceTimestamp: board.latestOddsSourceTimestamp,
      latestVisibleMarketSnapshotTimestamp: board.latestVisibleMarketSnapshotTimestamp,
      oldestVisibleMarketSnapshotTimestamp: board.oldestVisibleMarketSnapshotTimestamp,
      visibleMarketCount: board.dataFreshness.visibleMarketCount,
      freshVisibleMarketCount: board.dataFreshness.freshVisibleMarketCount,
      staleVisibleMarketCount: board.dataFreshness.staleVisibleMarketCount,
      freshnessTimestampSource: board.dataFreshness.freshnessTimestampSource,
      timestampSemantics: board.dataFreshness.timestampSemantics,
      status: board.boardHealth.status,
      warnings: board.boardHealth.warnings,
    },
    settlementBacklog: backlog,
    settlementClosure: settlementClosureHealth,
    migrations: {
      pending: missingMigrations,
      unknown: unknownMigrations,
      checks: migrations,
    },
    executionLedger: {
      table: 'operating_day_lifecycle_events',
      recentRuns: lifecycle.rows,
      failedSteps,
      retryingSteps,
      staleLocks: [],
    },
    cacheState: {
      operationalRoutesUseNoStoreFetch: true,
      dashboardMustRefetchAfterMutation: true,
      globalCacheDisabled: false,
      notes: ['Current operations APIs are dynamic server routes; browser clients request with cache:no-store where panels consume them.'],
    },
    exactBlockers: blockers,
    providerCallsToday: budget.callsMadeToday,
    mutationsToday: lifecycle.rows.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>).remoteMutationsMade ?? 0 : 0), 0),
    readinessScore: {
      schedulerReliability: adaptive.schedulerAudit.configuredCronCount > 0 ? 55 : 20,
      adaptiveExecution: 70,
      providerBudgetSafety: adaptive.providerBudget.mode === 'EXHAUSTED' ? 20 : 85,
      dataFreshness: staleFreshness.length ? 45 : 80,
      temporalIntegrity: 85,
      projectionOperations: userVisibleProjections > 0 ? 70 : 45,
      predictionOperations: board.candidates.length > 0 ? 75 : 45,
      currentBoardFreshness: board.latestOddsTimestamp ? 70 : 35,
      settlementReliability: backlog.error ? 35 : 65,
      cacheReliability: 70,
      observability: 80,
      failureRecovery: retryingSteps.length ? 55 : 70,
      migrationReadiness: missingMigrations.length ? 40 : unknownMigrations.length ? 70 : 90,
    },
    closedBetaReadiness: {
      score: Math.round((
        (adaptive.blockers.length ? 50 : 85) +
        (adaptive.providerBudget.mode === 'EXHAUSTED' ? 20 : 80) +
        (board.candidates.length ? 75 : 45) +
        (projectionVisible > 0 ? 75 : 45) +
        (missingMigrations.length ? 35 : unknownMigrations.length ? 70 : 90) +
        (lifecycle.error ? 35 : 75)
      ) / 6),
      status: blockers.length ? 'LIMITED' : 'READY_FOR_MONITORED_CLOSED_BETA',
      exactBlockers: blockers,
      notes: [
        'Closed beta readiness is operational, not betting-performance certification.',
        'Official thresholds, champion state, projection integrity and settlement policy remain unchanged.',
      ],
    },
    certification: {
      operationsProductionReady: false,
      closedBetaOperationsReady: healthDomains.overall.status === 'HEALTHY' && missingMigrations.length === 0,
      reason: productReadinessHealth.summary,
      domainSummary: {
        schedulerExecution: schedulerExecutionHealth.status,
        marketFreshness: marketFreshnessHealth.status,
        providerBudget: providerBudgetHealth.status,
        settlementClosure: settlementClosureHealth.status,
        productReadiness: productReadinessHealth.status,
      },
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionMutationsMade: 0,
      officialThresholdsChanged: false,
      championRowsMutated: false,
      v7Promoted: false,
      currentBoardPolicyChanged: false,
      settlementPolicyChanged: false,
    },
  }
}
