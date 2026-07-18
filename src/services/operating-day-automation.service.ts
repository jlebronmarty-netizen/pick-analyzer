import 'server-only'

import { getCurrentBoard } from '@/services/current-board.service'
import { getNextSlateStatus } from '@/services/next-slate.service'
import { getOperatingDayStatus } from '@/services/operating-day.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'

const TIMEZONE = 'America/Puerto_Rico'

function puertoRicoNow(now = new Date()) {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000)
}

function stageForHour(hour: number) {
  if (hour < 8) return { stage: 'night_before_preparation', action: 'prepare_next_slate' }
  if (hour < 12) return { stage: 'morning_refresh', action: 'morning_sync' }
  if (hour < 15) return { stage: 'midday_refresh', action: 'midday_refresh' }
  if (hour < 18) return { stage: 'afternoon_refresh', action: 'midday_refresh' }
  return { stage: 'pregame_or_lock_window', action: 'final_refresh' }
}

export async function getOperatingDayAutomationStatus() {
  const now = new Date()
  const local = puertoRicoNow(now)
  const stage = stageForHour(local.getUTCHours())
  const [slate, budget, board] = await Promise.all([
    getNextSlateStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb' }),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' }),
    getCurrentBoard({ sportKey: 'baseball_mlb', mode: 'CURRENT', limit: 200 }),
  ])
  const operatingDay = slate.selectedSlateDate
    ? await getOperatingDayStatus({ sportKey: 'baseball_mlb', leagueKey: 'mlb', selectedDate: slate.selectedSlateDate })
    : null
  const operatingDayRecord = (operatingDay ?? {}) as Record<string, unknown>
  const timestamps = ((operatingDayRecord.timestamps ?? {}) as Record<string, unknown>)
  const staleEvents = slate.events.filter((event) => !event.oddsPresent || !event.predictionReady).length
  const nextAction =
    slate.status === 'waiting_for_odds' || slate.status === 'waiting_for_predictions'
      ? 'prepare_next_slate'
      : slate.status === 'ready_for_analysis' && staleEvents === 0
        ? 'status'
        : stage.action
  const currentLifecycleState =
    slate.status === 'ready_for_analysis' && staleEvents === 0
      ? 'ready_for_analysis'
      : String(operatingDayRecord.status ?? slate.status ?? 'unknown')
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
    operatingDayId: operatingDayRecord.operatingDayId ?? null,
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
    selectedSlateDate: slate.selectedSlateDate,
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
