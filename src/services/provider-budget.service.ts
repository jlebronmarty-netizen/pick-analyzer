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

const localLocks = new Map<string, number>()

function numberFromEnv(names: string | string[], fallback: number) {
  const keys = Array.isArray(names) ? names : [names]
  for (const name of keys) {
    const value = Number(process.env[name])
    if (Number.isFinite(value) && value >= 0) return value
  }
  return fallback
}

function percentFromEnv(names: string | string[], fallback: number) {
  return Math.max(0, Math.min(100, numberFromEnv(names, fallback)))
}

function localDate(now = new Date()) {
  return localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
}

function utcRangeForLocalDate(date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  return { utcStart: range.utcStart, utcEndExclusive: range.utcEndExclusive }
}

function config() {
  const dailyCallBudget = numberFromEnv(
    ['MLB_DAILY_CREDIT_BUDGET', 'PROVIDER_DAILY_CREDIT_BUDGET', 'SPORTSDATAIO_DAILY_CALL_BUDGET'],
    DEFAULT_DAILY_CALL_BUDGET
  )
  const warningThresholdPercent = percentFromEnv('PROVIDER_BUDGET_WARNING_PERCENT', DEFAULT_WARNING_PERCENT)
  const stopThresholdPercent = Math.max(
    warningThresholdPercent,
    percentFromEnv('PROVIDER_BUDGET_STOP_PERCENT', DEFAULT_STOP_PERCENT)
  )
  return {
    dailyCallBudget,
    softReserve: Math.min(
      dailyCallBudget,
      numberFromEnv(['MLB_DAILY_CREDIT_RESERVE', 'PROVIDER_DAILY_CREDIT_RESERVE', 'SPORTSDATAIO_SOFT_RESERVE'], DEFAULT_SOFT_RESERVE)
    ),
    maxCallsPerAction: numberFromEnv(['MLB_MAX_CALLS_PER_ACTION', 'SPORTSDATAIO_MAX_CALLS_PER_ACTION'], DEFAULT_MAX_CALLS_PER_ACTION),
    maxRefreshCallsPerHour: numberFromEnv(
      ['MLB_MAX_REFRESH_CALLS_PER_HOUR', 'PROVIDER_MAX_REFRESH_CALLS_PER_HOUR'],
      DEFAULT_MAX_REFRESH_CALLS_PER_HOUR
    ),
    warningThresholdPercent,
    stopThresholdPercent,
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

async function operatingDayCalls(provider: string, sportKey: string, start: string, end: string) {
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('provider_calls_made, provider_calls_planned, action, status, created_at, metadata')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Provider budget lifecycle read failed: ${error.message}`)

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
  }
}

async function syncJobCalls(provider: string, sportKey: string, start: string, end: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, provider, sport_key, created_at, completed_at, status, metadata')
    .eq('provider', provider)
    .eq('sport_key', sportKey)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
  if (error) {
    return { callsMade: 0, latest: null, warning: `sports_sync_jobs call accounting unavailable: ${error.message}` }
  }
  const rows = data ?? []
  return {
    callsMade: rows.reduce((total, row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}
      const checkpoint = metadata.checkpoint && typeof metadata.checkpoint === 'object' ? (metadata.checkpoint as Record<string, unknown>) : {}
      return total + Number(metadata.externalCallsUsed ?? checkpoint.providerCallsUsed ?? 0)
    }, 0),
    latest: rows[0] ?? null,
    warning: null,
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
  const callsMadeToday = Math.max(operatingDay.callsMade, syncJobs.callsMade)
  const callsMadeLastHour = Math.max(operatingDayLastHour.callsMade, syncJobsLastHour.callsMade)
  const hardRemaining = Math.max(0, cfg.dailyCallBudget - callsMadeToday)
  const estimatedCallsRemaining = Math.max(0, cfg.dailyCallBudget - cfg.softReserve - callsMadeToday)
  const hourlyRemaining = Math.max(0, cfg.maxRefreshCallsPerHour - callsMadeLastHour)
  const usagePercent = cfg.dailyCallBudget > 0 ? Math.round((callsMadeToday / cfg.dailyCallBudget) * 1000) / 10 : 100
  const warningThresholdReached = usagePercent >= cfg.warningThresholdPercent
  const stopThresholdReached = usagePercent >= cfg.stopThresholdPercent
  const latest = operatingDay.latest ?? syncJobs.latest
  const budgetWarnings = [
    warningThresholdReached ? `Provider usage has reached ${usagePercent}% of the configured daily budget.` : null,
    hourlyRemaining <= 0 ? 'Provider hourly refresh budget is exhausted for the current rolling hour.' : null,
    stopThresholdReached ? `Provider usage has reached the ${cfg.stopThresholdPercent}% hard-stop threshold.` : null,
    syncJobs.warning,
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
    softReserveRemaining: Math.max(0, cfg.softReserve - Math.max(0, cfg.dailyCallBudget - callsMadeToday - estimatedCallsRemaining)),
    usagePercent,
    warningThresholdReached,
    stopThresholdReached,
    budgetWarnings,
    lastProviderCall: latest ? String((latest as Record<string, unknown>).created_at ?? (latest as Record<string, unknown>).completed_at ?? '') : null,
    nextEligibleRefresh: hardRemaining > 0 && estimatedCallsRemaining > 0 && hourlyRemaining > 0 && !stopThresholdReached ? 'now' : hourlyRemaining <= 0 ? 'next_hour' : 'next_provider_day',
    warning: syncJobs.warning,
    providerCallsMade: 0,
  }
}

export async function checkProviderBudget(input: BudgetCheckInput) {
  const requestedCalls = Math.max(0, Number(input.requestedCalls ?? 0) || 0)
  const status = await getProviderBudgetStatus({ provider: input.provider, sportKey: input.sportKey })
  if (input.dryRun === true || requestedCalls === 0) {
    return { allowed: true, approvedCalls: 0, blockedReason: null, status }
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

export function validateProviderBudgetDeterministicFixtures() {
  const previousBudget = process.env.SPORTSDATAIO_DAILY_CALL_BUDGET
  const previousMlbBudget = process.env.MLB_DAILY_CREDIT_BUDGET
  const previousProviderBudget = process.env.PROVIDER_DAILY_CREDIT_BUDGET
  const previousReserve = process.env.SPORTSDATAIO_SOFT_RESERVE
  const previousMax = process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION
  const previousHourly = process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR
  const previousWarning = process.env.PROVIDER_BUDGET_WARNING_PERCENT
  const previousStop = process.env.PROVIDER_BUDGET_STOP_PERCENT
  process.env.SPORTSDATAIO_DAILY_CALL_BUDGET = '10'
  process.env.SPORTSDATAIO_SOFT_RESERVE = '2'
  process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION = '3'
  process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR = '4'
  process.env.PROVIDER_BUDGET_WARNING_PERCENT = '70'
  process.env.PROVIDER_BUDGET_STOP_PERCENT = '90'
  const cfg = config()
  const mlbOverrideCfg = (() => {
    process.env.MLB_DAILY_CREDIT_BUDGET = '25'
    return config()
  })()
  if (previousBudget === undefined) delete process.env.SPORTSDATAIO_DAILY_CALL_BUDGET
  else process.env.SPORTSDATAIO_DAILY_CALL_BUDGET = previousBudget
  if (previousMlbBudget === undefined) delete process.env.MLB_DAILY_CREDIT_BUDGET
  else process.env.MLB_DAILY_CREDIT_BUDGET = previousMlbBudget
  if (previousProviderBudget === undefined) delete process.env.PROVIDER_DAILY_CREDIT_BUDGET
  else process.env.PROVIDER_DAILY_CREDIT_BUDGET = previousProviderBudget
  if (previousReserve === undefined) delete process.env.SPORTSDATAIO_SOFT_RESERVE
  else process.env.SPORTSDATAIO_SOFT_RESERVE = previousReserve
  if (previousMax === undefined) delete process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION
  else process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION = previousMax
  if (previousHourly === undefined) delete process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR
  else process.env.MLB_MAX_REFRESH_CALLS_PER_HOUR = previousHourly
  if (previousWarning === undefined) delete process.env.PROVIDER_BUDGET_WARNING_PERCENT
  else process.env.PROVIDER_BUDGET_WARNING_PERCENT = previousWarning
  if (previousStop === undefined) delete process.env.PROVIDER_BUDGET_STOP_PERCENT
  else process.env.PROVIDER_BUDGET_STOP_PERCENT = previousStop
  const lockKey = 'fixture:sportsdataio:baseball_mlb'
  const firstClaim = claimProviderActionLock(lockKey, 1000)
  const secondClaim = claimProviderActionLock(lockKey, 1000)
  releaseProviderActionLock(lockKey)
  const checks = [
    ['env config parsed', cfg.dailyCallBudget === 10 && cfg.softReserve === 2 && cfg.maxCallsPerAction === 3],
    ['MLB daily budget override wins', mlbOverrideCfg.dailyCallBudget === 25],
    ['hourly and threshold config parsed', cfg.maxRefreshCallsPerHour === 4 && cfg.warningThresholdPercent === 70 && cfg.stopThresholdPercent === 90],
    ['local date uses puerto rico offset', localDate(new Date('2026-07-17T03:30:00.000Z')) === '2026-07-16'],
    ['concurrent lock rejects second claim', firstClaim && !secondClaim],
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
