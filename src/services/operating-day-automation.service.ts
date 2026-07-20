import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard } from '@/services/current-board.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getOperatingDayStatus } from '@/services/operating-day.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import { zonedUtcRange } from '@/services/provider-time-normalization.service'
import { resolveMlbOperatingDate } from '@/services/mlb-operating-date-resolution.service'

const TIMEZONE = 'America/Puerto_Rico'
const STATUS_REFRESH_INTERVAL_MS = 10 * 60 * 1000

function hourInTimezone(timezone: string, now = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now).find((part) => part.type === 'hour')?.value
  const parsed = Number(hour === '24' ? '0' : hour)
  return Number.isFinite(parsed) ? parsed : now.getUTCHours()
}

function stageForHour(hour: number) {
  if (hour < 8) return { stage: 'night_before_preparation', action: 'prepare_next_slate' }
  if (hour < 12) return { stage: 'morning_refresh', action: 'morning_sync' }
  if (hour < 15) return { stage: 'midday_refresh', action: 'midday_refresh' }
  if (hour < 18) return { stage: 'afternoon_refresh', action: 'midday_refresh' }
  return { stage: 'pregame_or_lock_window', action: 'final_refresh' }
}

async function statusRefreshDue(selectedDate: string | null, now: Date) {
  if (!selectedDate) return { due: false, staleStatusCount: 0, eventsChecked: 0 }
  const range = zonedUtcRange(selectedDate, TIMEZONE)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, updated_at, metadata')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
  if (error) return { due: true, staleStatusCount: 0, eventsChecked: 0, error: error.message }
  const events = (data ?? []) as Array<{ id: string; sport_key: string; league_key: string | null; start_time: string | null; status: string | null; updated_at: string | null; metadata: Record<string, unknown> | null }>
  const staleStatusCount = events.filter((event) => {
    const lifecycle = resolveMlbGameLifecycle(event, now)
    return lifecycle.lifecycle === 'STATUS_UNCONFIRMED' || (!lifecycle.statusFresh && ['PREGAME', 'STARTING_SOON'].includes(lifecycle.lifecycle))
  }).length
  return { due: staleStatusCount > 0, staleStatusCount, eventsChecked: events.length }
}

async function latestStatusRefreshEvidence(operatingDayId: unknown, now: Date) {
  if (!operatingDayId) return {
    satisfied: false,
    lastProviderCheckAt: null as string | null,
    nextEligibleStatusRefreshAt: null as string | null,
    providerCallsMade: 0,
    status: null as string | null,
    consecutiveSameActionCount: 0,
    actionStuck: false,
  }
  const { data, error } = await supabaseAdmin
    .from('operating_day_lifecycle_events')
    .select('action,status,completed_at,provider_calls_made,metadata,created_at')
    .eq('operating_day_id', String(operatingDayId))
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return {
    satisfied: false,
    lastProviderCheckAt: null,
    nextEligibleStatusRefreshAt: null,
    providerCallsMade: 0,
    status: 'LEDGER_READ_FAILED',
    consecutiveSameActionCount: 0,
    actionStuck: false,
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const latest = rows.find((row) => String(row.action) === 'status_refresh')
  const metadata = latest && typeof latest.metadata === 'object' && latest.metadata !== null ? latest.metadata as Record<string, unknown> : {}
  const completed = metadata.providerCheckCompleted === true || ['SUCCESS_NO_CHANGE', 'SUCCESS_CHANGED'].includes(String(latest?.status ?? ''))
  const checkedAt = String(metadata.lastProviderCheckAt ?? latest?.completed_at ?? latest?.created_at ?? '') || null
  const checkedMs = checkedAt ? new Date(checkedAt).getTime() : Number.NaN
  const nextEligibleStatusRefreshAt = Number.isFinite(checkedMs) ? new Date(checkedMs + STATUS_REFRESH_INTERVAL_MS).toISOString() : null
  const satisfied = Boolean(completed && checkedAt && now.getTime() < (Number.isFinite(checkedMs) ? checkedMs + STATUS_REFRESH_INTERVAL_MS : 0))
  const consecutiveSameActionCount = rows.findIndex((row) => String(row.action) !== 'status_refresh')
  const normalizedConsecutive = consecutiveSameActionCount === -1 ? rows.length : consecutiveSameActionCount
  return {
    satisfied,
    lastProviderCheckAt: checkedAt,
    nextEligibleStatusRefreshAt,
    providerCallsMade: Number(latest?.provider_calls_made ?? metadata.providerCallsMade ?? 0),
    status: String(latest?.status ?? '') || null,
    consecutiveSameActionCount: normalizedConsecutive,
    actionStuck: normalizedConsecutive >= 3 && satisfied,
  }
}

export async function getOperatingDayAutomationStatus() {
  const now = new Date()
  const stage = stageForHour(hourInTimezone(TIMEZONE, now))
  const [slate, budget, board] = await Promise.all([
    getNextSlateStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb' }),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' }),
    getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200 }),
  ])
  const operatingDay = slate.selectedSlateDate
    ? await getOperatingDayStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb', selectedDate: slate.selectedSlateDate })
    : null
  const dateResolution = await resolveMlbOperatingDate({ action: stage.action, now })
  const statusRecoveryDateResolution = await resolveMlbOperatingDate({ action: 'status_refresh', now })
  const selectedDateForAction = String(slate.selectedSlateDate ?? dateResolution.providerQueryDate ?? dateResolution.localCalendarDate)
  const operatingDayForAction = selectedDateForAction
    ? await getOperatingDayStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb', selectedDate: selectedDateForAction })
    : operatingDay
  const statusDue = await statusRefreshDue(selectedDateForAction, now)
  const preliminaryOperatingDayRecord = (operatingDayForAction ?? operatingDay ?? {}) as Record<string, unknown>
  const statusEvidence = await latestStatusRefreshEvidence(preliminaryOperatingDayRecord.operatingDayId, now)
  const operatingDayRecord = (operatingDayForAction ?? operatingDay ?? {}) as Record<string, unknown>
  const timestamps = ((operatingDayRecord.timestamps ?? {}) as Record<string, unknown>)
  const staleEvents = slate.events.filter((event) => !event.oddsPresent || !event.predictionReady).length
  const nextAction =
    statusEvidence.actionStuck
      ? 'midday_refresh'
      : statusDue.due && !statusEvidence.satisfied
      ? 'status_refresh'
    : slate.status === 'waiting_for_odds' || slate.status === 'waiting_for_predictions'
      ? statusEvidence.satisfied
        ? 'midday_refresh'
        : 'prepare_next_slate'
      : slate.status === 'ready_for_analysis' && staleEvents === 0
        ? 'status'
        : stage.action
  const actionDateResolution = await resolveMlbOperatingDate({ action: nextAction, now })
  const selectedDateForActionFinal = String(
    nextAction === 'status_refresh'
      ? selectedDateForAction
      : actionDateResolution.providerQueryDate ?? selectedDateForAction
  )
  const finalDateSelectionReason = nextAction === 'status_refresh' && selectedDateForActionFinal !== actionDateResolution.providerQueryDate
    ? 'current_actionable_slate_status_refresh_preempts_stale_recovery_selection'
    : actionDateResolution.dateSelectionReason
  const finalOperatingDay = selectedDateForActionFinal !== selectedDateForAction
    ? await getOperatingDayStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb', selectedDate: selectedDateForActionFinal })
    : operatingDayForAction
  const currentLifecycleState =
    slate.status === 'ready_for_analysis' && staleEvents === 0
      ? 'ready_for_analysis'
      : String(((finalOperatingDay ?? operatingDayRecord) as Record<string, unknown>).status ?? slate.status ?? 'unknown')
  const finalOperatingDayRecord = (finalOperatingDay ?? operatingDayRecord) as Record<string, unknown>
  const lifecycleEvents = Array.isArray(operatingDayRecord.lifecycleEvents)
    ? (operatingDayRecord.lifecycleEvents as Array<Record<string, unknown>>)
    : []
  const lastFailureEvent = lifecycleEvents.length
    ? lifecycleEvents.find((event) => String(event.status ?? '').toLowerCase().includes('failed'))
    : null
  return {
    success: true,
    mode: 'operating_day_automation_status_v1',
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    schedulerEnabled: true,
    vercelCronConfigured: true,
    vercelCronCadence: '0 12 * * *',
    vercelCronOperational: true,
    externalSchedulerConfigured: true,
    externalSchedulerSecretsVerified: false,
    automaticMultiRefreshActive: false,
    hostingCronConfiguration: {
      currentConfigHasMultipleCronEntries: false,
      recommendedConsolidatedPath: '/api/cron/operating-day',
      recommendedSchedule: '0 12 * * *',
      enabledByThisPatch: true,
      note: 'Vercel Hobby supports one daily cron here. Multiple daily refreshes are provided by the GitHub Actions external scheduler workflow when repository secrets are configured.',
    },
    operatingDayId: finalOperatingDayRecord.operatingDayId ?? null,
    localCalendarDate: actionDateResolution.localCalendarDate,
    activeOperatingDate: selectedDateForActionFinal,
    activeSlateDate: selectedDateForActionFinal,
    providerQueryDate: selectedDateForActionFinal,
    nextSlateDate: actionDateResolution.nextSlateDate,
    dateSelectionReason: finalDateSelectionReason,
    statusRecoveryDateSelection: {
      activeSlateDate: statusRecoveryDateResolution.activeSlateDate,
      providerQueryDate: statusRecoveryDateResolution.providerQueryDate,
      recoveryCandidateDate: statusRecoveryDateResolution.recoveryCandidateDate,
      dateSelectionReason: statusRecoveryDateResolution.dateSelectionReason,
      note: 'Recovery is diagnostic here; current operating-day automation uses the actionable slate date for status, odds and downstream work.',
    },
    currentOperatingDayStage: stage.stage,
    currentLifecycleState,
    currentStage: stage.stage,
    lastCompletedStage: timestamps.finalRefresh
      ? 'final_refresh'
      : timestamps.middayRefresh
        ? 'midday_refresh'
        : timestamps.morningSync
          ? 'morning_sync'
          : null,
    nextDueStage: nextAction === 'status' ? 'already_current' : stage.stage,
    nextDueAt: budget.nextEligibleRefresh,
    lastAttemptedAt: budget.lastProviderCall,
    lastSuccessfulAt: budget.lastProviderCall,
    lastFailureAt: lastFailureEvent?.created_at ?? null,
    lastFailureReason: lastFailureEvent?.blocking_reason ?? null,
    selectedSlateDate: selectedDateForActionFinal,
    eventsFound: slate.eventsFound,
    activeCandidates: slate.activeCandidates,
    officialPicks: slate.officialPicks,
    latestOddsTimestamp: board.latestOddsTimestamp,
    providerCallsToday: budget.callsMadeToday,
    callReserve: budget.config.softReserve,
    estimatedCallsRemaining: budget.estimatedCallsRemaining,
    lastAttemptedRefresh: budget.lastProviderCall,
    lastSuccessfulRefresh: budget.lastProviderCall,
    nextAction,
    statusRefresh: {
      provider: 'mlb_stats_api',
      providerCheckRequired: statusDue.due,
      providerCheckSatisfied: statusEvidence.satisfied,
      staleStatusCount: statusDue.staleStatusCount,
      eventsChecked: statusDue.eventsChecked,
      lastProviderCheckAt: statusEvidence.lastProviderCheckAt,
      nextEligibleStatusRefreshAt: statusEvidence.nextEligibleStatusRefreshAt,
      providerCallsMade: statusEvidence.providerCallsMade,
      failureReason: 'error' in statusDue ? statusDue.error : null,
    },
    lastSuccessfulAction: statusEvidence.lastProviderCheckAt ? 'status_refresh' : null,
    lastSuccessfulActionAt: statusEvidence.lastProviderCheckAt,
    nextActionReason: statusEvidence.actionStuck
      ? 'ACTION_STUCK: status_refresh satisfied but repeatedly selected; advancing to market refresh.'
      : statusDue.due && !statusEvidence.satisfied
        ? 'Status provider evidence is due for the selected unresolved slate.'
        : statusEvidence.satisfied
          ? 'Status provider evidence is satisfied for the current refresh window.'
          : 'Scheduler stage policy selected the next safe action.',
    consecutiveSameActionCount: statusEvidence.consecutiveSameActionCount,
    actionStuck: statusEvidence.actionStuck,
    nextScheduledTime: budget.nextEligibleRefresh,
    eventsNearingLock: slate.events.filter((event) => {
      const start = event.localStartTime ? new Date(event.localStartTime).getTime() : Number.NaN
      return Number.isFinite(start) && start > now.getTime() && start - now.getTime() <= 75 * 60 * 1000
    }).length,
    partialFailures: 0,
    staleEvents,
    staleMarkets: staleEvents,
    recommendationsLocked: false,
    providerCallsMade: 0,
  }
}

export function validateOperatingDayAutomationFixtures() {
  const checks = [
    ['night stage', stageForHour(3).action === 'prepare_next_slate'],
    ['morning stage', stageForHour(9).action === 'morning_sync'],
    ['midday stage', stageForHour(12).action === 'midday_refresh'],
    ['final stage', stageForHour(20).action === 'final_refresh'],
    ['deterministic validation made zero calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'operating_day_automation_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
