import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { refreshMlbStatcastDaily } from '@/services/mlb-statcast-daily-refresh.service'
import { refreshMlbStatcastDailyAnalytics } from '@/services/mlb-statcast-daily-analytics.service'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'
import { runMlbMoneylineForwardFreeze } from '@/services/mlb-moneyline-forward-freeze-runtime.service'
import { executeTheOddsApiMlbDualReadAcquisition } from '@/services/the-odds-api-current-odds-acquisition.service'
import { captureRunlineV2HomeP15AlternateShadow } from '@/services/mlb-runline-home-p15-alt-shadow.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 800

const MAX_CATCHUP_DAYS = 14
const PROSPECTIVE_MARKET_CAPTURE_SOURCE = 'RUNLINE_V2_TOTALS_PROSPECTIVE_DAILY_CAPTURE'

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function failureStatus(result: { status?: string }) {
  return result.status === 'BLOCKED_SCHEDULE_NOT_FINAL' ? 409 : result.status === 'BLOCK_CONFLICT' ? 423 : 500
}

function puertoRicoClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Puerto_Rico',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function withinProspectiveCaptureWindow(now = new Date()) {
  const clock = puertoRicoClock(now)
  // This route already runs at 06:15, 08:15, 10:15 and 10:45 Puerto Rico.
  // Try the earliest slot with a canonical MLB slate; later slots are retries
  // only when an earlier capture could not complete the research evidence.
  return clock.hour >= 6 && clock.hour <= 10
}

async function safeAlternateHomeP15Capture(operatingDate: string, id: string) {
  try {
    return await captureRunlineV2HomeP15AlternateShadow({ operatingDate, requestId: id })
  } catch (error) {
    return {
      success: false,
      status: 'ALT_HOME_P15_CAPTURE_FAILED_NON_BLOCKING',
      operatingDate,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
      officialPicksModified: false,
      apostarActivated: false,
      error: errorMessage(error, 'Unknown Run Line V2 HOME +1.5 alternate capture error'),
    }
  }
}

async function maybeCaptureProspectiveMlbMarkets(id: string) {
  const now = new Date()
  const clock = puertoRicoClock(now)
  if (!withinProspectiveCaptureWindow(now)) {
    return {
      success: true,
      status: 'NOT_DUE',
      operatingDate: clock.date,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
    }
  }

  const range = puertoRicoUtcRange(clock.date)
  const existingJobs = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('provider', 'the-odds-api')
    .eq('sport_key', 'baseball_mlb')
    .in('status', ['completed', 'partial'])
    .gte('completed_at', range.utcStart)
    .lt('completed_at', range.utcEndExclusive)
    .order('completed_at', { ascending: false })
    .limit(50)

  if (existingJobs.error) {
    return {
      success: false,
      status: 'CAPTURE_LEDGER_READ_FAILED',
      operatingDate: clock.date,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
      error: existingJobs.error.message,
    }
  }

  const alreadyCaptured = (existingJobs.data ?? []).find((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    return metadata.source === PROSPECTIVE_MARKET_CAPTURE_SOURCE
  })

  if (alreadyCaptured) {
    const alternateHomeP15Capture = await safeAlternateHomeP15Capture(clock.date, id)
    return {
      success: alternateHomeP15Capture.success !== false,
      status: alternateHomeP15Capture.success === false
        ? 'CORE_CAPTURED_ALT_RETRY_FAILED_NON_BLOCKING'
        : 'CORE_ALREADY_CAPTURED_ALT_EVALUATED',
      operatingDate: clock.date,
      completedAt: alreadyCaptured.completed_at,
      providerCallsMade: Number(alternateHomeP15Capture.providerCallsMade ?? 0),
      providerCreditsConsumed: Number(alternateHomeP15Capture.providerCreditsConsumed ?? 0),
      researchOnly: true,
      alternateHomeP15Capture,
    }
  }

  const events = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,status')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
    .limit(50)

  if (events.error) {
    return {
      success: false,
      status: 'CAPTURE_EVENT_SCOPE_READ_FAILED',
      operatingDate: clock.date,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
      error: events.error.message,
    }
  }

  const eventPlans = (events.data ?? [])
    .filter((event) => Date.parse(String(event.start_time)) > now.getTime())
    .map((event) => ({
      eventId: String(event.id),
      executionEnabled: true,
      plannedAction: 'REFRESH_MARKET',
    }))

  if (!eventPlans.length) {
    return {
      success: true,
      status: 'DEFER_NO_PREGAME_EVENTS',
      operatingDate: clock.date,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
    }
  }

  try {
    const coreCapture = await executeTheOddsApiMlbDualReadAcquisition({
      operatingDate: clock.date,
      eventPlans,
      source: PROSPECTIVE_MARKET_CAPTURE_SOURCE,
      requestId: id,
    })
    const alternateHomeP15Capture = await safeAlternateHomeP15Capture(clock.date, id)
    return {
      ...coreCapture,
      success: coreCapture.success !== false && alternateHomeP15Capture.success !== false,
      researchOnly: true,
      capturePurpose: 'ML_RUNLINE_TOTALS_AND_HOME_P15_ALT_PROSPECTIVE_EVIDENCE',
      requestedEventCount: eventPlans.length,
      officialPicksModified: false,
      apostarActivated: false,
      alternateHomeP15Capture,
      providerCallsMade: Number(coreCapture.providerCallsMade ?? 0) + Number(alternateHomeP15Capture.providerCallsMade ?? 0),
      providerCreditsConsumed: Number(coreCapture.providerCreditsConsumed ?? 0) + Number(alternateHomeP15Capture.providerCreditsConsumed ?? 0),
    }
  } catch (error) {
    // Research evidence acquisition must never block the certified Statcast,
    // Moneyline freeze, Official Picks boundary, or betting activation state.
    return {
      success: false,
      status: 'CAPTURE_FAILED_NON_BLOCKING',
      operatingDate: clock.date,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
      officialPicksModified: false,
      apostarActivated: false,
      error: errorMessage(error, 'Unknown MLB prospective market capture error'),
    }
  }
}

async function execute(request: NextRequest, explicitDate?: string | null) {
  const id = requestId(request)
  if (!cronSecret()) {
    return apiError({ id, code: 'AUTH_REQUIRED', message: 'CRON_SECRET must be configured before MLB Statcast daily refresh can run.', status: 503 })
  }
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB Statcast daily refresh request.', status: 401 })
  }

  try {
    if (explicitDate) {
      const result = await refreshMlbStatcastDaily({ date: explicitDate })
      const readiness = await getMlbDailyHistoryReadiness({ date: explicitDate })
      const status = result.success ? (readiness.ready ? 200 : 409) : failureStatus(result)
      return apiOk({ ...result, dailyHistoryReadiness: readiness }, id, { status, headers: { 'Cache-Control': 'no-store' } })
    }

    // Reuse this already-scheduled authenticated route for one bounded daily
    // multi-market evidence capture. Core ML/Run Line/Total prices are stored
    // first; then alternate HOME +1.5 is queried only for games whose standard
    // paired modal Run Line establishes HOME -1.5. All evidence is research-only.
    const prospectiveMarketCapture = await maybeCaptureProspectiveMlbMarkets(id)

    const catchupRuns: Array<Record<string, unknown>> = []
    let reachedCurrent = false
    let wroteHistory = false

    for (let attempt = 0; attempt < MAX_CATCHUP_DAYS; attempt += 1) {
      const result = await refreshMlbStatcastDaily({ refreshAnalytics: false })
      catchupRuns.push(result as unknown as Record<string, unknown>)

      if (!result.success) {
        const readiness = await getMlbDailyHistoryReadiness()
        return apiOk({ success: false, status: result.status, catchupRuns, dailyHistoryReadiness: readiness, prospectiveMarketCapture }, id, {
          status: failureStatus(result),
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      if ('inserted' in result && Number(result.inserted ?? 0) > 0) wroteHistory = true

      if (result.status === 'NO_OP' && 'reason' in result && result.reason === 'ALREADY_CURRENT') {
        reachedCurrent = true
        break
      }
    }

    if (!reachedCurrent) {
      const readiness = await getMlbDailyHistoryReadiness()
      return apiOk({ success: false, status: 'CATCHUP_LIMIT_REACHED', catchupRuns, dailyHistoryReadiness: readiness, prospectiveMarketCapture }, id, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    let readiness = await getMlbDailyHistoryReadiness()
    let analyticsRepair: Awaited<ReturnType<typeof refreshMlbStatcastDailyAnalytics>> | null = null
    if (wroteHistory || !readiness.analytics.ready) {
      analyticsRepair = await refreshMlbStatcastDailyAnalytics()
      readiness = await getMlbDailyHistoryReadiness()
    }

    // Reuse this existing daily scheduler rather than creating a parallel host.
    // The Moneyline runtime owns the 10:45 AM Puerto Rico gate, the pre-first-
    // pitch gate, idempotent freeze and fail-closed behavior. Pass the already
    // verified previous-day readiness result to avoid an unnecessary second
    // MLB Official schedule request.
    const moneylineFreeze = readiness.ready
      ? await runMlbMoneylineForwardFreeze({
          historyReadiness: {
            ready: readiness.ready,
            targetDate: readiness.targetDate,
          },
        })
      : null
    const moneylineBlocked = Boolean(moneylineFreeze && moneylineFreeze.success === false)
    const success = readiness.ready && !moneylineBlocked

    return apiOk({
      success,
      status: moneylineBlocked ? moneylineFreeze?.status : readiness.status,
      catchupRuns,
      analyticsRefreshed: Boolean(analyticsRepair),
      analyticsRepair,
      dailyHistoryReadiness: readiness,
      moneylineRecommendationFreeze: moneylineFreeze,
      prospectiveMarketCapture,
    }, id, {
      status: success ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB Statcast daily refresh error') })
  }
}

export async function GET(request: NextRequest) {
  return execute(request)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const date = typeof body?.date === 'string' ? body.date : null
  return execute(request, date)
}
