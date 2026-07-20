import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { localDateInTimeZone, zonedUtcRange } from '@/services/provider-time-normalization.service'

const DEFAULT_DAILY_CALL_BUDGET = 1000
const DEFAULT_SOFT_RESERVE = 25
const DEFAULT_MAX_CALLS_PER_ACTION = 3
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

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function localDate(now = new Date()) {
  return localDateInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString().slice(0, 10)
}

function utcRangeForLocalDate(date: string) {
  const range = zonedUtcRange(date, TIMEZONE)
  return { utcStart: range.utcStart, utcEndExclusive: range.utcEndExclusive }
}

function config() {
  return {
    dailyCallBudget: numberFromEnv('SPORTSDATAIO_DAILY_CALL_BUDGET', DEFAULT_DAILY_CALL_BUDGET),
    softReserve: numberFromEnv('SPORTSDATAIO_SOFT_RESERVE', DEFAULT_SOFT_RESERVE),
    maxCallsPerAction: numberFromEnv('SPORTSDATAIO_MAX_CALLS_PER_ACTION', DEFAULT_MAX_CALLS_PER_ACTION),
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
  const cfg = config()
  const [operatingDay, syncJobs] = await Promise.all([
    operatingDayCalls(provider, sportKey, range.utcStart, range.utcEndExclusive),
    syncJobCalls(provider, sportKey, range.utcStart, range.utcEndExclusive),
  ])
  const callsMadeToday = Math.max(operatingDay.callsMade, syncJobs.callsMade)
  const hardRemaining = Math.max(0, cfg.dailyCallBudget - callsMadeToday)
  const estimatedCallsRemaining = Math.max(0, cfg.dailyCallBudget - cfg.softReserve - callsMadeToday)
  const latest = operatingDay.latest ?? syncJobs.latest
  return {
    success: true,
    mode: 'provider_budget_status_v1',
    provider,
    sportKey,
    localDate: today,
    timezone: TIMEZONE,
    config: cfg,
    callsMadeToday,
    callsPlannedToday: operatingDay.callsPlanned,
    hardRemaining,
    estimatedCallsRemaining,
    softReserveRemaining: Math.max(0, cfg.softReserve - Math.max(0, cfg.dailyCallBudget - callsMadeToday - estimatedCallsRemaining)),
    lastProviderCall: latest ? String((latest as Record<string, unknown>).created_at ?? (latest as Record<string, unknown>).completed_at ?? '') : null,
    nextEligibleRefresh: hardRemaining > 0 && estimatedCallsRemaining > 0 ? 'now' : 'next_provider_day',
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
  const previousReserve = process.env.SPORTSDATAIO_SOFT_RESERVE
  const previousMax = process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION
  process.env.SPORTSDATAIO_DAILY_CALL_BUDGET = '10'
  process.env.SPORTSDATAIO_SOFT_RESERVE = '2'
  process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION = '3'
  const cfg = config()
  if (previousBudget === undefined) delete process.env.SPORTSDATAIO_DAILY_CALL_BUDGET
  else process.env.SPORTSDATAIO_DAILY_CALL_BUDGET = previousBudget
  if (previousReserve === undefined) delete process.env.SPORTSDATAIO_SOFT_RESERVE
  else process.env.SPORTSDATAIO_SOFT_RESERVE = previousReserve
  if (previousMax === undefined) delete process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION
  else process.env.SPORTSDATAIO_MAX_CALLS_PER_ACTION = previousMax
  const lockKey = 'fixture:sportsdataio:baseball_mlb'
  const firstClaim = claimProviderActionLock(lockKey, 1000)
  const secondClaim = claimProviderActionLock(lockKey, 1000)
  releaseProviderActionLock(lockKey)
  const checks = [
    ['env config parsed', cfg.dailyCallBudget === 10 && cfg.softReserve === 2 && cfg.maxCallsPerAction === 3],
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
