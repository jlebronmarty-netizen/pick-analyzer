import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  checkProviderBudget,
  claimProviderActionLock,
  getProviderActionLockStatus,
  releaseProviderActionLock,
} from '@/services/provider-budget.service'
import { syncNbaOdds } from '@/services/nba-data-sync.service'
import {
  runNbaCurrentEraShadowCanary,
  selectNbaCurrentEraShadowAccumulationBatch,
  type NbaCurrentEraShadowCanaryResult,
} from '@/services/nba-current-era-shadow-canary.service'
import {
  NBA_SHADOW_SCHEDULER_ENABLED_ENV,
  NBA_SHADOW_SCHEDULER_MODE,
  NBA_SHADOW_SCHEDULER_POLICY_VERSION,
  NBA_SHADOW_SCHEDULER_VERSION,
} from '@/services/nba-shadow-scheduler-preparation.service'

export const NBA_SHADOW_SCHEDULER_ROUTE = '/api/cron/nba-current-era-shadow'
export const NBA_SHADOW_SCHEDULER_JOB_TYPE = 'nba_current_era_shadow_scheduler_canary_v1'
export const NBA_SHADOW_SCHEDULER_LOCK_KEY = 'nba_current_era_shadow_scheduler'
export const NBA_SHADOW_SCHEDULER_PER_RUN_CAP = 3
export const NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS = 2
export const NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS = 4
export const NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP = 12
export const NBA_SHADOW_SCHEDULER_PENDING_GUARD = 75
export const NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN = 2
export const NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR = 4
export const NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY = 48
export const NBA_SHADOW_SCHEDULER_PROVIDER = 'the-odds-api'
export const NBA_SHADOW_SCHEDULER_SPORT_KEY = 'basketball_nba'
export const NBA_SHADOW_SCHEDULER_LEAGUE_KEY = 'nba'

export type NbaShadowSchedulerClassification =
  | 'SCHEDULER_DISABLED_NO_OP'
  | 'LOCK_CONFLICT_NO_OP'
  | 'CANARY_REVIEW_REQUIRED_NO_OP'
  | 'CANARY_HARD_LIMIT_REACHED_NO_OP'
  | 'PENDING_GUARD_NO_OP'
  | 'PROVIDER_BUDGET_NO_OP'
  | 'NO_CURRENT_EVENT_NO_OP'
  | 'NO_ELIGIBLE_CANDIDATE_NO_OP'
  | 'PROVIDER_FAILURE_BLOCKED'
  | 'PERSISTENCE_FAILURE_BLOCKED'
  | 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS'

export type NbaShadowSchedulerPrecheckClassification =
  | 'SCHEDULER_PRECHECK_READY'
  | 'SCHEDULER_PRECHECK_DISABLED'
  | 'SCHEDULER_PRECHECK_REVIEW_REQUIRED'
  | 'SCHEDULER_PRECHECK_HARD_LIMIT'
  | 'SCHEDULER_PRECHECK_PENDING_GUARD'
  | 'SCHEDULER_PRECHECK_LOCK_ACTIVE'
  | 'SCHEDULER_PRECHECK_PROVIDER_BUDGET_BLOCKED'

export type NbaShadowSchedulerProviderBudgetAuthorizationMode =
  | 'provider_budget'
  | 'bounded_canary_unknown_balance'
  | 'denied'
  | 'not_evaluated'

export type NbaShadowSchedulerProviderBudgetReadiness = {
  requestedCalls: number
  allowed: boolean
  authorizationMode: NbaShadowSchedulerProviderBudgetAuthorizationMode
  evidenceStatus: string
  externalBalanceKnown: boolean
  reasonCodes: string[]
  hourlyUsed: number
  hourlyRemaining: number
  dailyUsed: number
  dailyRemaining: number
  canaryAuthorized: boolean
  blockedReason: string | null
  providerBudget: Record<string, unknown> | null
}

export type NbaShadowSchedulerIsolation = {
  officialPickDelta: 0
  productVisibilityDelta: 0
  learningDelta: 0
  calibrationDelta: 0
  bankrollDelta: 0
  notificationDelta: 0
  historicalReplayDelta: 0
  mlbMutationDelta: 0
}

export type NbaShadowSchedulerCandidatePersistenceResult = {
  candidateKey: string
  status: string | null
  inserted: number
  reused: number
  success: boolean
  classification: string
}

export type NbaShadowSchedulerResult = {
  success: boolean
  runId: string
  schedulerMode: typeof NBA_SHADOW_SCHEDULER_MODE
  schedulerVersion: typeof NBA_SHADOW_SCHEDULER_VERSION
  policyVersion: typeof NBA_SHADOW_SCHEDULER_POLICY_VERSION
  startedAt: string
  completedAt: string
  durationMs: number
  enabled: boolean
  lock: 'not_requested' | 'acquired' | 'conflict' | 'released'
  canaryRunNumber: number | null
  canaryCompletedRunsBefore: number
  canaryTotalInsertedBefore: number
  canaryTotalInsertedAfter: number
  pendingBefore: number | null
  providerCalls: number
  providerBudget: Record<string, unknown> | null
  eventsFetched: number
  priceCandidates: number
  modelMatches: number
  eligibleCandidates: number
  selectedCount: number
  insertedCount: number
  reusedCount: number
  skippedReasons: Record<string, number>
  currentEraBefore: number | null
  currentEraAfter: number | null
  isolation: NbaShadowSchedulerIsolation
  persistenceAttempts: number
  persistenceResults: NbaShadowSchedulerCandidatePersistenceResult[]
  finalClassification: NbaShadowSchedulerClassification
  error: string | null
  auditJobId: string | null
}

type CanaryState = {
  completedRuns: number
  totalInsertedRows: number
  lastRunId: string | null
}

type CountState = {
  currentEraRows: number
  pendingRows: number
}

export type NbaShadowSchedulerPrecheckStatus = {
  success: boolean
  readOnly: true
  schedulerMode: typeof NBA_SHADOW_SCHEDULER_MODE
  schedulerVersion: typeof NBA_SHADOW_SCHEDULER_VERSION
  policyVersion: typeof NBA_SHADOW_SCHEDULER_POLICY_VERSION
  schedulerEnabled: boolean
  enabledEnvName: typeof NBA_SHADOW_SCHEDULER_ENABLED_ENV
  environmentFlagObserved: 'true' | 'false_or_unset'
  completedCanaryRuns: number
  canaryInsertedRows: number
  reviewRequired: boolean
  hardLimitReached: boolean
  pendingCurrentEraShadowRows: number
  pendingGuardLimit: typeof NBA_SHADOW_SCHEDULER_PENDING_GUARD
  pendingGuardReached: boolean
  currentEraShadowCount: number
  activeSchedulerLock: boolean
  lockStatus: ReturnType<typeof getProviderActionLockStatus>
  perRunWriteCap: typeof NBA_SHADOW_SCHEDULER_PER_RUN_CAP
  reviewAfterRuns: typeof NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS
  hardMaxRuns: typeof NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS
  totalCanaryRowCap: typeof NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP
  providerBudget: {
    provider: typeof NBA_SHADOW_SCHEDULER_PROVIDER
    sportKey: typeof NBA_SHADOW_SCHEDULER_SPORT_KEY
    maxCallsPerRun: typeof NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN
    maxCallsPerHour: typeof NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR
    maxCallsPerDay: typeof NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY
    sportsDataIoCalls: 0
    historicalOddsCalls: 0
  }
  providerCalls: 0
  currentDataSyncInvocations: 0
  predictionWrites: 0
  runCounterMutations: 0
  auditJobWrites: 0
  schedulerLockAcquisitions: 0
  providerBudgetRequestedCalls: number
  providerBudgetAllowed: boolean
  providerBudgetAuthorizationMode: NbaShadowSchedulerProviderBudgetAuthorizationMode
  providerBudgetEvidenceStatus: string
  providerBudgetExternalBalanceKnown: boolean
  providerBudgetReasonCodes: string[]
  providerBudgetHourlyUsed: number
  providerBudgetHourlyRemaining: number
  providerBudgetDailyUsed: number
  providerBudgetDailyRemaining: number
  providerBudgetCanaryAuthorized: boolean
  providerBudgetBlockedReason: string | null
  finalClassification: NbaShadowSchedulerPrecheckClassification
}

const isolationZero: NbaShadowSchedulerIsolation = {
  officialPickDelta: 0,
  productVisibilityDelta: 0,
  learningDelta: 0,
  calibrationDelta: 0,
  bankrollDelta: 0,
  notificationDelta: 0,
  historicalReplayDelta: 0,
  mlbMutationDelta: 0,
}

function nowIso() {
  return new Date().toISOString()
}

function schedulerEnabled() {
  return String(process.env[NBA_SHADOW_SCHEDULER_ENABLED_ENV] ?? '').toLowerCase() === 'true'
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export function authorizeNbaShadowSchedulerProviderBudgetSnapshot(input: {
  requestedCalls: number
  budgetAllowed: boolean
  blockedReason?: string | null
  status?: Record<string, unknown> | null
  authorization?: Record<string, unknown> | null
  providerBudget?: Record<string, unknown> | null
}): NbaShadowSchedulerProviderBudgetReadiness {
  const requestedCalls = Math.max(0, Math.floor(input.requestedCalls))
  const status = recordValue(input.status)
  const authorization = recordValue(input.authorization)
  const canonicalBudget = recordValue(status.canonicalBudget)
  const reasonCodes = [
    ...stringArray(authorization.reasonCodes),
    ...stringArray(canonicalBudget.reasonCodes),
  ]
  const hourlyUsed = numberValue(status.callsMadeLastHour)
  const dailyUsed = numberValue(status.callsMadeToday)
  const hourlyRemaining = Math.max(0, NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR - hourlyUsed)
  const dailyRemaining = Math.max(0, NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY - dailyUsed)
  const evidenceStatus = String(canonicalBudget.evidenceLevel ?? authorization.evidenceLevel ?? 'UNKNOWN')
  const externalBalanceKnown = evidenceStatus !== 'UNKNOWN' && canonicalBudget.usableRemaining !== null && canonicalBudget.usableRemaining !== undefined
  const authorizationResult = String(authorization.result ?? '')
  const accountingUncertain = Boolean(status.accountingUncertain)
  const configurationValid = String(status.configurationStatus ?? 'VALID') === 'VALID'
  const providerId = String(status.providerId ?? canonicalBudget.providerId ?? NBA_SHADOW_SCHEDULER_PROVIDER)
  const sportKey = String(status.sportKey ?? NBA_SHADOW_SCHEDULER_SPORT_KEY)
  const internalCapsPass =
    requestedCalls > 0 &&
    requestedCalls <= NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN &&
    requestedCalls <= hourlyRemaining &&
    requestedCalls <= dailyRemaining
  const scopedCanaryAllowed =
    providerId === NBA_SHADOW_SCHEDULER_PROVIDER &&
    sportKey === NBA_SHADOW_SCHEDULER_SPORT_KEY &&
    !accountingUncertain &&
    configurationValid &&
    evidenceStatus === 'UNKNOWN' &&
    authorizationResult === 'DENY_UNKNOWN_BUDGET' &&
    internalCapsPass

  if (input.budgetAllowed) {
    return {
      requestedCalls,
      allowed: true,
      authorizationMode: 'provider_budget',
      evidenceStatus,
      externalBalanceKnown,
      reasonCodes: [...new Set([...reasonCodes, 'PROVIDER_BUDGET_AUTHORIZED'])],
      hourlyUsed,
      hourlyRemaining,
      dailyUsed,
      dailyRemaining,
      canaryAuthorized: false,
      blockedReason: null,
      providerBudget: input.providerBudget ?? null,
    }
  }

  if (scopedCanaryAllowed) {
    return {
      requestedCalls,
      allowed: true,
      authorizationMode: 'bounded_canary_unknown_balance',
      evidenceStatus,
      externalBalanceKnown: false,
      reasonCodes: [
        ...new Set([
          ...reasonCodes,
          'NBA_03A_BOUNDED_CANARY_AUTHORIZED_UNKNOWN_BALANCE',
          'NBA_03A_INTERNAL_PROVIDER_CAPS_PASS',
        ]),
      ],
      hourlyUsed,
      hourlyRemaining,
      dailyUsed,
      dailyRemaining,
      canaryAuthorized: true,
      blockedReason: null,
      providerBudget: input.providerBudget ?? null,
    }
  }

  return {
    requestedCalls,
    allowed: false,
    authorizationMode: 'denied',
    evidenceStatus,
    externalBalanceKnown,
    reasonCodes: [
      ...new Set([
        ...reasonCodes,
        requestedCalls > NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN ? 'NBA_03A_CANARY_RUN_CAP_EXCEEDED' : null,
        requestedCalls > hourlyRemaining ? 'NBA_03A_CANARY_HOURLY_CAP_EXCEEDED' : null,
        requestedCalls > dailyRemaining ? 'NBA_03A_CANARY_DAILY_CAP_EXCEEDED' : null,
        accountingUncertain ? 'NBA_03A_CANARY_ACCOUNTING_UNCERTAIN' : null,
        !configurationValid ? 'NBA_03A_CANARY_CONFIG_INVALID' : null,
      ].filter(Boolean) as string[]),
    ],
    hourlyUsed,
    hourlyRemaining,
    dailyUsed,
    dailyRemaining,
    canaryAuthorized: false,
    blockedReason: input.blockedReason ?? (authorizationResult || 'PROVIDER_BUDGET_DENIED'),
    providerBudget: input.providerBudget ?? null,
  }
}

async function authorizeNbaShadowSchedulerProviderBudget() {
  const budget = await checkProviderBudget({
    provider: NBA_SHADOW_SCHEDULER_PROVIDER,
    sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
    action: 'current_odds_refresh',
    requestedCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
    estimatedCost: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
    dryRun: false,
    urgency: 'scheduler_canary',
    operationalClass: 'current_era_shadow_generation',
  })
  const budgetRecord = budget as unknown as Record<string, unknown>
  const readiness = authorizeNbaShadowSchedulerProviderBudgetSnapshot({
    requestedCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
    budgetAllowed: budget.allowed,
    blockedReason: budget.blockedReason,
    status: budget.status as unknown as Record<string, unknown>,
    authorization: budget.authorization as unknown as Record<string, unknown>,
    providerBudget: {
      ...budgetRecord,
      nba03aCanaryAuthorization: {
        scope: NBA_SHADOW_SCHEDULER_MODE,
        authorizationMode: budget.allowed ? 'provider_budget' : 'bounded_canary_unknown_balance',
        requestedCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        maxCallsPerRun: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        maxCallsPerHour: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR,
        maxCallsPerDay: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY,
        sportsDataIoCalls: 0,
        historicalOddsCalls: 0,
      },
    },
  })
  if (readiness.providerBudget) {
    readiness.providerBudget = {
      ...readiness.providerBudget,
      nba03aCanaryAuthorization: {
        ...(recordValue(readiness.providerBudget.nba03aCanaryAuthorization)),
        allowed: readiness.allowed,
        authorizationMode: readiness.authorizationMode,
        externalBalanceKnown: readiness.externalBalanceKnown,
        evidenceStatus: readiness.evidenceStatus,
        reasonCodes: readiness.reasonCodes,
        hourlyUsed: readiness.hourlyUsed,
        hourlyRemaining: readiness.hourlyRemaining,
        dailyUsed: readiness.dailyUsed,
        dailyRemaining: readiness.dailyRemaining,
      },
    }
  }
  return readiness
}

function baseResult(input: {
  runId: string
  startedAt: string
  enabled: boolean
  lock?: NbaShadowSchedulerResult['lock']
  canaryState?: CanaryState
  counts?: Partial<CountState>
  classification: NbaShadowSchedulerClassification
  success?: boolean
  error?: string | null
  providerBudget?: Record<string, unknown> | null
  providerCalls?: number
  eventsFetched?: number
  priceCandidates?: number
  modelMatches?: number
  eligibleCandidates?: number
  selectedCount?: number
  insertedCount?: number
  reusedCount?: number
  skippedReasons?: Record<string, number>
  currentEraAfter?: number | null
  auditJobId?: string | null
  persistenceResults?: NbaShadowSchedulerCandidatePersistenceResult[]
}): NbaShadowSchedulerResult {
  const completedAt = nowIso()
  const persistenceResults = input.persistenceResults ?? []
  return {
    success: input.success ?? input.classification === 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS',
    runId: input.runId,
    schedulerMode: NBA_SHADOW_SCHEDULER_MODE,
    schedulerVersion: NBA_SHADOW_SCHEDULER_VERSION,
    policyVersion: NBA_SHADOW_SCHEDULER_POLICY_VERSION,
    startedAt: input.startedAt,
    completedAt,
    durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(input.startedAt).getTime()),
    enabled: input.enabled,
    lock: input.lock ?? 'not_requested',
    canaryRunNumber: input.canaryState ? input.canaryState.completedRuns + 1 : null,
    canaryCompletedRunsBefore: input.canaryState?.completedRuns ?? 0,
    canaryTotalInsertedBefore: input.canaryState?.totalInsertedRows ?? 0,
    canaryTotalInsertedAfter: input.canaryState?.totalInsertedRows ?? 0,
    pendingBefore: input.counts?.pendingRows ?? null,
    providerCalls: input.providerCalls ?? 0,
    providerBudget: input.providerBudget ?? null,
    eventsFetched: input.eventsFetched ?? 0,
    priceCandidates: input.priceCandidates ?? 0,
    modelMatches: input.modelMatches ?? 0,
    eligibleCandidates: input.eligibleCandidates ?? 0,
    selectedCount: input.selectedCount ?? 0,
    insertedCount: input.insertedCount ?? 0,
    reusedCount: input.reusedCount ?? 0,
    skippedReasons: input.skippedReasons ?? {},
    currentEraBefore: input.counts?.currentEraRows ?? null,
    currentEraAfter: input.currentEraAfter ?? input.counts?.currentEraRows ?? null,
    isolation: isolationZero,
    persistenceAttempts: persistenceResults.length,
    persistenceResults,
    finalClassification: input.classification,
    error: input.error ?? null,
    auditJobId: input.auditJobId ?? null,
  }
}

async function countRows(): Promise<CountState> {
  const [total, settled] = await Promise.all([
    supabaseAdmin
      .from('prediction_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SHADOW_SCHEDULER_SPORT_KEY)
      .eq('prediction_origin', 'CURRENT_ERA_SHADOW'),
    supabaseAdmin
      .from('prediction_history')
      .select('id', { count: 'exact', head: true })
      .eq('sport_key', NBA_SHADOW_SCHEDULER_SPORT_KEY)
      .eq('prediction_origin', 'CURRENT_ERA_SHADOW')
      .in('result', ['win', 'loss', 'push']),
  ])
  if (total.error) throw new Error(`NBA shadow current-era count failed: ${total.error.message}`)
  if (settled.error) throw new Error(`NBA shadow settled count failed: ${settled.error.message}`)
  const currentEraRows = total.count ?? 0
  return {
    currentEraRows,
    pendingRows: Math.max(0, currentEraRows - (settled.count ?? 0)),
  }
}

async function loadCanaryState(): Promise<CanaryState> {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,records_inserted,metadata,started_at')
    .eq('sport_key', NBA_SHADOW_SCHEDULER_SPORT_KEY)
    .eq('job_type', NBA_SHADOW_SCHEDULER_JOB_TYPE)
    .order('started_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`NBA shadow scheduler canary state read failed: ${error.message}`)
  const completed = (data ?? []).filter((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    return row.status === 'completed' && metadata.schedulerVersion === NBA_SHADOW_SCHEDULER_VERSION
  })
  return {
    completedRuns: completed.length,
    totalInsertedRows: completed.reduce((sum, row) => sum + (Number(row.records_inserted) || 0), 0),
    lastRunId: String(completed[0]?.id ?? '') || null,
  }
}

function classifyPrecheck(input: {
  enabled: boolean
  state: CanaryState
  counts: CountState
  activeLock: boolean
  providerBudgetAllowed?: boolean
}): NbaShadowSchedulerPrecheckClassification {
  if (!input.enabled) return 'SCHEDULER_PRECHECK_DISABLED'
  if (input.activeLock) return 'SCHEDULER_PRECHECK_LOCK_ACTIVE'
  if (
    input.state.completedRuns >= NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS ||
    input.state.totalInsertedRows >= NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP
  ) {
    return 'SCHEDULER_PRECHECK_HARD_LIMIT'
  }
  if (input.state.completedRuns >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS) return 'SCHEDULER_PRECHECK_REVIEW_REQUIRED'
  if (input.counts.pendingRows >= NBA_SHADOW_SCHEDULER_PENDING_GUARD) return 'SCHEDULER_PRECHECK_PENDING_GUARD'
  if (input.providerBudgetAllowed === false) return 'SCHEDULER_PRECHECK_PROVIDER_BUDGET_BLOCKED'
  return 'SCHEDULER_PRECHECK_READY'
}

export async function getNbaCurrentEraShadowSchedulerPrecheckStatus(): Promise<NbaShadowSchedulerPrecheckStatus> {
  const enabled = schedulerEnabled()
  const [canaryState, counts] = await Promise.all([loadCanaryState(), countRows()])
  const lockStatus = getProviderActionLockStatus(NBA_SHADOW_SCHEDULER_LOCK_KEY)
  const reviewRequired = canaryState.completedRuns >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS
  const hardLimitReached =
    canaryState.completedRuns >= NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS ||
    canaryState.totalInsertedRows >= NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP
  const pendingGuardReached = counts.pendingRows >= NBA_SHADOW_SCHEDULER_PENDING_GUARD
  const shouldEvaluateBudget = enabled && !lockStatus.active && !reviewRequired && !hardLimitReached && !pendingGuardReached
  const providerBudgetReadiness = shouldEvaluateBudget
    ? await authorizeNbaShadowSchedulerProviderBudget()
    : {
        requestedCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        allowed: false,
        authorizationMode: 'not_evaluated' as const,
        evidenceStatus: 'NOT_EVALUATED',
        externalBalanceKnown: false,
        reasonCodes: [],
        hourlyUsed: 0,
        hourlyRemaining: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR,
        dailyUsed: 0,
        dailyRemaining: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY,
        canaryAuthorized: false,
        blockedReason: null,
        providerBudget: null,
      }
  return {
    success: true,
    readOnly: true,
    schedulerMode: NBA_SHADOW_SCHEDULER_MODE,
    schedulerVersion: NBA_SHADOW_SCHEDULER_VERSION,
    policyVersion: NBA_SHADOW_SCHEDULER_POLICY_VERSION,
    schedulerEnabled: enabled,
    enabledEnvName: NBA_SHADOW_SCHEDULER_ENABLED_ENV,
    environmentFlagObserved: enabled ? 'true' : 'false_or_unset',
    completedCanaryRuns: canaryState.completedRuns,
    canaryInsertedRows: canaryState.totalInsertedRows,
    reviewRequired,
    hardLimitReached,
    pendingCurrentEraShadowRows: counts.pendingRows,
    pendingGuardLimit: NBA_SHADOW_SCHEDULER_PENDING_GUARD,
    pendingGuardReached,
    currentEraShadowCount: counts.currentEraRows,
    activeSchedulerLock: lockStatus.active,
    lockStatus,
    perRunWriteCap: NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
    reviewAfterRuns: NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS,
    hardMaxRuns: NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS,
    totalCanaryRowCap: NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP,
    providerBudget: {
      provider: NBA_SHADOW_SCHEDULER_PROVIDER,
      sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
      maxCallsPerRun: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
      maxCallsPerHour: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR,
      maxCallsPerDay: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY,
      sportsDataIoCalls: 0,
      historicalOddsCalls: 0,
    },
    providerCalls: 0,
    currentDataSyncInvocations: 0,
    predictionWrites: 0,
    runCounterMutations: 0,
    auditJobWrites: 0,
    schedulerLockAcquisitions: 0,
    providerBudgetRequestedCalls: providerBudgetReadiness.requestedCalls,
    providerBudgetAllowed: providerBudgetReadiness.allowed,
    providerBudgetAuthorizationMode: providerBudgetReadiness.authorizationMode,
    providerBudgetEvidenceStatus: providerBudgetReadiness.evidenceStatus,
    providerBudgetExternalBalanceKnown: providerBudgetReadiness.externalBalanceKnown,
    providerBudgetReasonCodes: providerBudgetReadiness.reasonCodes,
    providerBudgetHourlyUsed: providerBudgetReadiness.hourlyUsed,
    providerBudgetHourlyRemaining: providerBudgetReadiness.hourlyRemaining,
    providerBudgetDailyUsed: providerBudgetReadiness.dailyUsed,
    providerBudgetDailyRemaining: providerBudgetReadiness.dailyRemaining,
    providerBudgetCanaryAuthorized: providerBudgetReadiness.canaryAuthorized,
    providerBudgetBlockedReason: providerBudgetReadiness.blockedReason,
    finalClassification: classifyPrecheck({
      enabled,
      state: canaryState,
      counts,
      activeLock: lockStatus.active,
      providerBudgetAllowed: shouldEvaluateBudget ? providerBudgetReadiness.allowed : undefined,
    }),
  }
}

async function startAuditJob(runId: string, state: CanaryState) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .insert({
      job_type: NBA_SHADOW_SCHEDULER_JOB_TYPE,
      sport_key: NBA_SHADOW_SCHEDULER_SPORT_KEY,
      league_key: NBA_SHADOW_SCHEDULER_LEAGUE_KEY,
      provider: NBA_SHADOW_SCHEDULER_PROVIDER,
      season: 'current',
      status: 'running',
      metadata: {
        runId,
        schedulerMode: NBA_SHADOW_SCHEDULER_MODE,
        schedulerVersion: NBA_SHADOW_SCHEDULER_VERSION,
        policyVersion: NBA_SHADOW_SCHEDULER_POLICY_VERSION,
        canaryCompletedRunsBefore: state.completedRuns,
        canaryTotalInsertedBefore: state.totalInsertedRows,
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`NBA shadow scheduler audit insert failed: ${error.message}`)
  return String(data.id)
}

async function finishAuditJob(jobId: string | null, result: NbaShadowSchedulerResult) {
  if (!jobId) return
  await supabaseAdmin
    .from('sports_sync_jobs')
    .update({
      status: result.success ? 'completed' : 'failed',
      completed_at: result.completedAt,
      records_fetched: result.priceCandidates,
      records_inserted: result.insertedCount,
      records_updated: 0,
      records_skipped: Math.max(0, result.eligibleCandidates - result.insertedCount),
      error_count: result.success ? 0 : 1,
      last_error: result.error,
      duration_ms: result.durationMs,
      metadata: {
        runId: result.runId,
        schedulerMode: result.schedulerMode,
        schedulerVersion: result.schedulerVersion,
        policyVersion: result.policyVersion,
        finalClassification: result.finalClassification,
        canaryRunNumber: result.canaryRunNumber,
        canaryCompletedRunsBefore: result.canaryCompletedRunsBefore,
        canaryTotalInsertedBefore: result.canaryTotalInsertedBefore,
        canaryTotalInsertedAfter: result.canaryTotalInsertedAfter,
        pendingBefore: result.pendingBefore,
        providerCalls: result.providerCalls,
        providerBudget: result.providerBudget,
        eventsFetched: result.eventsFetched,
        modelMatches: result.modelMatches,
        eligibleCandidates: result.eligibleCandidates,
        selectedCount: result.selectedCount,
        persistenceAttempts: result.persistenceAttempts,
        persistenceResults: result.persistenceResults,
        selectedCandidateKeys: result.persistenceResults.map((item) => item.candidateKey),
        reusedCount: result.reusedCount,
        skippedReasons: result.skippedReasons,
        currentEraBefore: result.currentEraBefore,
        currentEraAfter: result.currentEraAfter,
        isolation: result.isolation,
      },
    })
    .eq('id', jobId)
}

function withTemporaryWriteAuthorization<T>(callback: () => Promise<T>) {
  const previous = process.env.NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED
  process.env.NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED = 'true'
  return callback().finally(() => {
    if (previous === undefined) delete process.env.NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED
    else process.env.NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED = previous
  })
}

export async function runNbaCurrentEraShadowSchedulerCanary(): Promise<NbaShadowSchedulerResult> {
  const startedAt = nowIso()
  const runId = crypto.randomUUID()
  const enabled = schedulerEnabled()
  if (!enabled) {
    return baseResult({ runId, startedAt, enabled, classification: 'SCHEDULER_DISABLED_NO_OP' })
  }

  if (!claimProviderActionLock(NBA_SHADOW_SCHEDULER_LOCK_KEY, 10 * 60 * 1000)) {
    return baseResult({ runId, startedAt, enabled, lock: 'conflict', classification: 'LOCK_CONFLICT_NO_OP' })
  }

  let auditJobId: string | null = null
  try {
    const canaryState = await loadCanaryState()
    if (canaryState.completedRuns >= NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS || canaryState.totalInsertedRows >= NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP) {
      return baseResult({ runId, startedAt, enabled, lock: 'released', canaryState, classification: 'CANARY_HARD_LIMIT_REACHED_NO_OP' })
    }
    if (canaryState.completedRuns >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS) {
      return baseResult({ runId, startedAt, enabled, lock: 'released', canaryState, classification: 'CANARY_REVIEW_REQUIRED_NO_OP' })
    }

    const counts = await countRows()
    if (counts.pendingRows >= NBA_SHADOW_SCHEDULER_PENDING_GUARD) {
      return baseResult({ runId, startedAt, enabled, lock: 'released', canaryState, counts, classification: 'PENDING_GUARD_NO_OP' })
    }

    const budgetReadiness = await authorizeNbaShadowSchedulerProviderBudget()
    const budgetRecord = budgetReadiness.providerBudget ?? {
      allowed: budgetReadiness.allowed,
      blockedReason: budgetReadiness.blockedReason,
      nba03aCanaryAuthorization: budgetReadiness,
    }
    if (!budgetReadiness.allowed) {
      return baseResult({
        runId,
        startedAt,
        enabled,
        lock: 'released',
        canaryState,
        counts,
        providerBudget: budgetRecord,
        classification: 'PROVIDER_BUDGET_NO_OP',
      })
    }

    auditJobId = await startAuditJob(runId, canaryState)
    const sync = await syncNbaOdds({ mode: 'live' })
    if (!sync.success) {
      const blocked = baseResult({
        runId,
        startedAt,
        enabled,
        lock: 'released',
        canaryState,
        counts,
        auditJobId,
        providerBudget: budgetRecord,
        providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        classification: 'PROVIDER_FAILURE_BLOCKED',
        error: sync.errors.join('; ') || 'NBA odds sync failed',
      })
      await finishAuditJob(auditJobId, blocked)
      return blocked
    }

    const dryRun = await runNbaCurrentEraShadowCanary({ mode: 'dry-run', limit: 25 })
    if (dryRun.eventsScanned <= 0) {
      const noEvent = baseResult({
        runId,
        startedAt,
        enabled,
        lock: 'released',
        canaryState,
        counts,
        auditJobId,
        providerBudget: budgetRecord,
        providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        classification: 'NO_CURRENT_EVENT_NO_OP',
        skippedReasons: dryRun.skipReasons,
      })
      await finishAuditJob(auditJobId, noEvent)
      return noEvent
    }

    const selection = selectNbaCurrentEraShadowAccumulationBatch({
      candidates: dryRun.candidates,
      batchSize: NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
    })
    if (!selection.selected.length) {
      const noEligible = baseResult({
        runId,
        startedAt,
        enabled,
        lock: 'released',
        canaryState,
        counts,
        auditJobId,
        providerBudget: budgetRecord,
        providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
        eventsFetched: dryRun.eventsScanned,
        priceCandidates: dryRun.candidates.length,
        modelMatches: dryRun.candidates.filter((candidate) => candidate.modelMatched).length,
        eligibleCandidates: dryRun.eligible,
        classification: 'NO_ELIGIBLE_CANDIDATE_NO_OP',
        skippedReasons: dryRun.skipReasons,
      })
      await finishAuditJob(auditJobId, noEligible)
      return noEligible
    }

    const writes: NbaCurrentEraShadowCanaryResult[] = []
    const persistenceResults: NbaShadowSchedulerCandidatePersistenceResult[] = []
    for (const candidate of selection.selected.slice(0, NBA_SHADOW_SCHEDULER_PER_RUN_CAP)) {
      if (!candidate.candidateKey) continue
      const write = await withTemporaryWriteAuthorization(() =>
        runNbaCurrentEraShadowCanary({ mode: 'write-one', limit: 25, candidateKey: candidate.candidateKey })
      )
      writes.push(write)
      const persistenceResult: NbaShadowSchedulerCandidatePersistenceResult = {
        candidateKey: candidate.candidateKey,
        status: write.writeStatus ?? null,
        inserted: write.inserted,
        reused: write.reused,
        success: write.success && (!write.writeStatus || ['CREATED', 'ALREADY_EXISTS'].includes(write.writeStatus)),
        classification: write.classification,
      }
      persistenceResults.push(persistenceResult)
      if (!write.success || (write.writeStatus && !['CREATED', 'ALREADY_EXISTS'].includes(write.writeStatus))) {
        const failed = baseResult({
          runId,
          startedAt,
          enabled,
          lock: 'released',
          canaryState,
          counts,
          auditJobId,
          providerBudget: budgetRecord,
          providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
          eventsFetched: dryRun.eventsScanned,
          priceCandidates: dryRun.candidates.length,
          modelMatches: dryRun.candidates.filter((candidate) => candidate.modelMatched).length,
          eligibleCandidates: dryRun.eligible,
          selectedCount: selection.selected.length,
          insertedCount: writes.reduce((sum, item) => sum + item.inserted, 0),
          reusedCount: writes.reduce((sum, item) => sum + item.reused, 0),
          persistenceResults,
          classification: 'PERSISTENCE_FAILURE_BLOCKED',
          error: write.writeStatus ?? write.classification,
          skippedReasons: dryRun.skipReasons,
        })
        await finishAuditJob(auditJobId, failed)
        return failed
      }
    }

    const after = await countRows()
    const inserted = writes.reduce((sum, item) => sum + item.inserted, 0)
    const success = baseResult({
      runId,
      startedAt,
      enabled,
      lock: 'released',
      canaryState,
      counts,
      auditJobId,
      providerBudget: budgetRecord,
      providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
      eventsFetched: dryRun.eventsScanned,
      priceCandidates: dryRun.candidates.length,
      modelMatches: dryRun.candidates.filter((candidate) => candidate.modelMatched).length,
      eligibleCandidates: dryRun.eligible,
      selectedCount: Math.min(selection.selected.length, NBA_SHADOW_SCHEDULER_PER_RUN_CAP),
      insertedCount: inserted,
      reusedCount: writes.reduce((sum, item) => sum + item.reused, 0),
      persistenceResults,
      currentEraAfter: after.currentEraRows,
      skippedReasons: dryRun.skipReasons,
      classification: 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS',
    })
    success.canaryTotalInsertedAfter = canaryState.totalInsertedRows + inserted
    await finishAuditJob(auditJobId, success)
    return success
  } catch (error) {
    const failed = baseResult({
      runId,
      startedAt,
      enabled,
      lock: 'released',
      auditJobId,
      classification: 'PERSISTENCE_FAILURE_BLOCKED',
      error: error instanceof Error ? error.message : 'unknown scheduler failure',
    })
    await finishAuditJob(auditJobId, failed)
    return failed
  } finally {
    releaseProviderActionLock(NBA_SHADOW_SCHEDULER_LOCK_KEY)
  }
}

export type NbaShadowSchedulerFixtureInput = {
  authorized?: boolean
  schedulerEnabled: boolean
  lockAvailable: boolean
  completedRuns: number
  totalInsertedRows: number
  pendingRows: number
  providerBudgetRemaining: number
  currentEvents: number
  priceCandidates: number
  modelMatches: number
  eligibleCandidates: number
  alreadyPersisted?: boolean
  providerFailure?: boolean
  persistenceFailure?: boolean
}

export type NbaShadowSchedulerPrecheckFixtureInput = {
  schedulerEnabled: boolean
  activeLock: boolean
  completedRuns: number
  totalInsertedRows: number
  pendingRows: number
  currentEraRows?: number
  providerBudgetAllowed?: boolean
}

export type NbaShadowSchedulerBatchPersistenceFixtureInput = {
  selectedCandidateKeys: string[]
  outcomes: Array<'CREATED' | 'ALREADY_EXISTS' | 'WRITE_CARDINALITY_NOT_ONE' | 'STALE_ODDS'>
  completedRuns: number
  totalInsertedRows: number
}

export function simulateNbaShadowSchedulerBatchPersistence(input: NbaShadowSchedulerBatchPersistenceFixtureInput) {
  const selectedCandidateKeys = input.selectedCandidateKeys.slice(0, NBA_SHADOW_SCHEDULER_PER_RUN_CAP)
  const persistenceResults: NbaShadowSchedulerCandidatePersistenceResult[] = []
  for (const [index, candidateKey] of selectedCandidateKeys.entries()) {
    const status = input.outcomes[index] ?? 'WRITE_CARDINALITY_NOT_ONE'
    const result = {
      candidateKey,
      status,
      inserted: status === 'CREATED' ? 1 : 0,
      reused: status === 'ALREADY_EXISTS' ? 1 : 0,
      success: ['CREATED', 'ALREADY_EXISTS'].includes(status),
      classification: 'NBA_03A_BLOCK5_SINGLE_CANDIDATE_WRITER_CERTIFIED_READY_FOR_FIRST_SHADOW',
    } satisfies NbaShadowSchedulerCandidatePersistenceResult
    persistenceResults.push(result)
    if (!result.success) break
  }
  const failed = persistenceResults.find((item) => !item.success)
  const inserted = persistenceResults.reduce((sum, item) => sum + item.inserted, 0)
  const reused = persistenceResults.reduce((sum, item) => sum + item.reused, 0)
  const successfulRun = !failed && selectedCandidateKeys.length > 0
  return {
    selectedCount: selectedCandidateKeys.length,
    persistenceAttempts: persistenceResults.length,
    selectedCandidateKeys,
    persistenceResults,
    inserted,
    reused,
    failed: failed ?? null,
    successfulPriorWritesRemain: true,
    completedRunsAfter: successfulRun ? input.completedRuns + 1 : input.completedRuns,
    totalInsertedRowsAfter: successfulRun ? input.totalInsertedRows + inserted : input.totalInsertedRows + inserted,
    reviewRequiredAfter: successfulRun ? input.completedRuns + 1 >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS : false,
    classification: failed
      ? 'PERSISTENCE_FAILURE_BLOCKED'
      : selectedCandidateKeys.length === 0
        ? 'NO_ELIGIBLE_CANDIDATE_NO_OP'
        : 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS',
  }
}

export function simulateNbaShadowSchedulerPrecheck(input: NbaShadowSchedulerPrecheckFixtureInput) {
  const state = {
    completedRuns: Math.max(0, input.completedRuns),
    totalInsertedRows: Math.max(0, input.totalInsertedRows),
    lastRunId: null,
  }
  const counts = {
    currentEraRows: Math.max(0, input.currentEraRows ?? input.pendingRows),
    pendingRows: Math.max(0, input.pendingRows),
  }
  const finalClassification = classifyPrecheck({
    enabled: input.schedulerEnabled,
    state,
    counts,
    activeLock: input.activeLock,
    providerBudgetAllowed: input.providerBudgetAllowed,
  })
  return {
    schedulerEnabled: input.schedulerEnabled,
    completedCanaryRuns: state.completedRuns,
    canaryInsertedRows: state.totalInsertedRows,
    reviewRequired: state.completedRuns >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS,
    hardLimitReached:
      state.completedRuns >= NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS ||
      state.totalInsertedRows >= NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP,
    pendingCurrentEraShadowRows: counts.pendingRows,
    pendingGuardReached: counts.pendingRows >= NBA_SHADOW_SCHEDULER_PENDING_GUARD,
    activeSchedulerLock: input.activeLock,
    providerCalls: 0,
    currentDataSyncInvocations: 0,
    predictionWrites: 0,
    runCounterMutations: 0,
    auditJobWrites: 0,
    schedulerLockAcquisitions: 0,
    providerBudgetAllowed: input.providerBudgetAllowed ?? null,
    finalClassification,
  }
}

export function simulateNbaShadowSchedulerHarness(input: NbaShadowSchedulerFixtureInput) {
  const base = {
    providerCalls: 0,
    writes: 0,
    selected: 0,
    lockReleased: input.lockAvailable,
    currentEraDelta: 0,
    isolation: isolationZero,
  }
  if (input.authorized === false) return { ...base, classification: 'UNAUTHORIZED_REJECTED', httpStatus: 401 }
  if (!input.schedulerEnabled) return { ...base, classification: 'SCHEDULER_DISABLED_NO_OP' }
  if (!input.lockAvailable) return { ...base, classification: 'LOCK_CONFLICT_NO_OP', lockReleased: false }
  if (input.completedRuns >= NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS || input.totalInsertedRows >= NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP) {
    return { ...base, classification: 'CANARY_HARD_LIMIT_REACHED_NO_OP' }
  }
  if (input.completedRuns >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS) return { ...base, classification: 'CANARY_REVIEW_REQUIRED_NO_OP' }
  if (input.pendingRows >= NBA_SHADOW_SCHEDULER_PENDING_GUARD) return { ...base, classification: 'PENDING_GUARD_NO_OP' }
  if (input.providerBudgetRemaining < NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN) return { ...base, classification: 'PROVIDER_BUDGET_NO_OP' }
  if (input.currentEvents <= 0) return { ...base, classification: 'NO_CURRENT_EVENT_NO_OP' }
  if (input.providerFailure) {
    return { ...base, providerCalls: 1, classification: 'PROVIDER_FAILURE_BLOCKED' }
  }
  if (input.eligibleCandidates <= 0 || input.modelMatches <= 0 || input.alreadyPersisted) {
    return { ...base, providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN, classification: 'NO_ELIGIBLE_CANDIDATE_NO_OP' }
  }
  const selected = Math.min(
    input.eligibleCandidates,
    NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
    Math.max(0, NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP - input.totalInsertedRows)
  )
  if (input.persistenceFailure) {
    return {
      ...base,
      providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
      selected,
      classification: 'PERSISTENCE_FAILURE_BLOCKED',
    }
  }
  return {
    ...base,
    providerCalls: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
    selected,
    writes: selected,
    currentEraDelta: selected,
    completedRunsAfter: input.completedRuns + 1,
    totalInsertedRowsAfter: input.totalInsertedRows + selected,
    reviewRequiredAfter: input.completedRuns + 1 >= NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS,
    classification: 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_SUCCESS',
  }
}

export function runNbaShadowSchedulerHarnessFixtures() {
  const cases: Record<string, NbaShadowSchedulerFixtureInput> = {
    unauthorized: { authorized: false, schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    disabled: { schedulerEnabled: false, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    enabled: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    lockConflict: { schedulerEnabled: true, lockAvailable: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    pendingGuard: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 75, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    budgetExceeded: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 1, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 10 },
    noEvents: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 0, priceCandidates: 0, modelMatches: 0, eligibleCandidates: 0 },
    noEligible: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 0, eligibleCandidates: 0 },
    validOverCap: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 20 },
    repeatedEvidence: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 0, alreadyPersisted: true },
    runOne: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3 },
    runTwo: { schedulerEnabled: true, lockAvailable: true, completedRuns: 1, totalInsertedRows: 3, pendingRows: 34, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3 },
    afterRunTwo: { schedulerEnabled: true, lockAvailable: true, completedRuns: 2, totalInsertedRows: 6, pendingRows: 37, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3 },
    hardLimitRuns: { schedulerEnabled: true, lockAvailable: true, completedRuns: 4, totalInsertedRows: 9, pendingRows: 40, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3 },
    hardLimitRows: { schedulerEnabled: true, lockAvailable: true, completedRuns: 1, totalInsertedRows: 12, pendingRows: 43, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3 },
    providerFailure: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3, providerFailure: true },
    persistenceFailure: { schedulerEnabled: true, lockAvailable: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, modelMatches: 50, eligibleCandidates: 3, persistenceFailure: true },
  }
  const results = Object.fromEntries(Object.entries(cases).map(([name, input]) => [name, simulateNbaShadowSchedulerHarness(input)]))
  return {
    schedulerVersion: NBA_SHADOW_SCHEDULER_VERSION,
    route: NBA_SHADOW_SCHEDULER_ROUTE,
    enabledEnv: NBA_SHADOW_SCHEDULER_ENABLED_ENV,
    perRunCap: NBA_SHADOW_SCHEDULER_PER_RUN_CAP,
    reviewAfterRuns: NBA_SHADOW_SCHEDULER_REVIEW_AFTER_RUNS,
    hardMaxRuns: NBA_SHADOW_SCHEDULER_HARD_MAX_RUNS,
    totalRowCap: NBA_SHADOW_SCHEDULER_TOTAL_ROW_CAP,
    pendingGuard: NBA_SHADOW_SCHEDULER_PENDING_GUARD,
    providerCallsPerRun: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_RUN,
    providerCallsPerHour: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_HOUR,
    providerCallsPerDay: NBA_SHADOW_SCHEDULER_PROVIDER_CALLS_PER_DAY,
    results,
    productionProviderCalls: 0,
    productionDatabaseMutations: 0,
  }
}

export function runNbaShadowSchedulerPrecheckFixtures() {
  const cases: Record<string, NbaShadowSchedulerPrecheckFixtureInput> = {
    disabled: { schedulerEnabled: false, activeLock: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31 },
    ready: { schedulerEnabled: true, activeLock: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31 },
    reviewRequired: { schedulerEnabled: true, activeLock: false, completedRuns: 2, totalInsertedRows: 6, pendingRows: 37 },
    hardLimitRuns: { schedulerEnabled: true, activeLock: false, completedRuns: 4, totalInsertedRows: 9, pendingRows: 40 },
    hardLimitRows: { schedulerEnabled: true, activeLock: false, completedRuns: 1, totalInsertedRows: 12, pendingRows: 43 },
    pendingGuard: { schedulerEnabled: true, activeLock: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 75 },
    lockActive: { schedulerEnabled: true, activeLock: true, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31 },
    repeated: { schedulerEnabled: true, activeLock: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31 },
    budgetBlocked: { schedulerEnabled: true, activeLock: false, completedRuns: 0, totalInsertedRows: 0, pendingRows: 31, providerBudgetAllowed: false },
  }
  const results = Object.fromEntries(Object.entries(cases).map(([name, input]) => [name, simulateNbaShadowSchedulerPrecheck(input)]))
  const budgetSnapshots = {
    knownBalanceSufficient: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: true,
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'CONFIGURED_ONLY', usableRemaining: 20, reasonCodes: ['CONFIGURED_ONLY_LIMIT'] },
      },
      authorization: { result: 'ALLOW', reasonCodes: ['THE_ODDS_API_AUTHORIZATION_POOL'] },
    }),
    knownBalanceInsufficient: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_RESERVE_PROTECTED',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'CONFIGURED_ONLY', usableRemaining: 0, reasonCodes: ['PROTECTED_RESERVE_APPLIED'] },
      },
      authorization: { result: 'DENY_RESERVE_PROTECTED', reasonCodes: ['NO_USABLE_REMAINING_AFTER_RESERVE'] },
    }),
    unknownBalanceNoScopedAuthorizationOtherSport: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: 'americanfootball_nfl',
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
    unknownBalanceValidCanary: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
    requestedCallsThree: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 3,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
    hourlyCapExceeded: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 3,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
    dailyCapExceeded: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: NBA_SHADOW_SCHEDULER_PROVIDER,
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 47,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
    sportsDataIoNotAuthorized: authorizeNbaShadowSchedulerProviderBudgetSnapshot({
      requestedCalls: 2,
      budgetAllowed: false,
      blockedReason: 'DENY_UNKNOWN_BUDGET',
      status: {
        providerId: 'sportsdataio',
        sportKey: NBA_SHADOW_SCHEDULER_SPORT_KEY,
        callsMadeLastHour: 0,
        callsMadeToday: 0,
        configurationStatus: 'VALID',
        accountingUncertain: false,
        canonicalBudget: { evidenceLevel: 'UNKNOWN', usableRemaining: null, reasonCodes: ['UNKNOWN_CURRENT_BALANCE'] },
      },
      authorization: { result: 'DENY_UNKNOWN_BUDGET', reasonCodes: ['UNKNOWN_BUDGET_FAILS_CLOSED'] },
    }),
  }
  return {
    route: NBA_SHADOW_SCHEDULER_ROUTE,
    enabledEnv: NBA_SHADOW_SCHEDULER_ENABLED_ENV,
    results,
    budgetSnapshots,
    productionProviderCalls: 0,
    productionDatabaseMutations: 0,
  }
}
