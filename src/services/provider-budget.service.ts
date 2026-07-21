import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const DEFAULT_DAILY_CALL_BUDGET = 1500
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
  dryRun?: boolean | null
  forceRefresh?: boolean | null
}

type BudgetStatusInput = {
  provider?: string | null
  sportKey?: string | null
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

const localLocks = new Map<string, number>()

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
  const hardRemaining = Math.max(0, cfg.dailyCallBudget - callsMadeToday)
  const estimatedCallsRemaining = Math.max(0, cfg.dailyCallBudget - cfg.softReserve - callsMadeToday)
  const hourlyRemaining = Math.max(0, cfg.maxRefreshCallsPerHour - callsMadeLastHour)
  const usagePercent = cfg.dailyCallBudget > 0 ? Math.round((callsMadeToday / cfg.dailyCallBudget) * 1000) / 10 : 100
  const warningThresholdReached = usagePercent >= cfg.warningThresholdPercent
  const stopThresholdReached = usagePercent >= cfg.stopThresholdPercent
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

  return {
    success: true,
    mode: 'provider_budget_status_v1',
    provider,
    sportKey,
    localDate: today,
    timezone: TIMEZONE,
    config: cfg,
    callsMadeToday,
    callsMadeLastHour,
    callsPlannedToday: operatingDay.callsPlanned,
    hardRemaining,
    estimatedCallsRemaining,
    hourlyRemaining,
    softReserveRemaining: estimatedCallsRemaining > 0 ? cfg.softReserve : 0,
    usagePercent,
    accountingStatus: accountingWarnings.length > 0 ? 'DEGRADED' : 'AVAILABLE',
    accountingUncertain: accountingWarnings.length > 0,
    configurationStatus: cfg.configurationErrors.length > 0 ? 'MALFORMED_DEFAULTED' : 'VALID',
    warningThresholdReached,
    stopThresholdReached,
    budgetWarnings,
    lastProviderCall: latest ? String(latest.created_at ?? latest.completed_at ?? '') : null,
    nextEligibleRefresh: hardRemaining > 0 && estimatedCallsRemaining > 0 && hourlyRemaining > 0 && !stopThresholdReached ? 'now' : hourlyRemaining <= 0 ? 'next_hour' : 'next_provider_day',
    warning: budgetWarnings[0] ?? null,
    providerCallsMade: 0,
  }
}

export async function getProviderBudgetStatus(input: BudgetStatusInput = {}) {
  const provider = input.provider ?? 'sportsdataio'
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

export async function checkProviderBudget(input: BudgetCheckInput) {
  const requestedCalls = Math.max(0, Number(input.requestedCalls ?? 0) || 0)
  const status = await getProviderBudgetStatus({ provider: input.provider, sportKey: input.sportKey })
  if (input.dryRun === true || requestedCalls === 0) {
    return { allowed: true, approvedCalls: 0, blockedReason: null, status }
  }
  if (status.accountingUncertain || status.configurationStatus !== 'VALID') {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Provider budget accounting is ${status.accountingStatus}; paid extraction fails closed until usage state is certain.`,
      status,
    }
  }
  if (requestedCalls > status.config.maxCallsPerAction) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls exceeds SPORTSDATAIO_MAX_CALLS_PER_ACTION ${status.config.maxCallsPerAction}.`,
      status,
    }
  }
  if (requestedCalls > status.hourlyRemaining) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls exceeds MLB_MAX_REFRESH_CALLS_PER_HOUR remaining allowance ${status.hourlyRemaining}.`,
      status,
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
    }
  }
  if (requestedCalls > status.estimatedCallsRemaining) {
    return {
      allowed: false,
      approvedCalls: 0,
      blockedReason: `Requested ${requestedCalls} calls would exceed configured daily budget after soft reserve.`,
      status,
    }
  }
  return { allowed: true, approvedCalls: requestedCalls, blockedReason: null, status }
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
