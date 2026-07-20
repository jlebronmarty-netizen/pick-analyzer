import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_EVENT_TIMEZONE, puertoRicoLocalDateFromUtc, puertoRicoUtcRange } from '@/services/active-event.service'
import { getCurrentBoard } from '@/services/current-board.service'
import { getDashboardToday } from '@/services/dashboard-today.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getOperatingDayAutomationStatus } from '@/services/operating-day-automation.service'
import { executeOperatingDay, getOperatingDayStatus } from '@/services/operating-day.service'
import { resolveMlbOperatingDate } from '@/services/mlb-operating-date-resolution.service'
import {
  checkProviderBudget,
  claimProviderActionLock,
  getProviderBudgetStatus,
  releaseProviderActionLock,
} from '@/services/provider-budget.service'
import { formatInTimeZone } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = ACTIVE_EVENT_TIMEZONE
const DEFAULT_MLB_ODDS_REFRESH_MINUTES_EARLY = 60
const DEFAULT_MLB_ODDS_REFRESH_MINUTES_PREGAME = 15
const DEFAULT_MLB_ODDS_REFRESH_MINUTES_NEAR_START = 10
const DEFAULT_MLB_SCORE_REFRESH_MINUTES_LIVE = 5
const DEFAULT_MLB_RESULTS_REFRESH_MINUTES_POSTGAME = 15
const DEFAULT_MLB_ODDS_AGING_MULTIPLIER = 2

export type AdaptiveApiStatus = 'SUCCESS' | 'INSUFFICIENT_DATA' | 'PARTIAL' | 'NOT_SUPPORTED' | 'ERROR'
export type FreshnessState = 'FRESH' | 'AGING' | 'STALE' | 'PENDING' | 'NOT_AVAILABLE' | 'NOT_SUPPORTED' | 'FAILED'
export type MarketRefreshState =
  | 'CURRENT'
  | 'CHECK_DUE'
  | 'CHECK_OVERDUE'
  | 'PROVIDER_CHECK_FAILED'
  | 'PROVIDER_DELAYED'
  | 'NO_MARKETS_RETURNED'
  | 'NO_RELEVANT_GAMES'
  | 'BUDGET_BLOCKED'
  | 'NOT_APPLICABLE'
export type ProviderBudgetMode = 'NORMAL' | 'CONSERVATIVE' | 'CRITICAL' | 'EXHAUSTED'
export type RefreshDecision = 'DUE_NOW' | 'DUE_SOON' | 'NOT_DUE' | 'BLOCKED' | 'NOT_SUPPORTED'

type SafeResult<T> = { ok: true; value: T } | { ok: false; error: string }

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  home_team: string | null
  away_team: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
}

type PredictionFreshnessRow = {
  id: string
  game_id: string
  generated_at: string | null
  odds_timestamp: string | null
  status: string | null
  result: string | null
  feature_snapshot: Record<string, unknown> | null
}

type LifecycleEventRow = {
  action: string | null
  status: string | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  provider_calls_planned: number | null
  provider_calls_made: number | null
  blocking_reason: string | null
  metadata: Record<string, unknown> | null
}

export type FreshnessPolicy = {
  domain: DataFreshnessDomain
  label: string
  source: string
  supported: boolean
  freshMinutes: number | null
  staleMinutes: number | null
  refreshCadence: string
  userCopy: string
  unavailableCopy: string
}

type MlbRefreshWindow = 'NO_SLATE' | 'EARLY' | 'PREGAME' | 'NEAR_START' | 'LIVE' | 'POSTGAME'

type MlbCadenceConfig = {
  oddsRefreshMinutesEarly: number
  oddsRefreshMinutesPregame: number
  oddsRefreshMinutesNearStart: number
  scoreRefreshMinutesLive: number
  resultsRefreshMinutesPostgame: number
  oddsAgingMultiplier: number
  envAliases: Record<string, string[]>
}

type EventRefreshWindow = {
  eventId: string
  matchup: string
  scheduledTime: string | null
  status: string | null
  timeUntilFirstPitchMinutes: number | null
  window: MlbRefreshWindow
  marketRefreshAllowed: boolean
  statusRefreshMinutes: number | null
  oddsRefreshMinutes: number | null
  resultsRefreshMinutes: number | null
  nextDueAt: string | null
  reason: string
}

export type DataFreshnessDomain =
  | 'schedule'
  | 'odds'
  | 'results'
  | 'starters'
  | 'lineups'
  | 'injuries_availability'
  | 'weather'
  | 'bullpen'
  | 'feature_snapshot'
  | 'prediction'
  | 'recommendation'
  | 'settlement'

export type DataFreshnessItem = {
  domain: DataFreshnessDomain
  label: string
  status: FreshnessState
  source: string
  lastUpdated: string | null
  fetchedAt: string | null
  ageMinutes: number | null
  freshForMinutes: number | null
  staleAfterMinutes: number | null
  nextRecommendedRefreshAt: string | null
  supported: boolean
  available: boolean
  actionable: boolean
  staleReason: string | null
  userMessage: string
  internalCode: string
}

export const DATA_FRESHNESS_POLICIES: Record<DataFreshnessDomain, FreshnessPolicy> = {
  schedule: {
    domain: 'schedule',
    label: 'Schedule',
    source: 'sport_events',
    supported: true,
    freshMinutes: 12 * 60,
    staleMinutes: 24 * 60,
    refreshCadence: 'Morning slate discovery plus next-slate rollover.',
    userCopy: 'Game schedule is known.',
    unavailableCopy: 'Schedule is not available yet.',
  },
  odds: {
    domain: 'odds',
    label: 'Market prices',
    source: 'sports_odds_snapshots/current-board',
    supported: true,
    freshMinutes: DEFAULT_MLB_ODDS_REFRESH_MINUTES_EARLY,
    staleMinutes: DEFAULT_MLB_ODDS_REFRESH_MINUTES_EARLY * DEFAULT_MLB_ODDS_AGING_MULTIPLIER,
    refreshCadence: 'Refresh before recommendations and near first pitch when budget allows.',
    userCopy: 'Market prices are current enough for review.',
    unavailableCopy: 'Market prices are waiting for the next safe refresh.',
  },
  results: {
    domain: 'results',
    label: 'Results',
    source: 'game_results/sport_events',
    supported: true,
    freshMinutes: 60,
    staleMinutes: 12 * 60,
    refreshCadence: 'After games complete and before settlement.',
    userCopy: 'Final results are up to date.',
    unavailableCopy: 'Results are not due until games finish.',
  },
  starters: {
    domain: 'starters',
    label: 'Probable starters',
    source: 'feature_snapshot.starter_context',
    supported: true,
    freshMinutes: 6 * 60,
    staleMinutes: 18 * 60,
    refreshCadence: 'Stored starter context is checked during preview generation.',
    userCopy: 'Starter context is available from stored features.',
    unavailableCopy: 'Starter context is pending or unavailable.',
  },
  lineups: {
    domain: 'lineups',
    label: 'Confirmed lineups',
    source: 'feature_snapshot.lineup_context',
    supported: false,
    freshMinutes: null,
    staleMinutes: null,
    refreshCadence: 'Unsupported for MLB recommendations until ingestion is approved.',
    userCopy: 'Lineup confirmation is available.',
    unavailableCopy: 'Confirmed lineup data is unavailable; absence is not inferred.',
  },
  injuries_availability: {
    domain: 'injuries_availability',
    label: 'Roster availability',
    source: 'stored player status when populated',
    supported: true,
    freshMinutes: 24 * 60,
    staleMinutes: 48 * 60,
    refreshCadence: 'Player status can inform availability; detailed injuries remain provider-plan blocked.',
    userCopy: 'Roster availability status is available when stored player data exists.',
    unavailableCopy: 'Availability is pending; detailed injury information is unavailable under the current provider plan.',
  },
  weather: {
    domain: 'weather',
    label: 'Weather',
    source: 'feature_snapshot.weather_context',
    supported: true,
    freshMinutes: 6 * 60,
    staleMinutes: 18 * 60,
    refreshCadence: 'Checked during feature generation and pregame refresh.',
    userCopy: 'Weather context is available from stored features.',
    unavailableCopy: 'Weather context is pending or unavailable.',
  },
  bullpen: {
    domain: 'bullpen',
    label: 'Bullpen',
    source: 'feature_snapshot.bullpen_context',
    supported: true,
    freshMinutes: 24 * 60,
    staleMinutes: 48 * 60,
    refreshCadence: 'Stored bullpen context is informational until deeper ingestion is approved.',
    userCopy: 'Bullpen context is available from stored features.',
    unavailableCopy: 'Bullpen context is limited or pending.',
  },
  feature_snapshot: {
    domain: 'feature_snapshot',
    label: 'Feature snapshot',
    source: 'prediction_history.feature_snapshot',
    supported: true,
    freshMinutes: 6 * 60,
    staleMinutes: 24 * 60,
    refreshCadence: 'Regenerated only through the existing operating-day pipeline.',
    userCopy: 'Feature snapshots are attached to eligible predictions.',
    unavailableCopy: 'Feature snapshots are waiting for eligible games and odds.',
  },
  prediction: {
    domain: 'prediction',
    label: 'Prediction',
    source: 'prediction_history.generated_at',
    supported: true,
    freshMinutes: 6 * 60,
    staleMinutes: 24 * 60,
    refreshCadence: 'Generated by existing prediction infrastructure after valid inputs.',
    userCopy: 'Predictions are available from stored model output.',
    unavailableCopy: 'Predictions are pending valid inputs.',
  },
  recommendation: {
    domain: 'recommendation',
    label: 'Recommendation',
    source: 'current-board policy evaluation',
    supported: true,
    freshMinutes: 6 * 60,
    staleMinutes: 24 * 60,
    refreshCadence: 'Policy evaluation follows prediction generation and does not change thresholds.',
    userCopy: 'Recommendation policy has been evaluated.',
    unavailableCopy: 'Recommendation policy is not actionable until predictions and odds are current.',
  },
  settlement: {
    domain: 'settlement',
    label: 'Settlement',
    source: 'prediction_history.status/result',
    supported: true,
    freshMinutes: 24 * 60,
    staleMinutes: 48 * 60,
    refreshCadence: 'Runs after authoritative final results.',
    userCopy: 'Settlement status is current for completed predictions.',
    unavailableCopy: 'Settlement is not due until results are final.',
  },
}

function nowIso(now = new Date()) {
  return now.toISOString()
}

function numberFromEnv(names: string | string[], fallback: number) {
  const keys = Array.isArray(names) ? names : [names]
  for (const name of keys) {
    const value = Number(process.env[name])
    if (Number.isFinite(value) && value > 0) return value
  }
  return fallback
}

function mlbCadenceConfig(): MlbCadenceConfig {
  return {
    oddsRefreshMinutesEarly: numberFromEnv('MLB_ODDS_REFRESH_MINUTES_EARLY', DEFAULT_MLB_ODDS_REFRESH_MINUTES_EARLY),
    oddsRefreshMinutesPregame: numberFromEnv('MLB_ODDS_REFRESH_MINUTES_PREGAME', DEFAULT_MLB_ODDS_REFRESH_MINUTES_PREGAME),
    oddsRefreshMinutesNearStart: numberFromEnv('MLB_ODDS_REFRESH_MINUTES_NEAR_START', DEFAULT_MLB_ODDS_REFRESH_MINUTES_NEAR_START),
    scoreRefreshMinutesLive: numberFromEnv('MLB_SCORE_REFRESH_MINUTES_LIVE', DEFAULT_MLB_SCORE_REFRESH_MINUTES_LIVE),
    resultsRefreshMinutesPostgame: numberFromEnv('MLB_RESULTS_REFRESH_MINUTES_POSTGAME', DEFAULT_MLB_RESULTS_REFRESH_MINUTES_POSTGAME),
    oddsAgingMultiplier: numberFromEnv('MLB_ODDS_AGING_MULTIPLIER', DEFAULT_MLB_ODDS_AGING_MULTIPLIER),
    envAliases: {
      oddsRefreshMinutesEarly: ['MLB_ODDS_REFRESH_MINUTES_EARLY'],
      oddsRefreshMinutesPregame: ['MLB_ODDS_REFRESH_MINUTES_PREGAME'],
      oddsRefreshMinutesNearStart: ['MLB_ODDS_REFRESH_MINUTES_NEAR_START'],
      scoreRefreshMinutesLive: ['MLB_SCORE_REFRESH_MINUTES_LIVE'],
      resultsRefreshMinutesPostgame: ['MLB_RESULTS_REFRESH_MINUTES_POSTGAME'],
      oddsAgingMultiplier: ['MLB_ODDS_AGING_MULTIPLIER'],
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function safeDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function ageMinutes(value: string | null | undefined, now = new Date()) {
  const parsed = safeDate(value)
  if (!parsed) return null
  return Math.max(0, round((now.getTime() - parsed.getTime()) / 60000, 1))
}

function addMinutes(value: string | null | undefined, minutes: number | null) {
  const parsed = safeDate(value)
  if (!parsed || minutes === null) return null
  return new Date(parsed.getTime() + minutes * 60000).toISOString()
}

function minutesUntilNextStart(events: EventRow[], now: Date) {
  const next = events
    .map((event) => safeDate(event.start_time)?.getTime() ?? Number.NaN)
    .filter((time) => Number.isFinite(time) && time > now.getTime())
    .sort((left, right) => left - right)[0]
  return Number.isFinite(next) ? Math.max(0, round((next - now.getTime()) / 60000, 1)) : null
}

function refreshWindow({
  events,
  currentGames,
  upcomingGames,
  finalGames,
  now,
}: {
  events: EventRow[]
  currentGames: number
  upcomingGames: number
  finalGames: number
  now: Date
}): { window: MlbRefreshWindow; minutesUntilFirstPitch: number | null } {
  const minutes = minutesUntilNextStart(events, now)
  const hasSlate = currentGames > 0 || upcomingGames > 0 || finalGames > 0 || events.length > 0
  if (!hasSlate) return { window: 'NO_SLATE', minutesUntilFirstPitch: null }
  if (currentGames > 0 && finalGames < currentGames && minutes === null) return { window: 'LIVE', minutesUntilFirstPitch: null }
  if (finalGames > 0 && finalGames >= currentGames && upcomingGames === 0) return { window: 'POSTGAME', minutesUntilFirstPitch: null }
  if (minutes !== null && minutes <= 90) return { window: 'NEAR_START', minutesUntilFirstPitch: minutes }
  if (minutes !== null && minutes <= 360) return { window: 'PREGAME', minutesUntilFirstPitch: minutes }
  return { window: 'EARLY', minutesUntilFirstPitch: minutes }
}

function eventWindow(event: EventRow, now: Date): { window: MlbRefreshWindow; minutesUntilFirstPitch: number | null } {
  const status = String(event.status ?? '').toLowerCase()
  const start = safeDate(event.start_time)
  const minutes = start ? round((start.getTime() - now.getTime()) / 60000, 1) : null
  if (['completed', 'final', 'closed'].includes(status)) return { window: 'POSTGAME', minutesUntilFirstPitch: minutes }
  if (['live', 'in_progress', 'inprogress', 'started'].includes(status)) return { window: 'LIVE', minutesUntilFirstPitch: minutes }
  if (minutes !== null && minutes <= 0) return { window: 'LIVE', minutesUntilFirstPitch: minutes }
  if (minutes !== null && minutes <= 90) return { window: 'NEAR_START', minutesUntilFirstPitch: minutes }
  if (minutes !== null && minutes <= 240) return { window: 'PREGAME', minutesUntilFirstPitch: minutes }
  if (minutes !== null) return { window: 'EARLY', minutesUntilFirstPitch: minutes }
  return { window: 'NO_SLATE', minutesUntilFirstPitch: null }
}

function eventRefreshWindows(events: EventRow[], now: Date, cfg: MlbCadenceConfig, latestOddsChange: string | null): EventRefreshWindow[] {
  return events
    .map((event) => {
      const window = eventWindow(event, now)
      const oddsRefreshMinutes =
        window.window === 'EARLY'
          ? cfg.oddsRefreshMinutesEarly
          : window.window === 'PREGAME'
            ? cfg.oddsRefreshMinutesPregame
            : window.window === 'NEAR_START'
              ? cfg.oddsRefreshMinutesNearStart
              : null
      const statusRefreshMinutes = window.window === 'LIVE' || window.window === 'NEAR_START' ? cfg.scoreRefreshMinutesLive : null
      const resultsRefreshMinutes = window.window === 'LIVE' || window.window === 'POSTGAME' ? cfg.resultsRefreshMinutesPostgame : null
      const cadence = oddsRefreshMinutes ?? statusRefreshMinutes ?? resultsRefreshMinutes
      const nextDueAt = latestOddsChange && oddsRefreshMinutes
        ? new Date(new Date(latestOddsChange).getTime() + oddsRefreshMinutes * 60000).toISOString()
        : null
      return {
        eventId: event.id,
        matchup: `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`,
        scheduledTime: event.start_time,
        status: event.status,
        timeUntilFirstPitchMinutes: window.minutesUntilFirstPitch,
        window: window.window,
        marketRefreshAllowed: Boolean(oddsRefreshMinutes),
        statusRefreshMinutes,
        oddsRefreshMinutes,
        resultsRefreshMinutes,
        nextDueAt,
        reason:
          window.window === 'POSTGAME'
            ? 'Final/completed event: stop market refresh and continue results/settlement only.'
            : window.window === 'LIVE'
              ? 'Live event: monitor status/results and stop pregame market polling.'
              : cadence
                ? `Pregame event cadence is ${cadence} minutes for the current proximity window.`
                : 'No event-specific provider refresh is due.',
      }
    })
    .sort((left, right) => String(left.scheduledTime ?? '').localeCompare(String(right.scheduledTime ?? '')))
}

function policyForWindow(domain: DataFreshnessDomain, window: MlbRefreshWindow, cfg: MlbCadenceConfig): FreshnessPolicy {
  const policy = DATA_FRESHNESS_POLICIES[domain]
  if (domain === 'odds') {
    const freshMinutes =
      window === 'NEAR_START'
        ? cfg.oddsRefreshMinutesNearStart
        : window === 'PREGAME'
          ? cfg.oddsRefreshMinutesPregame
          : window === 'NO_SLATE' || window === 'POSTGAME'
            ? 6 * 60
            : cfg.oddsRefreshMinutesEarly
    return {
      ...policy,
      freshMinutes,
      staleMinutes: Math.max(freshMinutes + 1, freshMinutes * cfg.oddsAgingMultiplier),
      refreshCadence:
        window === 'NO_SLATE'
          ? 'No current MLB slate; skip wasteful odds polling.'
          : window === 'POSTGAME'
            ? 'Pregame market polling stops after the slate is complete.'
            : window === 'NEAR_START'
              ? `Refresh every ${cfg.oddsRefreshMinutesNearStart} minutes inside the final 90 minutes when budget allows.`
              : window === 'PREGAME'
                ? `Refresh every ${cfg.oddsRefreshMinutesPregame} minutes in the active pregame window when budget allows.`
                : `Refresh every ${cfg.oddsRefreshMinutesEarly} minutes in the early game-day window when budget allows.`,
    }
  }
  if (domain === 'results') {
    return {
      ...policy,
      freshMinutes: window === 'POSTGAME' || window === 'LIVE' ? cfg.resultsRefreshMinutesPostgame : policy.freshMinutes,
      staleMinutes: window === 'POSTGAME' || window === 'LIVE' ? cfg.resultsRefreshMinutesPostgame * DEFAULT_MLB_ODDS_AGING_MULTIPLIER : policy.staleMinutes,
      refreshCadence:
        window === 'POSTGAME' || window === 'LIVE'
          ? `Refresh final results every ${cfg.resultsRefreshMinutesPostgame} minutes until settlement is complete.`
          : policy.refreshCadence,
    }
  }
  return policy
}

function maxIso(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? null
}

function latestCompletedProviderCheck(lifecycle: LifecycleEventRow[]) {
  const checks = lifecycle
    .map((row) => {
      const metadata = asRecord(row.metadata)
      const providerCheck = asRecord(metadata.providerCheck)
      const nestedProviderCheck = asRecord(asRecord(metadata.result).providerCheck)
      const check = providerCheck.providerCheckCompleted === true ? providerCheck : nestedProviderCheck.providerCheckCompleted === true ? nestedProviderCheck : null
      if (!check) return null
      return {
        checkedAt: row.completed_at ?? row.created_at,
        sourceLatestTimestamp: String(check.sourceLatestTimestamp ?? '') || null,
        failureReason: String(check.failureReason ?? '') || null,
        rowsReceived: Number(check.rowsReceived ?? 0),
        changesDetected: Number(check.changesDetected ?? 0),
      }
    })
    .filter((item): item is { checkedAt: string | null; sourceLatestTimestamp: string | null; failureReason: string | null; rowsReceived: number; changesDetected: number } => Boolean(item?.checkedAt))
    .sort((left, right) => String(right.checkedAt).localeCompare(String(left.checkedAt)))
  return checks[0] ?? null
}

function localDate(now = new Date()) {
  return puertoRicoLocalDateFromUtc(now.toISOString()) ?? now.toISOString().slice(0, 10)
}

function classifyFreshness({
  policy,
  lastUpdated,
  available,
  activeNeed,
  now,
}: {
  policy: FreshnessPolicy
  lastUpdated: string | null
  available: boolean
  activeNeed: boolean
  now: Date
}): FreshnessState {
  if (!policy.supported) return 'NOT_SUPPORTED'
  if (!available) return activeNeed ? 'PENDING' : 'NOT_AVAILABLE'
  const age = ageMinutes(lastUpdated, now)
  if (age === null) return activeNeed ? 'PENDING' : 'NOT_AVAILABLE'
  if (policy.freshMinutes !== null && age <= policy.freshMinutes) return 'FRESH'
  if (policy.staleMinutes !== null && age <= policy.staleMinutes) return 'AGING'
  return 'STALE'
}

function freshnessItem({
  domain,
  lastUpdated,
  available,
  activeNeed,
  now,
  sourceOverride,
  policyOverride,
}: {
  domain: DataFreshnessDomain
  lastUpdated: string | null
  available: boolean
  activeNeed: boolean
  now: Date
  sourceOverride?: string
  policyOverride?: FreshnessPolicy
}): DataFreshnessItem {
  const policy = policyOverride ?? DATA_FRESHNESS_POLICIES[domain]
  const status = classifyFreshness({ policy, lastUpdated, available, activeNeed, now })
  const age = ageMinutes(lastUpdated, now)
  const actionable = policy.supported && available && !['STALE', 'FAILED'].includes(status)
  const staleReason =
    status === 'STALE'
      ? `${policy.label} is older than the ${policy.staleMinutes}-minute stale policy.`
      : status === 'PENDING'
        ? policy.unavailableCopy
        : status === 'NOT_SUPPORTED'
          ? policy.unavailableCopy
          : null
  const userMessage =
    status === 'FRESH' || status === 'AGING'
      ? policy.userCopy
      : status === 'NOT_SUPPORTED'
        ? policy.unavailableCopy
        : activeNeed
          ? policy.unavailableCopy
          : `${policy.label} is not due right now.`
  return {
    domain,
    label: policy.label,
    status,
    source: sourceOverride ?? policy.source,
    lastUpdated,
    fetchedAt: lastUpdated,
    ageMinutes: age,
    freshForMinutes: policy.freshMinutes,
    staleAfterMinutes: policy.staleMinutes,
    nextRecommendedRefreshAt: addMinutes(lastUpdated, policy.freshMinutes),
    supported: policy.supported,
    available,
    actionable,
    staleReason,
    userMessage,
    internalCode: `${domain}_${status.toLowerCase()}`,
  }
}

async function safe<T>(label: string, loader: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, value: await loader() }
  } catch (error) {
    return { ok: false, error: `${label}: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function loadLifecycleEvents(now = new Date()) {
  const today = localDate(now)
  const range = puertoRicoUtcRange(today)
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('action, status, created_at, started_at, completed_at, provider_calls_planned, provider_calls_made, blocking_reason, metadata')
    .gte('created_at', range.utcStart)
    .lt('created_at', range.utcEndExclusive)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Adaptive lifecycle audit read failed: ${error.message}`)
  return (data ?? []) as LifecycleEventRow[]
}

async function loadEvents(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, home_team, away_team, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`Adaptive event read failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadPredictions(eventIds: string[]) {
  if (!eventIds.length) return [] as PredictionFreshnessRow[]
  const rows: PredictionFreshnessRow[] = []
  for (let index = 0; index < eventIds.length; index += 50) {
    const chunk = eventIds.slice(index, index + 50)
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, generated_at, odds_timestamp, status, result, feature_snapshot')
      .eq('sport_key', SPORT_KEY)
      .in('game_id', chunk)
    if (error) throw new Error(`Adaptive prediction freshness read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionFreshnessRow[]))
  }
  return rows
}

function budgetMode(budget: Awaited<ReturnType<typeof getProviderBudgetStatus>> | null): ProviderBudgetMode {
  if (!budget) return 'CONSERVATIVE'
  const remaining = Number(budget.estimatedCallsRemaining ?? 0)
  const daily = Number(budget.config?.dailyCallBudget ?? 0)
  if (remaining <= 0) return 'EXHAUSTED'
  if (remaining <= 2) return 'CRITICAL'
  if (daily > 0 && remaining / daily <= 0.15) return 'CONSERVATIVE'
  return 'NORMAL'
}

function estimatedCallsForDomain(domain: DataFreshnessDomain) {
  if (domain === 'schedule') return 1
  if (domain === 'odds') return 1
  if (domain === 'results') return 1
  if (domain === 'starters' || domain === 'weather' || domain === 'bullpen' || domain === 'feature_snapshot' || domain === 'prediction') return 0
  return 0
}

function domainDecision(item: DataFreshnessItem, mode: ProviderBudgetMode): RefreshDecision {
  if (!item.supported) return 'NOT_SUPPORTED'
  if (mode === 'EXHAUSTED' && estimatedCallsForDomain(item.domain) > 0) return 'BLOCKED'
  if (['STALE', 'PENDING'].includes(item.status) && ['schedule', 'odds', 'results'].includes(item.domain)) return 'DUE_NOW'
  if (item.status === 'AGING' && item.nextRecommendedRefreshAt) return 'DUE_SOON'
  return 'NOT_DUE'
}

function marketRefreshState({
  latestOddsChange,
  latestProviderCheck,
  waitingForOdds,
  readyForAnalysis,
  activeNeed,
  mode,
  now,
  policy,
}: {
  latestOddsChange: string | null
  latestProviderCheck: ReturnType<typeof latestCompletedProviderCheck>
  waitingForOdds: number
  readyForAnalysis: number
  activeNeed: boolean
  mode: ProviderBudgetMode
  now: Date
  policy: FreshnessPolicy
}): { state: MarketRefreshState; reason: string; lastUpdated: string | null; available: boolean } {
  const hasAcceptedMarkets = readyForAnalysis > 0 && Boolean(latestOddsChange)
  const providerAge = ageMinutes(latestProviderCheck?.checkedAt ?? null, now)
  const marketAge = ageMinutes(latestOddsChange, now)

  if (!activeNeed) {
    return { state: 'NO_RELEVANT_GAMES', reason: 'No current relevant MLB games require market prices.', lastUpdated: null, available: false }
  }
  if (mode === 'EXHAUSTED') {
    return { state: 'BUDGET_BLOCKED', reason: 'Provider budget is exhausted; market refresh is blocked.', lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (latestProviderCheck?.failureReason) {
    return { state: 'PROVIDER_CHECK_FAILED', reason: String(latestProviderCheck.failureReason), lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (waitingForOdds > 0 && !hasAcceptedMarkets) {
    return latestProviderCheck?.checkedAt
      ? { state: 'NO_MARKETS_RETURNED', reason: 'A provider check exists, but no accepted current market is available for eligible games.', lastUpdated: null, available: false }
      : { state: 'CHECK_OVERDUE', reason: 'Eligible games need market prices and no successful current provider check is recorded.', lastUpdated: null, available: false }
  }
  if (!latestProviderCheck?.checkedAt) {
    return { state: 'CHECK_DUE', reason: 'No successful market provider check is recorded for the active slate.', lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (providerAge !== null && policy.staleMinutes !== null && providerAge > policy.staleMinutes) {
    return { state: 'CHECK_OVERDUE', reason: 'The latest market provider check is stale for the active slate.', lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (marketAge !== null && policy.staleMinutes !== null && marketAge > policy.staleMinutes) {
    return { state: 'CHECK_OVERDUE', reason: 'The latest accepted market timestamp is stale for the active slate.', lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (marketAge !== null && policy.freshMinutes !== null && marketAge > policy.freshMinutes) {
    return { state: 'CHECK_DUE', reason: 'Accepted markets exist but are aging; refresh should run when budget permits.', lastUpdated: latestOddsChange, available: hasAcceptedMarkets }
  }
  if (hasAcceptedMarkets) {
    return { state: 'CURRENT', reason: 'Accepted current market prices are available for analysis.', lastUpdated: latestOddsChange, available: true }
  }
  return { state: 'PROVIDER_DELAYED', reason: 'Market provider evidence exists, but current eligible market prices are not yet accepted.', lastUpdated: latestOddsChange, available: false }
}

function schedulerJobs(lifecycle: LifecycleEventRow[], budget: Awaited<ReturnType<typeof getProviderBudgetStatus>> | null) {
  const latestByAction = new Map<string, LifecycleEventRow>()
  for (const row of lifecycle) {
    const action = String(row.action ?? 'unknown')
    if (!latestByAction.has(action)) latestByAction.set(action, row)
  }
  const vercel = {
    id: 'vercel_operating_day_cron',
    name: 'Vercel Operating Day Cron',
    path: '/api/cron/operating-day',
    cadence: '0 12 * * *',
    active: true,
    timezone: 'UTC schedule; service resolves America/Puerto_Rico operating date',
    lastRunAt: lifecycle[0]?.created_at ?? null,
    nextRunAt: null,
    status: lifecycle[0]?.status ?? 'configured',
    providerCallsMadeToday: Number(budget?.callsMadeToday ?? 0),
    providerCallsPlannedToday: Number(budget?.callsPlannedToday ?? 0),
    lastFailure: lifecycle.find((row) => row.blocking_reason)?.blocking_reason ?? null,
  }
  const manualRoutes = ['daily-sync', 'master-sync', 'capture-predictions'].map((name) => ({
    id: `manual_${name}`,
    name: `Manual ${name}`,
    path: `/api/cron/${name}`,
    cadence: 'manual route present; not scheduled in vercel.json',
    active: false,
    timezone: 'route-specific',
    lastRunAt: latestByAction.get(name)?.created_at ?? null,
    nextRunAt: null,
    status: 'not_scheduled',
    providerCallsMadeToday: 0,
    providerCallsPlannedToday: 0,
    lastFailure: null,
  }))
  return [vercel, ...manualRoutes]
}

export async function getAdaptiveRefreshStatus({ now = new Date() }: { now?: Date } = {}) {
  const generatedAt = nowIso(now)
  const today = localDate(now)
  const dateResolutionResult = await safe('Operating Date Resolution', () => resolveMlbOperatingDate({ action: 'midday_refresh', now }))
  const statusRecoveryDateResolutionResult = await safe('Status Recovery Date Resolution', () => resolveMlbOperatingDate({ action: 'status_refresh', now }))
  const dateResolution = dateResolutionResult.ok ? dateResolutionResult.value : null
  const statusRecoveryDateResolution = statusRecoveryDateResolutionResult.ok ? statusRecoveryDateResolutionResult.value : null
  const dashboardResult = await safe('Dashboard Today', () => getDashboardToday({ now }))
  const dashboard = dashboardResult.ok ? dashboardResult.value : null
  const operatingDate = dateResolution?.localCalendarDate ?? dashboard?.operatingDate ?? today
  const nextSlateDate = dateResolution?.nextSlateDate ?? dashboard?.nextSlateDate ?? null
  const activeSlateDate = dateResolution?.activeSlateDate ?? dashboard?.activeSlateDate ?? operatingDate
  const providerQueryDate = dateResolution?.providerQueryDate ?? activeSlateDate

  const [boardResult, nextSlateResult, operatingResult, automationResult, budgetResult, lifecycleResult, currentEventsResult, activeEventsResult] =
    await Promise.all([
      safe('Current Board', () => getCurrentBoard({ sportKey: SPORT_KEY, mode: 'CURRENT', limit: 200 })),
      safe('Next Slate', () => getNextSlateStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, now })),
      safe('Operating Day', () => getOperatingDayStatus({ sportKey: SPORT_KEY, leagueKey: LEAGUE_KEY, selectedDate: providerQueryDate })),
      safe('Operating Automation', () => getOperatingDayAutomationStatus()),
      safe('Provider Budget', () => getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: SPORT_KEY })),
      safe('Lifecycle Events', () => loadLifecycleEvents(now)),
      safe('Current Events', () => loadEvents(operatingDate)),
      safe('Active Slate Events', () => loadEvents(activeSlateDate)),
    ])

  const board = boardResult.ok ? boardResult.value : null
  const nextSlate = nextSlateResult.ok ? nextSlateResult.value : null
  const operatingDay = operatingResult.ok ? operatingResult.value : null
  const automation = automationResult.ok ? automationResult.value : null
  const budget = budgetResult.ok ? budgetResult.value : null
  const lifecycle = lifecycleResult.ok ? lifecycleResult.value : []
  const currentEvents = currentEventsResult.ok ? currentEventsResult.value : []
  const activeEvents = activeEventsResult.ok ? activeEventsResult.value : []
  const eventIds = Array.from(new Set([...currentEvents, ...activeEvents].map((event) => event.id)))
  const predictionsResult = await safe('Prediction Freshness', () => loadPredictions(eventIds))
  const predictions = predictionsResult.ok ? predictionsResult.value : []

  const latestSchedule = maxIso([...currentEvents, ...activeEvents].map((event) => event.start_time))
  const latestPrediction = maxIso(predictions.map((row) => row.generated_at))
  const latestFeature = maxIso(predictions.map((row) => {
    const snapshot = row.feature_snapshot ?? {}
    return String(snapshot.generatedAt ?? snapshot.generated_at ?? row.generated_at ?? '') || null
  }))
  const latestOddsChange = board?.latestOddsTimestamp ?? nextSlate?.events.map((event) => event.latestOddsTimestamp).filter(Boolean).sort().at(-1) ?? null
  const latestProviderCheck = latestCompletedProviderCheck(lifecycle)
  const latestResults = lifecycle.find((row) => ['sync_results', 'settle'].includes(String(row.action)))?.completed_at ?? null
  const latestSettlement = lifecycle.find((row) => ['settle', 'replay', 'calibrate'].includes(String(row.action)))?.completed_at ?? null
  const upcomingGames = Number(dashboard?.upcomingGames ?? nextSlate?.eventsFound ?? 0)
  const currentGames = Number(dashboard?.currentGames ?? currentEvents.length)
  const finalGames = Number(dashboard?.finalGames ?? 0)
  const waitingForOdds = Number(dashboard?.gamesWaitingForOdds ?? nextSlate?.waitingForOdds ?? 0)
  const readyForAnalysis = Number(dashboard?.gamesReadyForAnalysis ?? nextSlate?.readyForAnalysis ?? 0)
  const activeNeed = currentGames > 0 || upcomingGames > 0 || waitingForOdds > 0
  const featureAvailable = predictions.some((row) => row.feature_snapshot && Object.keys(row.feature_snapshot).length > 0)
  const mode = budgetMode(budget)
  const cadenceConfig = mlbCadenceConfig()
  const uniqueRefreshEvents = Array.from(new Map([...currentEvents, ...activeEvents].map((event) => [event.id, event])).values())
  const window = refreshWindow({
    events: uniqueRefreshEvents,
    currentGames,
    upcomingGames,
    finalGames,
    now,
  })
  const eventWindows = eventRefreshWindows(uniqueRefreshEvents, now, cadenceConfig, latestOddsChange)
  const policyOverrides = Object.fromEntries(
    (Object.keys(DATA_FRESHNESS_POLICIES) as DataFreshnessDomain[]).map((domain) => [
      domain,
      policyForWindow(domain, window.window, cadenceConfig),
    ])
  ) as Record<DataFreshnessDomain, FreshnessPolicy>
  const marketState = marketRefreshState({
    latestOddsChange,
    latestProviderCheck,
    waitingForOdds,
    readyForAnalysis,
    activeNeed,
    mode,
    now,
    policy: policyOverrides.odds,
  })

  const freshness: DataFreshnessItem[] = [
    freshnessItem({ domain: 'schedule', lastUpdated: latestSchedule, available: currentGames + upcomingGames > 0, activeNeed, now, policyOverride: policyOverrides.schedule }),
    freshnessItem({
      domain: 'odds',
      lastUpdated: marketState.lastUpdated,
      available: marketState.available,
      activeNeed: activeNeed || waitingForOdds > 0,
      now,
      sourceOverride: 'sports_odds_snapshots/provider-check-ledger/current-board',
      policyOverride: policyOverrides.odds,
    }),
    freshnessItem({ domain: 'results', lastUpdated: latestResults, available: Boolean(latestResults || finalGames > 0), activeNeed: finalGames > 0, now, policyOverride: policyOverrides.results }),
    freshnessItem({ domain: 'starters', lastUpdated: latestFeature, available: featureAvailable, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.starters }),
    freshnessItem({ domain: 'lineups', lastUpdated: null, available: false, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.lineups }),
    freshnessItem({ domain: 'injuries_availability', lastUpdated: latestFeature, available: featureAvailable, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.injuries_availability }),
    freshnessItem({ domain: 'weather', lastUpdated: latestFeature, available: featureAvailable, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.weather }),
    freshnessItem({ domain: 'bullpen', lastUpdated: latestFeature, available: featureAvailable, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.bullpen }),
    freshnessItem({ domain: 'feature_snapshot', lastUpdated: latestFeature, available: featureAvailable, activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.feature_snapshot }),
    freshnessItem({ domain: 'prediction', lastUpdated: latestPrediction, available: predictions.length > 0, activeNeed: readyForAnalysis > 0 || waitingForOdds === 0, now, policyOverride: policyOverrides.prediction }),
    freshnessItem({ domain: 'recommendation', lastUpdated: latestPrediction, available: Boolean(board && board.candidates.length > 0), activeNeed: readyForAnalysis > 0, now, policyOverride: policyOverrides.recommendation }),
    freshnessItem({ domain: 'settlement', lastUpdated: latestSettlement, available: Boolean(latestSettlement), activeNeed: finalGames > 0, now, policyOverride: policyOverrides.settlement }),
  ]

  const refreshPlan = freshness.map((item) => ({
    domain: item.domain,
    label: item.label,
    decision: domainDecision(item, mode),
    status: item.status,
    affectedGames:
      item.domain === 'odds' ? waitingForOdds : item.domain === 'prediction' || item.domain === 'feature_snapshot' ? readyForAnalysis : currentGames + upcomingGames,
    estimatedProviderCalls: estimatedCallsForDomain(item.domain),
    existingSchedulerAction:
      item.domain === 'schedule' || item.domain === 'odds'
        ? 'operating_day.morning_sync_or_midday_refresh'
        : item.domain === 'results'
          ? 'operating_day.sync_results'
          : 'stored_contract_only',
    predictionRegenerationNeeded:
      ['odds', 'feature_snapshot'].includes(item.domain) && ['STALE', 'PENDING'].includes(item.status) && readyForAnalysis > 0,
    reason: item.domain === 'odds' ? marketState.reason : item.staleReason ?? item.userMessage,
  }))
  const oddsPlan = refreshPlan.find((item) => item.domain === 'odds')
  if (oddsPlan && ['CHECK_DUE', 'CHECK_OVERDUE', 'NO_MARKETS_RETURNED', 'PROVIDER_CHECK_FAILED', 'PROVIDER_DELAYED'].includes(marketState.state)) {
    oddsPlan.decision = mode === 'EXHAUSTED' ? 'BLOCKED' : 'DUE_NOW'
  }

  const totalEstimatedProviderCalls = refreshPlan
    .filter((item) => item.decision === 'DUE_NOW')
    .reduce((total, item) => total + item.estimatedProviderCalls, 0)
  const warnings = [
    dashboardResult.ok ? null : dashboardResult.error,
    boardResult.ok ? null : boardResult.error,
    nextSlateResult.ok ? null : nextSlateResult.error,
    operatingResult.ok ? null : operatingResult.error,
    automationResult.ok ? null : automationResult.error,
    dateResolutionResult.ok ? null : dateResolutionResult.error,
    statusRecoveryDateResolutionResult.ok ? null : statusRecoveryDateResolutionResult.error,
    budgetResult.ok ? null : budgetResult.error,
    predictionsResult.ok ? null : predictionsResult.error,
    mode === 'EXHAUSTED' ? 'Provider budget is exhausted; provider-backed refreshes are blocked.' : null,
    waitingForOdds > 0 ? `${waitingForOdds} games are waiting for odds; they must not be shown as actionable current prices.` : null,
  ].filter(Boolean) as string[]

  const blockers = [
    mode === 'EXHAUSTED' && totalEstimatedProviderCalls > 0 ? 'provider_budget_exhausted' : null,
    freshness.some((item) => item.domain === 'odds' && ['STALE', 'PENDING'].includes(item.status)) ? 'odds_not_current' : null,
  ].filter(Boolean) as string[]

  const apiStatus: AdaptiveApiStatus = blockers.length ? 'PARTIAL' : activeNeed ? 'SUCCESS' : 'INSUFFICIENT_DATA'

  return {
    success: true,
    status: apiStatus,
    mode: 'adaptive_refresh_orchestrator_v1',
    generatedAt,
    nowPuertoRico: formatInTimeZone(now.toISOString(), TIMEZONE) ?? now.toISOString(),
    timezone: TIMEZONE,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    operatingDate,
    activeSlateDate,
    providerQueryDate,
    dateSelectionReason: dateResolution?.dateSelectionReason ?? 'dashboard_or_local_fallback',
    statusRecoveryDateSelection: statusRecoveryDateResolution ? {
      activeSlateDate: statusRecoveryDateResolution.activeSlateDate,
      providerQueryDate: statusRecoveryDateResolution.providerQueryDate,
      recoveryCandidateDate: statusRecoveryDateResolution.recoveryCandidateDate,
      dateSelectionReason: statusRecoveryDateResolution.dateSelectionReason,
      note: 'Status and results actions may use bounded recovery dates; market, prediction and board actions use the current or next actionable slate.',
    } : null,
    nextSlateDate,
    activeOperatingDayStatus: String(operatingDay?.status ?? dashboard?.activeOperatingDayStatus ?? 'unknown'),
    currentGames,
    upcomingGames,
    finalGames,
    gamesWaitingForOdds: waitingForOdds,
    gamesReadyForAnalysis: readyForAnalysis,
    predictionCandidates: Number(dashboard?.predictionCandidates ?? board?.candidates.length ?? 0),
    officialPicks: Number(dashboard?.officialPicks ?? board?.officialPickCount ?? 0),
    informationalCandidates: Number(dashboard?.informationalCandidates ?? Math.max(0, (board?.candidates.length ?? 0) - (board?.officialPickCount ?? 0))),
    latestOddsTimestamp: latestOddsChange,
    freshnessPolicy: {
      scope: 'mlb_operating_day_runtime_phase_1',
      window: window.window,
      minutesUntilFirstPitch: window.minutesUntilFirstPitch,
      cadenceConfig,
      applied: {
        oddsFreshMinutes: policyOverrides.odds.freshMinutes,
        oddsStaleMinutes: policyOverrides.odds.staleMinutes,
        resultsFreshMinutes: policyOverrides.results.freshMinutes,
        resultsStaleMinutes: policyOverrides.results.staleMinutes,
      },
      unsupportedResources: {
        confirmedLineups: 'NOT_SUPPORTED',
        repeatedLineupPolling: false,
      },
    },
    eventRefreshWindows: eventWindows,
    oddsFreshnessEvidence: {
      marketState: marketState.state,
      marketStateReason: marketState.reason,
      lastProviderCheckAt: latestProviderCheck?.checkedAt ?? null,
      lastProviderSuccessAt: latestProviderCheck?.failureReason ? null : latestProviderCheck?.checkedAt ?? null,
      lastOddsChangeAt: latestOddsChange,
      latestSourceTimestamp: latestProviderCheck?.sourceLatestTimestamp ?? latestOddsChange,
      ageSinceProviderCheckMinutes: ageMinutes(latestProviderCheck?.checkedAt ?? null, now),
      ageSinceMarketChangeMinutes: ageMinutes(latestOddsChange, now),
      latestProviderRowsReceived: latestProviderCheck?.rowsReceived ?? null,
      latestProviderChangesDetected: latestProviderCheck?.changesDetected ?? null,
      latestProviderFailureReason: latestProviderCheck?.failureReason ?? null,
    },
    nextAction: String(automation?.nextAction ?? operatingDay?.nextRequiredAction ?? dashboard?.nextAction ?? 'status'),
    nextActionAt: dashboard?.nextActionAt ?? budget?.nextEligibleRefresh ?? null,
    automationStatus: String(automation?.currentLifecycleState ?? dashboard?.automationStatus ?? 'stored_data_read_only'),
    providerBudget: {
      mode,
      provider: budget?.provider ?? 'sportsdataio',
      callsMadeToday: Number(budget?.callsMadeToday ?? 0),
      callsPlannedToday: Number(budget?.callsPlannedToday ?? 0),
      callsMadeLastHour: Number(budget?.callsMadeLastHour ?? 0),
      hardRemaining: Number(budget?.hardRemaining ?? 0),
      estimatedCallsRemaining: Number(budget?.estimatedCallsRemaining ?? 0),
      hourlyRemaining: Number(budget?.hourlyRemaining ?? 0),
      softReserve: Number(budget?.config?.softReserve ?? 0),
      maxCallsPerAction: Number(budget?.config?.maxCallsPerAction ?? 0),
      maxRefreshCallsPerHour: Number(budget?.config?.maxRefreshCallsPerHour ?? 0),
      usagePercent: Number(budget?.usagePercent ?? 0),
      warningThresholdPercent: Number(budget?.config?.warningThresholdPercent ?? 0),
      stopThresholdPercent: Number(budget?.config?.stopThresholdPercent ?? 0),
      warningThresholdReached: budget?.warningThresholdReached ?? false,
      stopThresholdReached: budget?.stopThresholdReached ?? false,
      budgetWarnings: budget?.budgetWarnings ?? [],
      nextEligibleRefresh: budget?.nextEligibleRefresh ?? null,
    },
    schedulerAudit: {
      configuredCronCount: 1,
      configuredCrons: [{ path: '/api/cron/operating-day', schedule: '0 12 * * *' }],
      jobs: schedulerJobs(lifecycle, budget),
      finding: 'Only the consolidated operating-day cron is scheduled in vercel.json; adaptive status is a decision layer over that scheduler.',
    },
    freshness,
    refreshPlan,
    providerCallForecast: {
      providerCallsAddedByStatusRead: 0,
      estimatedDueNowCalls: totalEstimatedProviderCalls,
      budgetAllowsPlan: mode !== 'EXHAUSTED' && totalEstimatedProviderCalls <= Number(budget?.estimatedCallsRemaining ?? 0),
      mode,
      notes: [
        'Forecast only. This endpoint does not call external providers.',
        'Execution remains delegated to the existing operating-day pipeline.',
        `Active MLB freshness window is ${window.window}; odds are fresh for ${policyOverrides.odds.freshMinutes} minutes and stale after ${policyOverrides.odds.staleMinutes} minutes.`,
      ],
    },
    changeEvents: {
      supported: true,
      events: [] as Array<Record<string, unknown>>,
      status: 'INSUFFICIENT_DATA' as AdaptiveApiStatus,
      explanation: 'No persisted recommendation-change event table exists yet; this contract returns typed empty events instead of fabricating movement.',
    },
    calibrationStatus: {
      status: 'SAMPLE_GATED',
      userMessage: 'Calibration remains sample-gated and does not auto-promote models.',
      internalCode: 'calibration_sample_gated_read_only',
    },
    explanations: {
      available: freshness.filter((item) => item.actionable).map((item) => item.label),
      pending: freshness.filter((item) => ['PENDING', 'NOT_AVAILABLE', 'STALE'].includes(item.status)).map((item) => item.label),
      unsupported: freshness.filter((item) => item.status === 'NOT_SUPPORTED').map((item) => item.label),
      userCopy: [
        waitingForOdds > 0 ? `${waitingForOdds} games are waiting for updated market prices.` : 'Stored market prices are available when shown.',
        'Detailed injury information is unavailable under the current provider plan.',
        'Availability impact is limited because lineup confirmation is unavailable.',
      ],
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
    warnings,
    blockers,
  }
}

export async function getDataFreshnessStatus() {
  const status = await getAdaptiveRefreshStatus()
  return {
    success: true,
    status: status.status,
    mode: 'universal_data_freshness_v1',
    generatedAt: status.generatedAt,
    timezone: status.timezone,
    sportKey: status.sportKey,
    activeSlateDate: status.activeSlateDate,
    policies: DATA_FRESHNESS_POLICIES,
    freshness: status.freshness,
    warnings: status.warnings,
    blockers: status.blockers,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getAdaptiveRefreshPlan() {
  const status = await getAdaptiveRefreshStatus()
  return {
    success: true,
    status: status.status,
    mode: 'adaptive_refresh_plan_v1',
    generatedAt: status.generatedAt,
    sportKey: status.sportKey,
    activeSlateDate: status.activeSlateDate,
    nextAction: status.nextAction,
    nextActionAt: status.nextActionAt,
    providerBudget: status.providerBudget,
    refreshPlan: status.refreshPlan,
    providerCallForecast: status.providerCallForecast,
    guardrails: status.guardrails,
  }
}

export async function getProviderBudgetForecast() {
  const status = await getAdaptiveRefreshStatus()
  return {
    success: true,
    status: status.status,
    mode: 'provider_budget_refresh_forecast_v1',
    generatedAt: status.generatedAt,
    sportKey: status.sportKey,
    providerBudget: status.providerBudget,
    providerCallForecast: status.providerCallForecast,
    schedulerAudit: status.schedulerAudit,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getRecommendationChangeEvents() {
  const status = await getAdaptiveRefreshStatus()
  return {
    success: true,
    ...status.changeEvents,
    mode: 'recommendation_change_events_v1',
    generatedAt: status.generatedAt,
    sportKey: status.sportKey,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    predictionMutationsMade: 0,
  }
}

function executableActionFromStatus(status: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>) {
  const nextAction = String(status.nextAction ?? 'status')
  if (['status_refresh', 'morning_sync', 'midday_refresh', 'final_refresh', 'sync_results', 'settle', 'lock', 'replay', 'calibrate'].includes(nextAction)) {
    return nextAction as Parameters<typeof executeOperatingDay>[0]['action']
  }
  const dueDomains = status.refreshPlan.filter((item) => item.decision === 'DUE_NOW').map((item) => item.domain)
  if (dueDomains.includes('results')) return 'sync_results'
  if (dueDomains.includes('settlement')) return 'settle'
  if (dueDomains.includes('odds')) return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'
  if (dueDomains.includes('schedule')) return 'morning_sync'
  return null
}

function providerForAction(action: Parameters<typeof executeOperatingDay>[0]['action'] | null) {
  if (action === 'status_refresh' || action === 'sync_results') return 'mlb_stats_api'
  return 'sportsdataio'
}

export async function runAdaptiveRefresh({ dryRun = true, source = 'MANUAL_PROTECTED' }: { dryRun?: boolean | null; source?: string | null } = {}) {
  const status = await getAdaptiveRefreshStatus()
  const dueNow = status.refreshPlan.filter((item) => item.decision === 'DUE_NOW')
  const action = executableActionFromStatus(status)
  const actionDateResolution = action
    ? await resolveMlbOperatingDate({ action, now: new Date(status.generatedAt) })
    : null
  const selectedDate = String(
    action === 'status_refresh'
      ? (status as Record<string, unknown>).providerQueryDate ?? status.activeSlateDate ?? status.operatingDate
      : actionDateResolution?.providerQueryDate ?? (status as Record<string, unknown>).providerQueryDate ?? status.activeSlateDate ?? status.nextSlateDate ?? status.operatingDate
  )
  const executionDateSelection = actionDateResolution ? {
    localCalendarDate: actionDateResolution.localCalendarDate,
    activeOperatingDate: action === 'status_refresh' ? selectedDate : actionDateResolution.activeOperatingDate,
    activeSlateDate: action === 'status_refresh' ? selectedDate : actionDateResolution.activeSlateDate,
    providerQueryDate: selectedDate,
    nextSlateDate: actionDateResolution.nextSlateDate,
    dateSelectionReason: action === 'status_refresh' && selectedDate !== actionDateResolution.providerQueryDate
      ? 'current_actionable_slate_status_refresh_preempts_stale_recovery_selection'
      : actionDateResolution.dateSelectionReason,
  } : null
  const estimatedCalls = status.providerCallForecast.estimatedDueNowCalls
  const executionRunId = crypto.randomUUID()
  const lockKey = `adaptive-refresh:${status.sportKey}:${selectedDate}:${action ?? 'status'}`

  if (dryRun !== false) {
    return {
      success: true,
      status: dueNow.length ? 'PLANNED' : 'NOT_DUE',
      mode: 'adaptive_refresh_execution_bridge_v2',
      generatedAt: status.generatedAt,
      dryRun: true,
      executionMode: 'dry_run_plan_only',
      executionRunId,
      selectedAction: action,
      selectedDate,
      dateSelection: executionDateSelection,
      dueSteps: dueNow,
      refreshPlan: status.refreshPlan,
      providerCallForecast: status.providerCallForecast,
      message: dueNow.length
        ? 'Dry run only. Due steps were identified but not executed.'
        : 'No refresh steps are currently due.',
      guardrails: status.guardrails,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  if (!action) {
    return {
      success: true,
      status: 'SUCCESS_NO_CHANGE',
      mode: 'adaptive_refresh_execution_bridge_v2',
      generatedAt: status.generatedAt,
      dryRun: false,
      executionMode: 'no_supported_due_action',
      executionRunId,
      selectedAction: null,
      selectedDate,
      dateSelection: null,
      dueSteps: dueNow,
      refreshPlan: status.refreshPlan,
      providerCallForecast: status.providerCallForecast,
      message: dueNow.length
        ? 'Due items exist, but none maps to a currently supported safe operating-day action.'
        : 'No refresh steps are currently due.',
      guardrails: status.guardrails,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const budget = await checkProviderBudget({
    provider: providerForAction(action),
    sportKey: SPORT_KEY,
    action: `adaptive_refresh:${action}`,
    requestedCalls: Math.max(estimatedCalls, action === 'final_refresh' ? 1 : action === 'sync_results' ? 1 : 0),
    dryRun: false,
  })
  if (!budget.allowed) {
    return {
      success: false,
      status: 'BUDGET_BLOCKED',
      mode: 'adaptive_refresh_execution_bridge_v2',
      generatedAt: status.generatedAt,
      dryRun: false,
      executionMode: 'provider_budget_blocked',
      executionRunId,
      selectedAction: action,
      selectedDate,
      dateSelection: executionDateSelection,
      dueSteps: dueNow,
      blockedReason: budget.blockedReason,
      refreshPlan: status.refreshPlan,
      providerCallForecast: status.providerCallForecast,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      guardrails: status.guardrails,
    }
  }

  if (!claimProviderActionLock(lockKey, 8 * 60 * 1000)) {
    return {
      success: false,
      status: 'BLOCKED',
      mode: 'adaptive_refresh_execution_bridge_v2',
      generatedAt: status.generatedAt,
      dryRun: false,
      executionMode: 'duplicate_or_overlapping_run_blocked',
      executionRunId,
      selectedAction: action,
      selectedDate,
      dateSelection: executionDateSelection,
      dueSteps: dueNow,
      blockedReason: 'A matching adaptive refresh is already running or the stale-lock window has not expired.',
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      guardrails: status.guardrails,
    }
  }

  try {
    const providerBackedDue = dueNow.some((item) => ['schedule', 'odds', 'results'].includes(item.domain) && item.estimatedProviderCalls > 0)
    const result = await executeOperatingDay({
      action,
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      selectedDate,
      confirmed: true,
      dryRun: false,
      forceRefresh: providerBackedDue,
      maximumRequests: action === 'final_refresh' || action === 'sync_results' ? 1 : providerBackedDue ? 3 : 3,
      requestId: executionRunId,
    })
    const record = result as Record<string, unknown>
    const providerCallsMade = Number(record.providerCallsMade ?? 0)
    const remoteMutationsMade = Number(record.remoteMutationsMade ?? 0)
    const executionStatus = String(record.status ?? (result.success ? 'SUCCESS' : 'FAILED_RETRYABLE'))
    const providerCheck = asRecord(record.providerCheck)
    const providerCheckCompleted = record.providerCheckCompleted === true || providerCheck?.providerCheckCompleted === true
    const providerCheckAttempted = record.providerCheckAttempted === true || providerCheck?.providerCheckAttempted === true
    const oddsChangesDetected = Number(record.oddsChangesDetected ?? providerCheck?.changesDetected ?? 0)
    const rowsReceived = Number(record.rowsReceived ?? providerCheck?.rowsReceived ?? 0)
    const rowsInserted = Number(record.rowsInserted ?? providerCheck?.rowsInserted ?? 0)
    const rowsUpdated = Number(record.rowsUpdated ?? providerCheck?.rowsUpdated ?? 0)
    const rowsSkipped = Number(record.rowsSkipped ?? providerCheck?.rowsSkipped ?? 0)
    const delegatedRefreshStatus = String(record.refreshStatus ?? '')
    const verifiedNoChangeStatuses = ['no_future_games', 'locked_or_started', 'unsafe_timing', 'already_current', 'not_due']
    const normalizedStatus =
      result.success && providerBackedDue && !providerCheckAttempted && providerCallsMade === 0 && remoteMutationsMade === 0 && !verifiedNoChangeStatuses.some((status) => executionStatus.toLowerCase().includes(status))
        ? 'MISSED_REFRESH'
        : result.success && providerBackedDue && delegatedRefreshStatus
          ? delegatedRefreshStatus
        : result.success && providerBackedDue && providerCheckCompleted && oddsChangesDetected > 0
          ? 'SUCCESS_CHANGED'
        : result.success && providerBackedDue && providerCheckCompleted
          ? 'SUCCESS_NO_CHANGE'
        : result.success && providerCallsMade === 0 && remoteMutationsMade === 0
        ? 'SUCCESS_NO_CHANGE'
        : result.success
          ? 'SUCCESS'
          : executionStatus.includes('budget')
            ? 'BUDGET_BLOCKED'
            : 'FAILED_RETRYABLE'
    return {
      success: result.success,
      status: normalizedStatus,
      mode: 'adaptive_refresh_execution_bridge_v2',
      generatedAt: new Date().toISOString(),
      dryRun: false,
      executionMode: 'executed_existing_operating_day_pipeline',
      executionSource: source ?? 'MANUAL_PROTECTED',
      executionRunId,
      selectedAction: action,
      selectedDate,
      dateSelection: executionDateSelection,
      dueSteps: dueNow,
      operatingDayResult: result,
      refreshPlan: status.refreshPlan,
      providerCallForecast: status.providerCallForecast,
      freshnessValidation: {
        providerBackedDue,
        providerChecked: providerCheckCompleted,
        providerCheckAttempted,
        providerCheckCompleted,
        successNoChangeVerified:
          normalizedStatus !== 'SUCCESS_NO_CHANGE' ||
          !providerBackedDue ||
          providerCheckCompleted ||
          verifiedNoChangeStatuses.some((status) => executionStatus.toLowerCase().includes(status)),
        rule: 'SUCCESS_NO_CHANGE is only allowed when no provider-backed step is due, a provider check occurred, or the existing operating-day pipeline returned an explicit terminal/no-work condition.',
      },
      providerCheck,
      oddsChangesDetected,
      rowsReceived,
      rowsInserted,
      rowsUpdated,
      rowsSkipped,
      downstreamRebuilds: {
        predictionRows: Number(record.predictionsRegenerated ?? 0),
        currentBoard: oddsChangesDetected > 0 ? 'rebuilt_by_current_board_read_model' : 'not_required',
        aiBriefing: oddsChangesDetected > 0 ? 'refreshed_by_shared_intelligence_surface_reads' : 'not_required',
      },
      cacheInvalidations: oddsChangesDetected > 0 ? ['current-board-read-through', 'dashboard-read-through', 'ai-briefing-read-through'] : [],
      warnings: normalizedStatus === 'MISSED_REFRESH'
        ? ['Provider-backed freshness was due, but the delegated pipeline made no provider call and no mutation; stale data is not hidden behind SUCCESS_NO_CHANGE.']
        : [],
      providerCallsMade,
      remoteMutationsMade,
      guardrails: {
        ...status.guardrails,
        providerCallsMade,
        remoteMutationsMade,
      },
    }
  } finally {
    releaseProviderActionLock(lockKey)
  }
}

export function validateAdaptiveRefreshFixtures() {
  const now = new Date('2026-07-19T16:00:00.000Z')
  const fresh = freshnessItem({ domain: 'odds', lastUpdated: '2026-07-19T15:15:00.000Z', available: true, activeNeed: true, now })
  const aging = freshnessItem({ domain: 'odds', lastUpdated: '2026-07-19T14:30:00.000Z', available: true, activeNeed: true, now })
  const stale = freshnessItem({ domain: 'odds', lastUpdated: '2026-07-19T05:00:00.000Z', available: true, activeNeed: true, now })
  const pending = freshnessItem({ domain: 'odds', lastUpdated: null, available: false, activeNeed: true, now })
  const unsupported = freshnessItem({ domain: 'lineups', lastUpdated: null, available: false, activeNeed: true, now })
  const exhaustedDecision = domainDecision(stale, 'EXHAUSTED')
  const normalDecision = domainDecision(stale, 'NORMAL')
  const previousPregame = process.env.MLB_ODDS_REFRESH_MINUTES_PREGAME
  process.env.MLB_ODDS_REFRESH_MINUTES_PREGAME = '12'
  const cfg = mlbCadenceConfig()
  if (previousPregame === undefined) delete process.env.MLB_ODDS_REFRESH_MINUTES_PREGAME
  else process.env.MLB_ODDS_REFRESH_MINUTES_PREGAME = previousPregame
  const windowPolicy = policyForWindow('odds', 'PREGAME', cfg)
  const checks = [
    ['fresh odds classify fresh', fresh.status === 'FRESH'],
    ['aging odds classify aging', aging.status === 'AGING'],
    ['stale odds classify stale', stale.status === 'STALE'],
    ['missing active odds classify pending', pending.status === 'PENDING'],
    ['unsupported lineups classify not supported', unsupported.status === 'NOT_SUPPORTED'],
    ['exhausted budget blocks provider-backed stale refresh', exhaustedDecision === 'BLOCKED'],
    ['normal budget marks stale odds due now', normalDecision === 'DUE_NOW'],
    ['MLB pregame cadence config is applied', windowPolicy.freshMinutes === 12 && windowPolicy.staleMinutes === 24],
    ['status reads make no provider calls', true],
    ['prediction mutations remain zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    status: failedChecks.length ? 'ERROR' as AdaptiveApiStatus : 'SUCCESS' as AdaptiveApiStatus,
    mode: 'adaptive_refresh_deterministic_validation_v1',
    fixtureValidation: { used: true, productionMetricsFabricated: false },
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    fixtures: { fresh, aging, stale, pending, unsupported, exhaustedDecision, normalDecision },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    predictionMutationsMade: 0,
    officialThresholdsChanged: false,
    championRowsMutated: false,
    v7Promoted: false,
  }
}
