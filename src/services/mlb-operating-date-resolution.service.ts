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
  searchBackDays = 3,
  searchForwardDays = 7,
}: {
  action?: DateResolutionAction | null
  now?: Date
  searchBackDays?: number
  searchForwardDays?: number
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
  const activeUnresolved = unresolvedDates[0]?.date ?? null
  const currentDateHasEvents = (byDate.get(localCalendarDate)?.length ?? 0) > 0
  const activeOperatingDate = activeUnresolved ?? (currentDateHasEvents ? localCalendarDate : null)
  const nextSlateDate = dates.find((date) => date > (activeOperatingDate ?? localCalendarDate)) ?? null
  const selectedAction = String(action ?? 'status')
  const providerQueryDate = actionUsesNextSlate(selectedAction)
    ? nextSlateDate ?? localCalendarDate
    : activeOperatingDate ?? (currentDateHasEvents ? localCalendarDate : nextSlateDate ?? localCalendarDate)
  const dateSelectionReason = activeUnresolved && !actionUsesNextSlate(selectedAction)
    ? 'active_unresolved_slate_precedes_next_slate'
    : actionUsesNextSlate(selectedAction) && nextSlateDate
      ? 'next_slate_allowed_for_preparation_action'
      : currentDateHasEvents
        ? 'current_local_date_has_relevant_events'
        : nextSlateDate
          ? 'no_current_events_using_next_slate'
          : 'fallback_local_calendar_date'

  return {
    success: true,
    mode: 'mlb_operating_date_resolution_v1',
    timezone: TIMEZONE,
    action: selectedAction,
    localCalendarDate,
    activeOperatingDate,
    activeSlateDate: activeOperatingDate,
    providerQueryDate,
    selectedDate: providerQueryDate,
    nextSlateDate,
    dateSelectionReason,
    diagnostics: {
      dates,
      currentDateHasEvents,
      activeUnresolvedDate: activeUnresolved,
      eventCountsByDate: Object.fromEntries(dates.map((date) => [date, byDate.get(date)?.length ?? 0])),
      unresolvedCountsByDate: Object.fromEntries(dates.map((date) => [date, (byDate.get(date) ?? []).filter((event) => unresolvedEvent(event, now)).length])),
    },
  }
}

export function validateMlbOperatingDateResolutionFixtures() {
  const checks = [
    ['status refresh never uses next slate by rule', !actionUsesNextSlate('status_refresh')],
    ['sync results never uses next slate by rule', !actionUsesNextSlate('sync_results')],
    ['prepare next slate may use next slate by rule', actionUsesNextSlate('prepare_next_slate')],
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
