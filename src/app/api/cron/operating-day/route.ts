import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getOperatingDayAutomationStatus } from '@/services/operating-day-automation.service'
import { executeOperatingDay } from '@/services/operating-day.service'
import { runAdaptiveRefresh } from '@/services/adaptive-refresh-orchestrator.service'

const CRON_STATUS_HTTP: Record<string, number> = {
  SUCCESS: 200,
  SUCCESS_CHANGED: 200,
  SUCCESS_NO_CHANGE: 200,
  NOT_DUE: 200,
  PLANNED: 200,
  BUDGET_BLOCKED: 409,
  BLOCKED: 423,
  MISSED_REFRESH: 207,
  FAILED_RETRYABLE: 502,
  completed: 200,
  no_op: 200,
  already_current: 200,
  waiting: 200,
  locked: 200,
  quota_blocked: 409,
  provider_error: 502,
  partial: 207,
  invalid_stage: 400,
  configuration_error: 500,
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized operating-day cron request.', status: 401 })
  }
  const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'
  let status = {} as Awaited<ReturnType<typeof getOperatingDayAutomationStatus>>
  try {
    const adaptive = await runAdaptiveRefresh({
      dryRun,
      source: request.method === 'POST' ? 'PRODUCTION_CRON' : 'VERCEL_CRON',
    })
    const adaptiveRecord = adaptive as Record<string, unknown>
    const adaptiveStatus = String(adaptiveRecord.status ?? (adaptive.success ? 'SUCCESS' : 'FAILED_RETRYABLE'))
    return apiOk(
      {
        ...adaptive,
        mode: 'operating_day_consolidated_cron_execution_v2',
        delegatedMode: adaptive.mode,
        status: adaptiveStatus,
        retryable: ['FAILED_RETRYABLE', 'MISSED_REFRESH', 'BUDGET_BLOCKED', 'BLOCKED'].includes(adaptiveStatus),
        writes: Number(adaptiveRecord.remoteMutationsMade ?? 0),
        schedulerContract: {
          route: '/api/cron/operating-day',
          executionEngine: 'adaptive_refresh_execution_bridge_v2',
          overlapProtection: 'provider_action_lock',
          providerBudgetGuarded: true,
          refreshWindowGuarded: true,
          providerCallsMadeByDryRun: dryRun ? 0 : undefined,
          legacyAutomationShortCircuitBypassed: true,
        },
      },
      id,
      { status: CRON_STATUS_HTTP[adaptiveStatus] ?? (adaptive.success ? 200 : 409) }
    )

    status = await getOperatingDayAutomationStatus()
    if (!status) throw new Error('Operating-day automation status unavailable.')
    if (dryRun) {
      return apiOk({ ...status, mode: 'operating_day_consolidated_cron_dry_run_v1', dryRun: true }, id)
    }
    if (!status.selectedSlateDate) {
      return apiOk(
        {
          success: true,
          mode: 'operating_day_consolidated_cron_execution_v1',
          dryRun: false,
          status: 'waiting',
          retryable: true,
          selectedDate: null,
          selectedAction: null,
          currentStage: status.currentStage,
          nextAction: status.nextAction,
          nextActionReason: status.nextActionReason,
          dateSelection: {
            localCalendarDate: status.localCalendarDate,
            activeOperatingDate: status.activeOperatingDate,
            activeSlateDate: status.activeSlateDate,
            providerQueryDate: status.providerQueryDate,
            nextSlateDate: status.nextSlateDate,
            dateSelectionReason: status.dateSelectionReason,
          },
          consecutiveSameActionCount: status.consecutiveSameActionCount,
          actionStuck: status.actionStuck,
          providerCallsMade: 0,
          writes: 0,
          warnings: ['No upcoming MLB slate is currently available.'],
          schedulerStatus: status,
        },
        id
      )
    }
    if (status.nextAction === 'status' || status.currentLifecycleState === 'ready_for_analysis') {
      return apiOk(
        {
          success: true,
          mode: 'operating_day_consolidated_cron_execution_v1',
          dryRun: false,
          status: 'already_current',
          retryable: false,
          selectedAction: 'status',
          selectedDate: status.selectedSlateDate,
          operatingDayId: status.operatingDayId,
          currentStage: status.currentStage,
          nextAction: status.nextAction,
          nextActionReason: status.nextActionReason,
          dateSelection: {
            localCalendarDate: status.localCalendarDate,
            activeOperatingDate: status.activeOperatingDate,
            activeSlateDate: status.activeSlateDate,
            providerQueryDate: status.providerQueryDate,
            nextSlateDate: status.nextSlateDate,
            dateSelectionReason: status.dateSelectionReason,
          },
          consecutiveSameActionCount: status.consecutiveSameActionCount,
          actionStuck: status.actionStuck,
          providerCallsMade: 0,
          writes: 0,
          warnings: [],
          summary: {
            eventsFound: status.eventsFound,
            staleEvents: status.staleEvents,
            activeCandidates: status.activeCandidates,
            officialPicks: status.officialPicks,
            latestOddsTimestamp: status.latestOddsTimestamp,
          },
          schedulerStatus: status,
        },
        id
      )
    }
    const action = status.nextAction as Parameters<typeof executeOperatingDay>[0]['action']
    const result = await executeOperatingDay({
      action,
      sportKey: 'baseball_mlb',
      leagueKey: 'mlb',
      selectedDate: status.selectedSlateDate,
      confirmed: true,
      dryRun: false,
      maximumRequests: action === 'status_refresh' || action === 'final_refresh' || action === 'sync_results' ? 1 : 3,
      requestId: id,
    })
    const resultRecord = result as Record<string, unknown>
    const executionStatus = String(resultRecord.status ?? (result.success ? 'completed' : 'partial'))
    const normalizedStatus =
      result.success && Number(resultRecord.providerCallsMade ?? 0) === 0 && executionStatus === 'morning_synced'
        ? 'already_current'
        : result.success
          ? 'completed'
          : executionStatus === 'provider_budget_blocked'
            ? 'quota_blocked'
            : executionStatus.includes('provider')
              ? 'provider_error'
              : 'partial'
    return apiOk(
      {
        success: result.success,
        mode: 'operating_day_consolidated_cron_execution_v1',
        dryRun: false,
        status: normalizedStatus,
        retryable: ['provider_error', 'partial', 'quota_blocked'].includes(normalizedStatus),
        selectedAction: action,
        selectedDate: String(resultRecord.selectedDate ?? status.selectedSlateDate),
        operatingDayId: String(resultRecord.operatingDayId ?? status.operatingDayId ?? ''),
        currentStage: status.currentStage,
        nextAction: status.nextAction,
        nextActionReason: status.nextActionReason,
        dateSelection: {
          localCalendarDate: status.localCalendarDate,
          activeOperatingDate: status.activeOperatingDate,
          activeSlateDate: status.activeSlateDate,
          providerQueryDate: status.providerQueryDate,
          nextSlateDate: status.nextSlateDate,
          dateSelectionReason: status.dateSelectionReason,
        },
        consecutiveSameActionCount: status.consecutiveSameActionCount,
        actionStuck: status.actionStuck,
        providerCallsMade: Number(resultRecord.providerCallsMade ?? 0),
        writes: Number(resultRecord.remoteMutationsMade ?? 0),
        warnings: Array.isArray(resultRecord.warnings) ? resultRecord.warnings : [],
        execution: {
          mode: resultRecord.mode,
          status: resultRecord.status,
          eventsLinked: resultRecord.eventsLinked,
          eventsReceived: resultRecord.eventsReceived,
          snapshotsInserted: resultRecord.snapshotsInserted,
          snapshotsReused: resultRecord.snapshotsReused,
          featuresGenerated: resultRecord.featuresGenerated,
          predictionsGenerated: resultRecord.predictionsGenerated,
          candidatesGenerated: resultRecord.candidatesGenerated,
          officialPicks: resultRecord.officialPicks,
          provider: resultRecord.provider,
          endpoint: resultRecord.endpoint,
          providerCheckRequired: resultRecord.providerCheckRequired,
          providerCheckAttempted: resultRecord.providerCheckAttempted,
          providerCheckCompleted: resultRecord.providerCheckCompleted,
          rowsReceived: resultRecord.rowsReceived,
          statusesChanged: resultRecord.statusesChanged,
          rowsUpdated: resultRecord.rowsUpdated,
          rowsSkipped: resultRecord.rowsSkipped,
          gamesMatched: resultRecord.gamesMatched,
          finalGamesDetected: resultRecord.finalGamesDetected,
          scoreRowsInserted: resultRecord.scoreRowsInserted,
          scoreRowsUpdated: resultRecord.scoreRowsUpdated,
          nonFinalRowsSkipped: resultRecord.nonFinalRowsSkipped,
          staleRowsSkipped: resultRecord.staleRowsSkipped,
          unmatchedEvents: resultRecord.unmatchedEvents,
          failureReason: resultRecord.failureReason,
        },
        schedulerStatus: status,
      },
      id,
      { status: CRON_STATUS_HTTP[normalizedStatus] ?? (result.success ? 200 : 409) }
    )
  } catch (error) {
    const message = errorMessage(error, 'Unknown operating-day cron error')
    return apiOk(
      {
        success: false,
        mode: 'operating_day_consolidated_cron_execution_v1',
        dryRun,
        status: 'configuration_error',
        retryable: true,
        selectedAction: status?.nextAction ?? null,
        selectedDate: status?.selectedSlateDate ?? null,
        operatingDayId: status?.operatingDayId ?? null,
        currentStage: status?.currentStage ?? null,
        nextAction: status?.nextAction ?? null,
        nextActionReason: status?.nextActionReason ?? null,
        dateSelection: status ? {
          localCalendarDate: status.localCalendarDate,
          activeOperatingDate: status.activeOperatingDate,
          activeSlateDate: status.activeSlateDate,
          providerQueryDate: status.providerQueryDate,
          nextSlateDate: status.nextSlateDate,
          dateSelectionReason: status.dateSelectionReason,
        } : null,
        consecutiveSameActionCount: status?.consecutiveSameActionCount ?? null,
        actionStuck: status?.actionStuck ?? null,
        providerCallsMade: 0,
        writes: 0,
        warnings: [message],
        error: {
          code: 'CRON_EXECUTION_FAILED',
          message,
        },
        schedulerStatus: status,
      },
      id,
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
