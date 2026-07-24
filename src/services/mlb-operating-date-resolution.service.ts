import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { ACTIVE_EVENT_TIMEZONE, isCanceledEventStatus, isFinalEventStatus, isPostponedEventStatus, puertoRicoLocalDateFromUtc, puertoRicoUtcRange } from '@/services/active-event.service'
import { resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import { zonedUtcRange } from '@/services/provider-time-normalization.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const TIMEZONE = ACTIVE_EVENT_TIMEZONE

type DateResolutionAction =
  | 'status_refresh'
  | 'sync_results'
  | 'prepare_next_slate'
  | 'next_slate_preview'
  | 'resolve_next_slate'
  | 'morning_sync'
  | 'midday_refresh'
  | 'final_refresh'
  | string

type StoredEvent = {
  id: string
  sport_key: string
  league_key: string | null
  start_time: string | null
  status: string | null
  updated_at: string | null
  metadata: Record<string, unknown> | null
}

function localDate(now: Date) {
  return puertoRicoLocalDateFromUtc(now.toISOString()) ?? now.toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const parsed = new Date(zonedUtcRange(date, TIMEZONE).utcStart)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return puertoRicoLocalDateFromUtc(parsed.toISOString()) ?? date
}

function terminalStatus(status: string | null | undefined) {
  return isFinalEventStatus(status) || isPostponedEventStatus(status) || isCanceledEventStatus(status)
}

function unresolvedEvent(event: StoredEvent, now: Date) {
  if (terminalStatus(event.status)) return false
  const lifecycle = resolveMlbGameLifecycle(event, now)
  return !['FINAL', 'POSTPONED', 'CANCELED'].includes(lifecycle.lifecycle)
}

function actionUsesNextSlate(action: DateResolutionAction) {
  return ['prepare_next_slate', 'next_slate_preview', 'resolve_next_slate'].includes(action)
}

function actionUsesRecoverySlate(action: DateResolutionAction) {
  return ['status_refresh', 'sync_results'].includes(action)
}

function actionUsesCurrentActionableSlate(action: DateResolutionAction) {
  return [
    'morning_sync',
    'midday_refresh',
    'final_refresh',
    'odds_refresh',
    'prediction_refresh',
    'recommendation_refresh',
    'current_board_refresh',
  ].includes(action)
}

function eventCutoffMs(event: StoredEvent) {
  const startMs = event.start_time ? Date.parse(event.start_time) : Number.NaN
  return Number.isFinite(startMs) ? startMs - 10 * 60 * 1000 : Number.NaN
}

function pregameActionableEvent(event: StoredEvent, now: Date) {
  if (terminalStatus(event.status)) return false
  const cutoffMs = eventCutoffMs(event)
  if (!Number.isFinite(cutoffMs) || cutoffMs <= now.getTime()) return false
  const lifecycle = resolveMlbGameLifecycle(event, now)
  return ['PREGAME', 'STARTING_SOON'].includes(lifecycle.lifecycle)
}

async function loadEvents(now: Date, searchBackDays: number, searchForwardDays: number) {
  const today = localDate(now)
  const startDate = addDays(today, -Math.max(0, searchBackDays))
  const endDate = addDays(today, Math.max(1, searchForwardDays) + 1)
  const startRange = puertoRicoUtcRange(startDate)
  const endRange = puertoRicoUtcRange(endDate)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, start_time, status, updated_at, metadata')
    .eq('sport_key', SPORT_KEY)
    .eq('league_key', LEAGUE_KEY)
    .gte('start_time', startRange.utcStart)
    .lt('start_time', endRange.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB operating date event read failed: ${error.message}`)
  return (data ?? []) as StoredEvent[]
}

export async function resolveMlbOperatingDate({
  action = 'status',
  now = new Date(),
  searchBackDays = 7,
  searchForwardDays = 7,
  recoveryWindowDays = 2,
}: {
  action?: DateResolutionAction | null
  now?: Date
  searchBackDays?: number
  searchForwardDays?: number
  recoveryWindowDays?: number
} = {}) {
  const localCalendarDate = localDate(now)
  const rows = await loadEvents(now, searchBackDays, searchForwardDays)
  const byDate = new Map<string, StoredEvent[]>()
  for (const row of rows) {
    const date = puertoRicoLocalDateFromUtc(row.start_time ?? '')
    if (!date) continue
    byDate.set(date, [...(byDate.get(date) ?? []), row])
  }

  const dates = [...byDate.keys()].sort()
  const unresolvedDates = dates
    .filter((date) => date <= localCalendarDate)
    .map((date) => ({ date, events: byDate.get(date) ?? [] }))
    .filter((entry) => entry.events.some((event) => unresolvedEvent(event, now)))
  const recoveryBoundaryDate = addDays(localCalendarDate, -Math.max(0, recoveryWindowDays))
  const staleOrphanDates = unresolvedDates.filter((entry) => entry.date < recoveryBoundaryDate)
  const recoveryEligibleDates = unresolvedDates.filter((entry) => entry.date >= recoveryBoundaryDate && entry.date < localCalendarDate)
  const recoveryCandidateDate = recoveryEligibleDates[0]?.date ?? null
  const oldestUnresolvedDate = unresolvedDates[0]?.date ?? null
  const currentDateHasEvents = (byDate.get(localCalendarDate)?.length ?? 0) > 0
  const pregameActionableDates = dates
    .filter((date) => date >= localCalendarDate)
    .map((date) => ({ date, events: byDate.get(date) ?? [] }))
    .filter((entry) => entry.events.some((event) => pregameActionableEvent(event, now)))
  const currentPregameActionableDate = pregameActionableDates[0]?.date ?? null
  const currentDateHasPregameActionableEvents = currentPregameActionableDate === localCalendarDate
  const selectedAction = String(action ?? 'status')
  const recoveryAllowed = actionUsesRecoverySlate(selectedAction)
  const activeOperatingDate = recoveryAllowed && recoveryCandidateDate
    ? recoveryCandidateDate
    : currentDateHasEvents
      ? localCalendarDate
      : null
  const nextSlateDate = dates.find((date) => date > (activeOperatingDate ?? localCalendarDate)) ?? null
  const providerQueryDate = actionUsesNextSlate(selectedAction)
    ? nextSlateDate ?? currentPregameActionableDate ?? addDays(localCalendarDate, 1)
    : actionUsesCurrentActionableSlate(selectedAction)
      ? currentPregameActionableDate ?? nextSlateDate ?? localCalendarDate
    : activeOperatingDate ?? (currentDateHasEvents ? localCalendarDate : nextSlateDate ?? localCalendarDate)
  const dateSelectionReason = recoveryCandidateDate && recoveryAllowed
    ? 'bounded_recovery_slate_precedes_current_or_next_slate'
    : recoveryCandidateDate && actionUsesCurrentActionableSlate(selectedAction)
      ? 'current_action_ignores_stale_recovery_slate'
    : actionUsesCurrentActionableSlate(selectedAction) && currentPregameActionableDate && currentPregameActionableDate !== localCalendarDate
      ? 'current_slate_past_cutoff_using_next_pregame_actionable_slate'
    : actionUsesCurrentActionableSlate(selectedAction) && currentDateHasPregameActionableEvents
      ? 'current_local_date_has_pregame_actionable_events'
    : actionUsesNextSlate(selectedAction) && nextSlateDate
      ? 'next_slate_allowed_for_preparation_action'
    : actionUsesNextSlate(selectedAction) && !nextSlateDate
      ? 'next_slate_prewarm_fallback_calendar_date'
    : currentDateHasEvents
      ? 'current_local_date_has_relevant_events'
      : nextSlateDate
        ? 'no_current_events_using_next_slate'
        : 'fallback_local_calendar_date'
  const unresolvedEventsByDate = Object.fromEntries(dates.map((date) => [date, (byDate.get(date) ?? []).filter((event) => unresolvedEvent(event, now)).length]))
  const recoveryClassification = recoveryCandidateDate && recoveryAllowed
    ? 'RECOVERY_ELIGIBLE'
    : recoveryCandidateDate
      ? 'RECOVERY_AVAILABLE_NOT_SELECTED_FOR_ACTION'
    : staleOrphanDates.length
      ? 'STALE_ORPHAN_EXCLUDED'
      : currentDateHasEvents
        ? 'CURRENT_LOCAL_DATE_PRIMARY'
        : nextSlateDate
          ? 'NO_CURRENT_EVENTS_NEXT_SLATE_AVAILABLE'
          : 'NO_STORED_SLATE'

  return {
    success: true,
    mode: 'mlb_operating_date_resolution_v1',
    timezone: TIMEZONE,
    action: selectedAction,
    localCalendarDate,
    operationalPrimaryDate: localCalendarDate,
    recoveryCandidateDate,
    recoveryWindowDays,
    recoveryClassification,
    activeOperatingDate,
    activeSlateDate: activeOperatingDate,
    providerQueryDate,
    selectedDate: providerQueryDate,
    nextSlateDate,
    dateSelectionReason,
    excludedStaleOrphanCount: staleOrphanDates.reduce((sum, entry) => sum + entry.events.filter((event) => unresolvedEvent(event, now)).length, 0),
    oldestUnresolvedDate,
    unresolvedEventsByDate,
    currentPregameActionableDate,
    currentDateHasPregameActionableEvents,
    pregameActionableEventsByDate: Object.fromEntries(dates.map((date) => [date, (byDate.get(date) ?? []).filter((event) => pregameActionableEvent(event, now)).length])),
    diagnostics: {
      dates,
      currentDateHasEvents,
      currentDateHasPregameActionableEvents,
      currentPregameActionableDate,
      activeUnresolvedDate: recoveryCandidateDate,
      recoveryAllowedForAction: recoveryAllowed,
      currentActionableSlateAction: actionUsesCurrentActionableSlate(selectedAction),
      recoveryBoundaryDate,
      staleOrphanDates: staleOrphanDates.map((entry) => entry.date),
      eventCountsByDate: Object.fromEntries(dates.map((date) => [date, byDate.get(date)?.length ?? 0])),
      unresolvedCountsByDate: unresolvedEventsByDate,
    },
  }
}

export function validateMlbOperatingDateResolutionFixtures() {
  const checks = [
    ['status refresh never uses next slate by rule', !actionUsesNextSlate('status_refresh')],
    ['sync results never uses next slate by rule', !actionUsesNextSlate('sync_results')],
    ['prepare next slate may use next slate by rule', actionUsesNextSlate('prepare_next_slate')],
    ['status refresh may select bounded recovery slate', actionUsesRecoverySlate('status_refresh')],
    ['sync results may select bounded recovery slate', actionUsesRecoverySlate('sync_results')],
    ['midday refresh never selects bounded recovery slate', !actionUsesRecoverySlate('midday_refresh') && actionUsesCurrentActionableSlate('midday_refresh')],
    ['odds refresh never selects bounded recovery slate', !actionUsesRecoverySlate('odds_refresh') && actionUsesCurrentActionableSlate('odds_refresh')],
    ['prediction refresh never selects bounded recovery slate', !actionUsesRecoverySlate('prediction_refresh') && actionUsesCurrentActionableSlate('prediction_refresh')],
    ['pregame cutoff uses ten minute guard', eventCutoffMs({ id: 'x', sport_key: 'baseball_mlb', league_key: 'mlb', start_time: '2026-07-17T23:10:00.000Z', status: 'scheduled', updated_at: null, metadata: null }) === Date.parse('2026-07-17T23:00:00.000Z')],
    ['final statuses are terminal', terminalStatus('Final')],
    ['postponed statuses are terminal', terminalStatus('Postponed')],
    ['status unconfirmed is nonterminal', !terminalStatus('STATUS_UNCONFIRMED')],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_operating_date_resolution_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
  }
}
