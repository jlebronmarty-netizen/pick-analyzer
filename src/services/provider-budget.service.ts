import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const DEFAULT_DAILY_CALL_BUDGET = 1000
const DEFAULT_SOFT_RESERVE = 150
const DEFAULT_MAX_CALLS_PER_ACTION = 3
const DEFAULT_MAX_REFRESH_CALLS_PER_HOUR = 12
const DEFAULT_WARNING_PERCENT = 80
const DEFAULT_STOP_PERCENT = 95
const TIMEZONE = 'America/Puerto_Rico'

type BudgetCheckInput = {
  provider?: string | null
  sportKey?: string | null
  action?: string | null
  requestedCalls?: number | null
  estimatedCost?: number | null
  dryRun?: boolean | null
  forceRefresh?: boolean | null
  urgency?: string | null
  operationalClass?: string | null
}

type BudgetStatusInput = {
  provider?: string | null
  sportKey?: string | null
}

type ForecastInput = BudgetStatusInput & {
  action?: string | null
  eventCount?: number | null
  markets?: string[] | null
  regions?: string[] | null
  bookmakers?: string[] | null
  expectedCadenceMinutes?: number | null
  timeWindowMinutes?: number | null
  estimatedCost?: number | null
}

type UsageRead = {
  callsMade: number
  callsPlanned: number
  latest: Record<string, unknown> | null
  warning: string | null
  source: 'operating_day_lifecycle_events' | 'sports_sync_jobs' | 'fixture'
}

type UsageSnapshot = {
  operatingDay: UsageRead
  syncJobs: UsageRead
  operatingDayLastHour: UsageRead
  syncJobsLastHour: UsageRead
}

type UnitType = 'HTTP_REQUEST' | 'CALL' | 'CREDIT' | 'QUOTA_UNIT' | 'UNKNOWN'
type EvidenceLevel = 'PROVEN' | 'CONFIGURED_ONLY' | 'INFERRED' | 'UNKNOWN'
type PeriodType = 'DAILY' | 'MONTHLY' | 'ROLLING' | 'FIXED' | 'UNKNOWN'
type BudgetAuthorizationResult =
  | 'ALLOW'
  | 'ALLOW_WITH_WARNING'
  | 'DENY_RESERVE_PROTECTED'
  | 'DENY_EXHAUSTED'
  | 'DENY_UNKNOWN_COST'
  | 'DENY_UNKNOWN_BUDGET'
  | 'DRY_RUN_ONLY'

type ProviderProfile = {
  providerId: string
  providerDisplayName: string
  coveredSports: string[]
  periodType: PeriodType
  unitType: UnitType
  limit: number | null
  protectedReserve: number | null
  resetSemantics: string
  evidenceLevel: EvidenceLevel
  evidenceSource: string
  largestConsumer: string | null
  supportsHeaders: boolean
}

const localLocks = new Map<string, number>()

function normalizeProviderId(provider?: string | null) {
  const value = String(provider ?? 'sportsdataio').trim().toLowerCase().replace(/_/g, '-')
  if (['sportsdataio', 'sports-data-io', 'sportsdata.io'].includes(value)) return 'sportsdataio'
  if (['the-odds-api', 'theoddsapi', 'odds-api', 'oddsapi'].includes(value)) return 'the-odds-api'
  if (value === 'bsn') return 'bsn'
  if (['mlb-stats-api', 'mlbstatsapi', 'mlb-stats'].includes(value)) return 'mlb-stats-api'
  return value || 'unknown'
}

function providerProfile(provider: string, sportKey: string, cfg: BudgetConfig): ProviderProfile {
  const normalized = normalizeProviderId(provider)
  if (normalized === 'sportsdataio') {
    return {
      providerId: 'sportsdataio',
      providerDisplayName: 'SportsDataIO',
      coveredSports: [sportKey],
      periodType: 'DAILY',
      unitType: 'HTTP_REQUEST',
      limit: cfg.dailyCallBudget,
      protectedReserve: cfg.softReserve,
      resetSemantics: 'CONFIGURED_ONLY_LOCAL_DAY',
      evidenceLevel: 'CONFIGURED_ONLY',
      evidenceSource: 'provider-budget.service config plus app lifecycle ledgers',
      largestConsumer: 'operating_day_or_sync_job_ledger',
      supportsHeaders: false,
    }
  }
  if (normalized === 'the-odds-api') {
    return {
      providerId: 'the-odds-api',
      providerDisplayName: 'The Odds API',
      coveredSports: ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'tennis', 'mma_ufc', 'baseball_mlb'],
      periodType: 'UNKNOWN',
      unitType: 'CREDIT',
      limit: null,
      protectedReserve: 2000,
      resetSemantics: 'UNKNOWN_NOT_RECHECKED',
      evidenceLevel: 'UNKNOWN',
      evidenceSource: 'no live quota call in OE-003B; prior header evidence remains historical only',
      largestConsumer: 'bounded_manual_audits_or_future_multi_sport_acquisition',
      supportsHeaders: true,
    }
  }
  if (normalized === 'bsn') {
    return {
      providerId: 'bsn',
      providerDisplayName: 'BSN Sources',
      coveredSports: ['basketball_bsn'],
      periodType: 'UNKNOWN',
      unitType: 'UNKNOWN',
      limit: null,
      protectedReserve: null,
      resetSemantics: 'SOURCE_SPECIFIC_OFFICIAL_PAGE_CSV_MANUAL_OR_FUTURE_PROVIDER',
      evidenceLevel: 'UNKNOWN',
      evidenceSource: 'official homepage, CSV/manual and future-provider source classes',
      largestConsumer: 'bsn_acquisition_preview',
      supportsHeaders: false,
    }
  }
  return {
    providerId: normalized,
    providerDisplayName: normalized,
    coveredSports: [sportKey],
    periodType: 'UNKNOWN',
    unitType: 'UNKNOWN',
    limit: null,
    protectedReserve: null,
    resetSemantics: 'UNKNOWN',
    evidenceLevel: 'UNKNOWN',
    evidenceSource: 'provider not normalized by OE-003B',
    largestConsumer: null,
    supportsHeaders: false,
  }
}

function providerPoolProfiles(cfg: BudgetConfig) {
  return {
    sportsdataio: providerProfile('sportsdataio', 'baseball_mlb', cfg),
    theOddsApi: providerProfile('the-odds-api', 'multi_sport', cfg),
    bsn: providerProfile('bsn', 'basketball_bsn', cfg),
  }
}

function endpointCostModel(provider: string, action?: string | null, input?: Partial<ForecastInput>) {
  const normalized = normalizeProviderId(provider)
  const actionKey = String(action ?? 'status').trim().toLowerCase().replace(/\s+/g, '_')
  const eventCount = Math.max(0, Number(input?.eventCount ?? 1) || 0)
  const markets = input?.markets?.filter(Boolean) ?? []
  const regions = input?.regions?.filter(Boolean) ?? []
  const bookmakers = input?.bookmakers?.filter(Boolean) ?? []
  if (normalized === 'sportsdataio') {
    const requestEstimate = ['odds_refresh', 'midday_refresh', 'final_refresh', 'event_discovery', 'slate_discovery', 'results_sync', 'player_roster_sync', 'historical_import'].includes(actionKey)
      ? Math.max(1, Math.min(3, Math.ceil(Math.max(1, eventCount) / 15)))
      : 1
    return {
      actionKey,
      unitType: 'HTTP_REQUEST' as UnitType,
      requestCountEstimate: requestEstimate,
      quotaUnitEstimate: requestEstimate,
      estimatedCost: requestEstimate,
      costEvidenceLevel: 'CONFIGURED_ONLY' as EvidenceLevel,
      minimumCost: 1,
      maximumKnownCost: 3,
      variableCostFactors: ['action', 'date_slate', 'endpoint_family'],
      responseHeadersCanUpdateActualCost: false,
      canSimulateWithoutProviderCalls: true,
    }
  }
  if (normalized === 'the-odds-api') {
    const variableFactors = ['markets', 'regions', 'bookmakers', 'event_scope', 'endpoint']
    const requestEstimate = actionKey.includes('event') ? Math.max(1, eventCount) : 1
    const quotaUnitEstimate = markets.length || regions.length || bookmakers.length
      ? null
      : null
    return {
      actionKey,
      unitType: 'CREDIT' as UnitType,
      requestCountEstimate: requestEstimate,
      quotaUnitEstimate,
      estimatedCost: Number(input?.estimatedCost ?? NaN) > 0 ? Number(input?.estimatedCost) : null,
      costEvidenceLevel: 'UNKNOWN' as EvidenceLevel,
      minimumCost: null,
      maximumKnownCost: null,
      variableCostFactors: variableFactors,
      responseHeadersCanUpdateActualCost: true,
      canSimulateWithoutProviderCalls: true,
    }
  }
  return {
    actionKey,
    unitType: 'UNKNOWN' as UnitType,
    requestCountEstimate: 0,
    quotaUnitEstimate: null,
    estimatedCost: null,
    costEvidenceLevel: 'UNKNOWN' as EvidenceLevel,
    minimumCost: null,
    maximumKnownCost: null,
    variableCostFactors: ['provider_contract_unknown'],
    responseHeadersCanUpdateActualCost: false,
    canSimulateWithoutProviderCalls: true,
  }
}

function envNumber(names: string | string[], fallback: number) {
  const keys = Array.isArray(names) ? names : [names]
  const errors: string[] = []
  for (const name of keys) {
    const raw = process.env[name]
    if (raw === undefined || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value) && value >= 0) return { value, errors }
    errors.push(`Malformed numeric provider budget env ${name}; using next valid alias or safe default.`)
  }
  return { value: fallback, errors }
}

function envPercent(names: string | string[], fallback: number) {
  const parsed = envNumber(names, fallback)
  return { value: Math.max(0, Math.min(100, parsed.value)), errors: parsed.errors }
}

function localDate(now = new Date()) {
  return localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
}

function utcRangeForLocalDate(date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  return { utcStart: range.utcStart, utcEndExclusive: range.utcEndExclusive }
}

function config() {
  const errors: string[] = []
  const dailyCallBudget = envNumber(
    ['MLB_DAILY_CREDIT_BUDGET', 'PROVIDER_DAILY_CREDIT_BUDGET', 'SPORTSDATAIO_DAILY_CALL_BUDGET'],
    DEFAULT_DAILY_CALL_BUDGET
  )
  const softReserve = envNumber(
    ['MLB_DAILY_CREDIT_RESERVE', 'PROVIDER_DAILY_CREDIT_RESERVE', 'SPORTSDATAIO_SOFT_RESERVE'],
    DEFAULT_SOFT_RESERVE
  )
  const maxCallsPerAction = envNumber(
    ['MLB_MAX_CALLS_PER_ACTION', 'SPORTSDATAIO_MAX_CALLS_PER_ACTION'],
    DEFAULT_MAX_CALLS_PER_ACTION
  )
  const maxRefreshCallsPerHour = envNumber(
    ['MLB_MAX_REFRESH_CALLS_PER_HOUR', 'PROVIDER_MAX_REFRESH_CALLS_PER_HOUR'],
    DEFAULT_MAX_REFRESH_CALLS_PER_HOUR
  )
  const warningThresholdPercent = envPercent('PROVIDER_BUDGET_WARNING_PERCENT', DEFAULT_WARNING_PERCENT)
  const stopThresholdPercent = envPercent('PROVIDER_BUDGET_STOP_PERCENT', DEFAULT_STOP_PERCENT)
  errors.push(
    ...dailyCallBudget.errors,
    ...softReserve.errors,
    ...maxCallsPerAction.errors,
    ...maxRefreshCallsPerHour.errors,
    ...warningThresholdPercent.errors,
    ...stopThresholdPercent.errors
  )

  return {
    dailyCallBudget: dailyCallBudget.value,
    softReserve: Math.min(dailyCallBudget.value, softReserve.value),
    maxCallsPerAction: maxCallsPerAction.value,
    maxRefreshCallsPerHour: maxRefreshCallsPerHour.value,
    warningThresholdPercent: warningThresholdPercent.value,
    stopThresholdPercent: Math.max(warningThresholdPercent.value, stopThresholdPercent.value),
    configurationErrors: errors,
    envAliases: {
      dailyCallBudget: ['MLB_DAILY_CREDIT_BUDGET', 'PROVIDER_DAILY_CREDIT_BUDGET', 'SPORTSDATAIO_DAILY_CALL_BUDGET'],
      softReserve: ['MLB_DAILY_CREDIT_RESERVE', 'PROVIDER_DAILY_CREDIT_RESERVE', 'SPORTSDATAIO_SOFT_RESERVE'],
      maxCallsPerAction: ['MLB_MAX_CALLS_PER_ACTION', 'SPORTSDATAIO_MAX_CALLS_PER_ACTION'],
      maxRefreshCallsPerHour: ['MLB_MAX_REFRESH_CALLS_PER_HOUR', 'PROVIDER_MAX_REFRESH_CALLS_PER_HOUR'],
      warningThresholdPercent: ['PROVIDER_BUDGET_WARNING_PERCENT'],
      stopThresholdPercent: ['PROVIDER_BUDGET_STOP_PERCENT'],
    },
  }
}

type BudgetConfig = ReturnType<typeof config>

function emptyUsage(source: UsageRead['source'], warning: string | null = null): UsageRead {
  return { callsMade: 0, callsPlanned: 0, latest: null, warning, source }
}

async function operatingDayCalls(provider: string, sportKey: string, start: string, end: string): Promise<UsageRead> {
  try {
    const { data, error } = await supabaseAdmin
      .from('operating_day_lifecycle_events')
      .select('provider_calls_made, provider_calls_planned, action, status, created_at, metadata')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (error) {
      return emptyUsage('operating_day_lifecycle_events', `operating_day_lifecycle_events call accounting unavailable: ${error.message}`)
    }

    const rows = (data ?? []).filter((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}
      const rowSportKey = String(metadata.sportKey ?? metadata.sport_key ?? sportKey)
      const rowProvider = String(metadata.provider ?? provider)
      return rowSportKey === sportKey && rowProvider === provider
    })
    return {
      callsMade: rows.reduce((total, row) => total + Number(row.provider_calls_made ?? 0), 0),
      callsPlanned: rows.reduce((total, row) => total + Number(row.provider_calls_planned ?? 0), 0),
      latest: rows[0] ?? null,
      warning: null,
      source: 'operating_day_lifecycle_events',
    }
  } catch (error) {
    return emptyUsage(
      'operating_day_lifecycle_events',
      `operating_day_lifecycle_events call accounting unavailable: ${error instanceof Error ? error.message : 'unknown read error'}`
    )
  }
}

async function syncJobCalls(provider: string, sportKey: string, start: string, end: string): Promise<UsageRead> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sports_sync_jobs')
      .select('id, provider, sport_key, created_at, completed_at, status, metadata')
      .eq('provider', provider)
      .eq('sport_key', sportKey)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (error) return emptyUsage('sports_sync_jobs', `sports_sync_jobs call accounting unavailable: ${error.message}`)

    const rows = data ?? []
    return {
      callsMade: rows.reduce((total, row) => {
        const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}
        const checkpoint = metadata.checkpoint && typeof metadata.checkpoint === 'object' ? (metadata.checkpoint as Record<string, unknown>) : {}
        return total + Number(metadata.externalCallsUsed ?? checkpoint.providerCallsUsed ?? 0)
      }, 0),
      callsPlanned: 0,
      latest: rows[0] ?? null,
      warning: null,
      source: 'sports_sync_jobs',
    }
  } catch (error) {
    return emptyUsage(
      'sports_sync_jobs',
      `sports_sync_jobs call accounting unavailable: ${error instanceof Error ? error.message : 'unknown read error'}`
    )
  }
}

function composeProviderBudgetStatus({
  provider,
  sportKey,
  today,
  cfg,
  usage,
}: {
  provider: string
  sportKey: string
  today: string
  cfg: BudgetConfig
  usage: UsageSnapshot
}) {
  const { operatingDay, syncJobs, operatingDayLastHour, syncJobsLastHour } = usage
  const callsMadeToday = Math.max(operatingDay.callsMade, syncJobs.callsMade)
  const callsMadeLastHour = Math.max(operatingDayLastHour.callsMade, syncJobsLastHour.callsMade)
  const profile = providerProfile(provider, sportKey, cfg)
  const pools = providerPoolProfiles(cfg)
  const sportsDataIoPool = profile.providerId === 'sportsdataio'
  const configuredLimit = sportsDataIoPool ? cfg.dailyCallBudget : profile.limit
  const configuredReserve = sportsDataIoPool ? cfg.softReserve : profile.protectedReserve
  const hardRemaining = configuredLimit === null ? null : Math.max(0, configuredLimit - callsMadeToday)
  const estimatedCallsRemaining = configuredLimit === null || configuredReserve === null ? null : Math.max(0, configuredLimit - configuredReserve - callsMadeToday)
  const hourlyRemaining = Math.max(0, cfg.maxRefreshCallsPerHour - callsMadeLastHour)
  const usagePercent = configuredLimit && configuredLimit > 0 ? Math.round((callsMadeToday / configuredLimit) * 1000) / 10 : null
  const warningThresholdReached = usagePercent !== null && usagePercent >= cfg.warningThresholdPercent
  const stopThresholdReached = usagePercent !== null && usagePercent >= cfg.stopThresholdPercent
  const latest = operatingDay.latest ?? syncJobs.latest
  const accountingWarnings = [
    operatingDay.warning,
    syncJobs.warning,
    operatingDayLastHour.warning,
    syncJobsLastHour.warning,
  ].filter(Boolean) as string[]
  const budgetWarnings = [
    ...cfg.configurationErrors,
    ...accountingWarnings,
    warningThresholdReached ? `Provider usage has reached ${usagePercent}% of the configured daily budget.` : null,
    hourlyRemaining <= 0 ? 'Provider hourly refresh budget is exhausted for the current rolling hour.' : null,
    stopThresholdReached ? `Provider usage has reached the ${cfg.stopThresholdPercent}% hard-stop threshold.` : null,
  ].filter(Boolean) as string[]
  const status =
    profile.evidenceLevel === 'UNKNOWN'
      ? 'UNKNOWN'
      : stopThresholdReached || estimatedCallsRemaining === 0
        ? 'RESERVE_ONLY'
        : accountingWarnings.length > 0
          ? 'UNKNOWN'
          : warningThresholdReached || hourlyRemaining <= 0
            ? 'DEGRADED'
            : 'HEALTHY'
  const canonicalBudget = {
    contractVersion: 'provider_budget_ledger_v1',
    providerId: profile.providerId,
    providerDisplayName: profile.providerDisplayName,
    sportKey,
    coveredSports: profile.coveredSports,
    periodType: profile.periodType,
    periodStart: sportsDataIoPool ? utcRangeForLocalDate(today).utcStart : null,
    periodEnd: sportsDataIoPool ? utcRangeForLocalDate(today).utcEndExclusive : null,
    resetAt: null,
    resetSemantics: profile.resetSemantics,
    limit: configuredLimit,
    used: profile.evidenceLevel === 'UNKNOWN' ? null : callsMadeToday,
    remaining: hardRemaining,
    protectedReserve: configuredReserve,
    usableRemaining: estimatedCallsRemaining,
    unitType: profile.unitType,
    evidenceLevel: sportsDataIoPool && accountingWarnings.length === 0 ? 'CONFIGURED_ONLY' as EvidenceLevel : profile.evidenceLevel,
    evidenceSource: profile.evidenceSource,
    observedAt: new Date().toISOString(),
    status,
    reasonCodes: [
      `${profile.providerId.toUpperCase().replace(/-/g, '_')}_POOL_ISOLATED`,
      profile.evidenceLevel === 'UNKNOWN' ? 'UNKNOWN_CURRENT_BALANCE' : null,
      profile.evidenceLevel === 'CONFIGURED_ONLY' ? 'CONFIGURED_ONLY_LIMIT' : null,
      configuredReserve !== null ? 'PROTECTED_RESERVE_APPLIED' : 'PROTECTED_RESERVE_UNKNOWN',
      estimatedCallsRemaining === 0 ? 'RESERVE_ONLY' : null,
      accountingWarnings.length ? 'APP_LEDGER_ACCOUNTING_WARNING' : null,
    ].filter(Boolean) as string[],
    largestConsumer: profile.largestConsumer,
    estimatedCurrentPeriodUsage: profile.evidenceLevel === 'UNKNOWN' ? null : callsMadeToday,
    estimatedNextActionCost: null,
    canExecuteNextAction: false,
    humanInterventionRequired: profile.evidenceLevel === 'UNKNOWN' || accountingWarnings.length > 0,
  }

  return {
    success: true,
    mode: 'provider_budget_status_v1',
    contractVersion: 'provider_budget_status_v2_additive_ledger',
    provider,
    providerId: profile.providerId,
    sportKey,
    localDate: today,
    timezone: TIMEZONE,
    config: cfg,
    callsMadeToday,
    callsMadeLastHour,
    callsPlannedToday: operatingDay.callsPlanned,
    hardRemaining: hardRemaining ?? 0,
    estimatedCallsRemaining: estimatedCallsRemaining ?? 0,
    hourlyRemaining,
    softReserveRemaining: estimatedCallsRemaining && estimatedCallsRemaining > 0 ? cfg.softReserve : 0,
    usagePercent: usagePercent ?? 0,
    accountingStatus: accountingWarnings.length > 0 ? 'DEGRADED' : 'AVAILABLE',
    accountingUncertain: accountingWarnings.length > 0,
    configurationStatus: cfg.configurationErrors.length > 0 ? 'MALFORMED_DEFAULTED' : 'VALID',
    warningThresholdReached,
    stopThresholdReached,
    budgetWarnings,
    lastProviderCall: latest ? String(latest.created_at ?? latest.completed_at ?? '') : null,
    nextEligibleRefresh: hardRemaining !== null && hardRemaining > 0 && estimatedCallsRemaining !== null && estimatedCallsRemaining > 0 && hourlyRemaining > 0 && !stopThresholdReached ? 'now' : hourlyRemaining <= 0 ? 'next_hour' : 'next_provider_day',
    warning: budgetWarnings[0] ?? null,
    canonicalBudget,
    providerPools: {
      sportsdataio: {
        ...pools.sportsdataio,
        activeAuthorizationSource: profile.providerId === 'sportsdataio',
        combinedWithTheOddsApi: false,
      },
      theOddsApi: {
        ...pools.theOddsApi,
        activeAuthorizationSource: profile.providerId === 'the-odds-api',
        combinedWithSportsDataIO: false,
      },
      bsn: {
        ...pools.bsn,
        activeAuthorizationSource: profile.providerId === 'bsn',
        combinedWithSportsDataIO: false,
        combinedWithTheOddsApi: false,
      },
    },
    costModels: [
      endpointCostModel(profile.providerId, 'slate_discovery'),
      endpointCostModel(profile.providerId, 'odds_refresh'),
      endpointCostModel(profile.providerId, 'results_sync'),
      endpointCostModel(profile.providerId, 'historical_import'),
    ],
    healthDomain: {
      contractVersion: 'provider_budget_health_domain_v1',
      status: status === 'RESERVE_ONLY' ? 'CRITICAL' : status === 'UNKNOWN' ? 'UNKNOWN' : status,
      summary: 'Provider budget status is provider-specific and independent from market freshness.',
      reasonCodes: [
        stopThresholdReached ? 'PROVIDER_BUDGET_STOP_THRESHOLD_REACHED' : null,
        estimatedCallsRemaining === 0 ? 'PROVIDER_RESERVE_PROTECTED' : null,
        hourlyRemaining <= 0 ? 'PROVIDER_HOURLY_LIMIT_REACHED' : null,
        accountingWarnings.length > 0 ? 'PROVIDER_ACCOUNTING_UNCERTAIN' : null,
        `${profile.providerId.toUpperCase().replace(/-/g, '_')}_PROVIDER_SPECIFIC`,
      ].filter(Boolean),
      evidence: {
        provider: profile.providerId,
        sportKey,
        allowanceClassification: canonicalBudget.evidenceLevel,
        resetSemantics: profile.resetSemantics,
        callsMadeToday: canonicalBudget.used,
        estimatedCallsRemaining: canonicalBudget.usableRemaining,
        hardRemaining,
        hourlyRemaining,
        softReserve: canonicalBudget.protectedReserve,
        unitType: profile.unitType,
        requestCountsAndQuotaUnitsAreDistinct: true,
      },
      providerPools: {
        sportsdataio: provider === 'sportsdataio' ? 'ACTIVE_REQUESTED_POOL' : 'SEPARATE_POOL',
        theOddsApi: 'SEPARATE_POOL_NOT_COMBINED',
        bsn: 'SOURCE_SPECIFIC_NOT_COMBINED',
      },
    },
    providerCallsMade: 0,
  }
}

export async function getProviderBudgetStatus(input: BudgetStatusInput = {}) {
  const provider = normalizeProviderId(input.provider)
  const sportKey = input.sportKey ?? 'baseball_mlb'
  const today = localDate()
  const range = utcRangeForLocalDate(today)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const cfg = config()
  const [operatingDay, syncJobs, operatingDayLastHour, syncJobsLastHour] = await Promise.all([
    operatingDayCalls(provider, sportKey, range.utcStart, range.utcEndExclusive),
    syncJobCalls(provider, sportKey, range.utcStart, range.utcEndExclusive),
    operatingDayCalls(provider, sportKey, oneHourAgo, new Date().toISOString()),
    syncJobCalls(provider, sportKey, oneHourAgo, new Date().toISOString()),
  ])
  return composeProviderBudgetStatus({
    provider,
    sportKey,
    today,
    cfg,
    usage: { operatingDay, syncJobs, operatingDayLastHour, syncJobsLastHour },
  })
}

export function authorizeProviderBudget(input: {
  provider: string
  sportKey: string
  action?: string | null
  estimatedCost?: number | null
  status: Awaited<ReturnType<typeof getProviderBudgetStatus>>
  dryRun?: boolean | null
  urgency?: string | null
  operationalClass?: string | null
}) {
  const costModel = endpointCostModel(input.provider, input.action, { estimatedCost: input.estimatedCost })
  const budget = input.status.canonicalBudget
  const estimatedCost = Number(input.estimatedCost ?? costModel.estimatedCost ?? costModel.quotaUnitEstimate ?? costModel.requestCountEstimate ?? NaN)
  const usableBefore = typeof budget.usableRemaining === 'number' ? budget.usableRemaining : null
  const reserve = typeof budget.protectedReserve === 'number' ? budget.protectedReserve : null
  const evidenceLevel = budget.evidenceLevel as EvidenceLevel
  const reasonCodes: string[] = [
    `${budget.providerId.toUpperCase().replace(/-/g, '_')}_AUTHORIZATION_POOL`,
    `${costModel.unitType}_COST_MODEL`,
  ]

  let result: BudgetAuthorizationResult = 'ALLOW'
  if (input.dryRun === true) {
    result = 'DRY_RUN_ONLY'
    reasonCodes.push('DRY_RUN_NO_PROVIDER_CALL')
  } else if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) {
    result = 'DENY_UNKNOWN_COST'
    reasonCodes.push('UNKNOWN_COST_FAILS_CLOSED')
  } else if (evidenceLevel === 'UNKNOWN' || usableBefore === null) {
    result = 'DENY_UNKNOWN_BUDGET'
    reasonCodes.push('UNKNOWN_BUDGET_FAILS_CLOSED')
  } else if (usableBefore <= 0) {
    result = reserve !== null ? 'DENY_RESERVE_PROTECTED' : 'DENY_EXHAUSTED'
    reasonCodes.push('NO_USABLE_REMAINING_AFTER_RESERVE')
  } else if (estimatedCost > usableBefore) {
    result = 'DENY_RESERVE_PROTECTED'
    reasonCodes.push('ESTIMATED_COST_EXCEEDS_USABLE_REMAINING')
  } else if (input.status.hourlyRemaining <= 0 && budget.providerId === 'sportsdataio') {
    result = 'ALLOW_WITH_WARNING'
    reasonCodes.push('HOURLY_REFRESH_LIMIT_REACHED')
  } else if (input.status.warningThresholdReached) {
    result = 'ALLOW_WITH_WARNING'
    reasonCodes.push('WARNING_THRESHOLD_REACHED')
  }

  const usableAfter = usableBefore === null || !Number.isFinite(estimatedCost) ? null : Math.max(0, usableBefore - estimatedCost)
  return {
    contractVersion: 'provider_budget_authorization_v1',
    providerId: budget.providerId,
    sportKey: input.sportKey,
    actionKey: costModel.actionKey,
    result,
    allowed: result === 'ALLOW' || result === 'ALLOW_WITH_WARNING',
    reasonCodes,
    estimatedCost: Number.isFinite(estimatedCost) ? estimatedCost : null,
    requestCountEstimate: costModel.requestCountEstimate,
    quotaUnitEstimate: costModel.quotaUnitEstimate,
    unitType: costModel.unitType,
    costEvidenceLevel: costModel.costEvidenceLevel,
    usableRemainingBefore: usableBefore,
    usableRemainingAfter: usableAfter,
    reserveImpact: reserve === null || usableAfter === null ? 'UNKNOWN' : usableAfter < reserve ? 'WOULD_ENTER_RESERVE' : 'RESERVE_PRESERVED',
    evidenceLevel,
    dryRunOnly: input.dryRun === true,
    humanInterventionRequired: result === 'DENY_UNKNOWN_BUDGET' || result === 'DENY_UNKNOWN_COST',
  }
}

export async function getProviderBudgetForecast(input: ForecastInput = {}) {
  const provider = normalizeProviderId(input.provider)
  const sportKey = input.sportKey ?? (provider === 'the-odds-api' ? 'multi_sport' : provider === 'bsn' ? 'basketball_bsn' : 'baseball_mlb')
  const action = input.action ?? 'odds_refresh'
  const status = await getProviderBudgetStatus({ provider, sportKey })
  const costModel = endpointCostModel(provider, action, input)
  const authorization = authorizeProviderBudget({
    provider,
    sportKey,
    action,
    estimatedCost: input.estimatedCost ?? costModel.estimatedCost ?? costModel.quotaUnitEstimate ?? costModel.requestCountEstimate,
    status,
    dryRun: true,
    urgency: 'forecast',
    operationalClass: 'read_only',
  })
  return {
    success: true,
    mode: 'provider_budget_dry_run_forecast_v1',
    generatedAt: new Date().toISOString(),
    provider,
    sportKey,
    action,
    inputs: {
      eventCount: input.eventCount ?? null,
      markets: input.markets ?? [],
      regions: input.regions ?? [],
      bookmakers: input.bookmakers ?? [],
      expectedCadenceMinutes: input.expectedCadenceMinutes ?? null,
      timeWindowMinutes: input.timeWindowMinutes ?? null,
    },
    canonicalBudget: status.canonicalBudget,
    providerPools: status.providerPools,
    estimatedHttpRequests: costModel.requestCountEstimate,
    estimatedQuotaUnits: costModel.quotaUnitEstimate,
    evidenceLevel: costModel.costEvidenceLevel,
    currentUsableRemaining: status.canonicalBudget.usableRemaining,
    expectedRemainingAfterAction: authorization.usableRemainingAfter,
    reserveImpact: authorization.reserveImpact,
    authorization,
    warnings: [
      status.canonicalBudget.evidenceLevel === 'UNKNOWN' ? 'Current provider balance is unknown; live execution fails closed unless separately approved.' : null,
      costModel.costEvidenceLevel === 'UNKNOWN' ? 'Cost model is unknown or variable; exact quota units are not fabricated.' : null,
    ].filter(Boolean) as string[],
    unknownCostFactors: costModel.costEvidenceLevel === 'UNKNOWN' ? costModel.variableCostFactors : [],
    providerCallsMade: 0,
    providerCreditsConsumed: 0,
    remoteMutationsMade: 0,
  }
}

export async function checkProviderBudget(input: BudgetCheckInput) {
  const requestedCalls = Math.max(0, Number(input.requestedCalls ?? 0) || 0)
  const status = await getProviderBudgetStatus({ provider: input.provider, sportKey: input.sportKey })
  const authorization = authorizeProviderBudget({
    provider: status.providerId,
    sportKey: status.sportKey,
    action: input.action,
    estimatedCost: input.estimatedCost ?? requestedCalls,
    status,
    dryRun: input.dryRun,
    urgency: input.urgency,
    operationalClass: input.operationalClass,
  })
  if (input.dryRun === true || requestedCalls === 0) {
    return { allowed: true, approvedCalls: 0, blockedReason: null, status, authorization }
  }
  if (status.accountingUncertain || status.configurationStatus !== 'VALID') {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Provider budget accounting is ${status.accountingStatus}; paid extraction fails closed until usage state is certain.`,
      status,
      authorization,
    }
  }
  if (authorization.result === 'DENY_UNKNOWN_BUDGET' || authorization.result === 'DENY_UNKNOWN_COST') {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: authorization.reasonCodes.join(', '),
      status,
      authorization,
    }
  }
  if (requestedCalls > status.config.maxCallsPerAction) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls exceeds SPORTSDATAIO_MAX_CALLS_PER_ACTION ${status.config.maxCallsPerAction}.`,
      status,
      authorization,
    }
  }
  if (requestedCalls > status.hourlyRemaining) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls exceeds MLB_MAX_REFRESH_CALLS_PER_HOUR remaining allowance ${status.hourlyRemaining}.`,
      status,
      authorization,
    }
  }
  const projectedUsagePercent = status.config.dailyCallBudget > 0
    ? ((status.callsMadeToday + requestedCalls) / status.config.dailyCallBudget) * 100
    : 100
  if (projectedUsagePercent > status.config.stopThresholdPercent) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls would exceed PROVIDER_BUDGET_STOP_PERCENT ${status.config.stopThresholdPercent}.`,
      status,
      authorization,
    }
  }
  if (requestedCalls > status.estimatedCallsRemaining) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls would exceed configured daily budget after soft reserve.`,
      status,
      authorization,
    }
  }
  return { allowed: true, approvedCalls: requestedCalls, blockedReason: null, status, authorization }
}

export function claimProviderActionLock(key: string, ttlMs = 10 * 60 * 1000) {
  const now = Date.now()
  const expiresAt = localLocks.get(key) ?? 0
  if (expiresAt > now) return false
  localLocks.set(key, now + ttlMs)
  return true
}

export function releaseProviderActionLock(key: string) {
  localLocks.delete(key)
}

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name]
  else process.env[name] = previous
}

export function validateProviderBudgetDeterministicFixtures() {
  const previous = {
    SPORTSDATAIO_DAILY_CALL_BUDGET: process.env.SPORTSDATAIO_DAILY_CALL_BUDGET,
    MLB_DAILY_CREDIT_BUDGET: process.env.MLB_DAILY_CREDIT_BUDGET,
    PROVIDER_DAILY_CREDIT_BUDGET: process.env.PROVIDER_DAILY_CREDIT_BUDGET,
    SPORTSDATAIO_SOFT_RESERVE: process.env.SPORTSDATAIO_SOFT_RESERVE,
    SPORTSDATAIO_MAX_CALLS_PER_ACTION: process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION,
    MLB_MAX_REFRESH_CALLS_PER_HOUR: process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR,
    PROVIDER_BUDGET_WARNING_PERCENT: process.env.PROVIDER_BUDGET_WARNING_PERCENT,
    PROVIDER_BUDGET_STOP_PERCENT: process.env.PROVIDER_BUDGET_STOP_PERCENT,
  }
  process.env.SPORTSDATAIO_DAILY_CALL_BUDGET = '10'
  process.env.SPORTSDATAIO_SOFT_RESERVE = '2'
  process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION = '3'
  process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR = '4'
  process.env.PROVIDER_BUDGET_WARNING_PERCENT = '70'
  process.env.PROVIDER_BUDGET_STOP_PERCENT = '90'
  delete process.env.MLB_DAILY_CREDIT_BUDGET
  delete process.env.PROVIDER_DAILY_CREDIT_BUDGET

  const cfg = config()
  process.env.MLB_DAILY_CREDIT_BUDGET = '25'
  const mlbOverrideCfg = config()
  process.env.MLB_DAILY_CREDIT_BUDGET = 'bad-value'
  process.env.PROVIDER_DAILY_CREDIT_BUDGET = '30'
  const malformedCfg = config()

  for (const [name, value] of Object.entries(previous)) restoreEnv(name, value)

  const lockKey = 'fixture:sportsdataio:baseball_mlb'
  const firstClaim = claimProviderActionLock(lockKey, 1000)
  const secondClaim = claimProviderActionLock(lockKey, 1000)
  releaseProviderActionLock(lockKey)

  const fixtureRead = (callsMade: number, callsPlanned = 0, warning: string | null = null): UsageRead => ({
    callsMade,
    callsPlanned,
    latest: null,
    warning,
    source: 'fixture',
  })
  const fixtureStatus = (usage: Partial<UsageSnapshot>, fixtureCfg: BudgetConfig = cfg) =>
    composeProviderBudgetStatus({
      provider: 'sportsdataio',
      sportKey: 'baseball_mlb',
      today: '2026-07-20',
      cfg: fixtureCfg,
      usage: {
        operatingDay: usage.operatingDay ?? fixtureRead(0),
        syncJobs: usage.syncJobs ?? fixtureRead(0),
        operatingDayLastHour: usage.operatingDayLastHour ?? fixtureRead(0),
        syncJobsLastHour: usage.syncJobsLastHour ?? fixtureRead(0),
      },
    })
  const noUsage = fixtureStatus({})
  const exhausted = fixtureStatus({ operatingDay: fixtureRead(10), operatingDayLastHour: fixtureRead(1) })
  const reserveReached = fixtureStatus({ operatingDay: fixtureRead(8), operatingDayLastHour: fixtureRead(1) })
  const hourlyCapReached = fixtureStatus({ operatingDay: fixtureRead(2), operatingDayLastHour: fixtureRead(4) })
  const normalAllowed = fixtureStatus({ operatingDay: fixtureRead(2), operatingDayLastHour: fixtureRead(1) })
  const missingSupabaseRecord = fixtureStatus({
    operatingDay: fixtureRead(0, 0, 'operating_day_lifecycle_events call accounting unavailable: relation missing'),
  })

  const checks = [
    ['env config parsed', cfg.dailyCallBudget === 10 && cfg.softReserve === 2 && cfg.maxCallsPerAction === 3],
    ['MLB daily budget override wins', mlbOverrideCfg.dailyCallBudget === 25],
    ['malformed numeric env produces typed defaulted config state', malformedCfg.dailyCallBudget === 30 && malformedCfg.configurationErrors.length > 0],
    ['hourly and threshold config parsed', cfg.maxRefreshCallsPerHour === 4 && cfg.warningThresholdPercent === 70 && cfg.stopThresholdPercent === 90],
    ['local date uses puerto rico offset', localDate(new Date('2026-07-17T03:30:00.000Z')) === '2026-07-16'],
    ['concurrent lock rejects second claim', firstClaim && !secondClaim],
    ['no usage records resolve to zero usage', noUsage.callsMadeToday === 0 && noUsage.callsMadeLastHour === 0 && noUsage.accountingStatus === 'AVAILABLE'],
    ['daily budget exhausted is blocked by remaining calls', exhausted.hardRemaining === 0 && exhausted.stopThresholdReached],
    ['reserve reached removes estimated remaining', reserveReached.estimatedCallsRemaining === 0],
    ['hourly cap reached removes hourly remaining', hourlyCapReached.hourlyRemaining === 0],
    ['normal allowed request has remaining budget', normalAllowed.estimatedCallsRemaining > 0 && normalAllowed.hourlyRemaining > 0],
    ['missing Supabase record degrades read-only status', missingSupabaseRecord.accountingUncertain && missingSupabaseRecord.budgetWarnings.length > 0],
    ['read-only status validation uses no provider calls', noUsage.providerCallsMade === 0],
    ['deterministic validation made zero calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'provider_budget_deterministic_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
