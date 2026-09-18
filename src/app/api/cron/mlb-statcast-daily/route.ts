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
import { freezeRunlineV2HomeP15Alternate } from '@/services/mlb-runline-home-p15-alt-forward-freeze.service'
import { settleRunlineV2HomeP15Alternate } from '@/services/mlb-runline-home-p15-alt-forward-settlement.service'
import { capturePa13PitcherErForward } from '@/services/pa13-pitcher-er-forward-capture.service'
import { freezePa12ErForwardShadowV2 } from '@/services/pa12-er-forward-shadow-v2-freeze.service'
import { settlePa12ErForwardShadowV2 } from '@/services/pa12-er-forward-shadow-v2-settlement.service'

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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
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

async function safePa13PitcherErForwardCapture(operatingDate: string, id: string) {
  try {
    return await capturePa13PitcherErForward({ operatingDate, requestId: id })
  } catch (error) {
    return {
      success: false,
      status: 'PA13_PITCHER_ER_FORWARD_CAPTURE_FAILED_NON_BLOCKING',
      targetDate: operatingDate,
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      historicalPricingCertified: false,
      roiCertified: false,
      clvCertified: false,
      evCertified: false,
      officialPicksModified: false,
      apostarActivated: false,
      error: errorMessage(error, 'Unknown PA-13 Pitcher ER forward capture error'),
    }
  }
}

async function safePa12ErForwardShadowFreeze() {
  try {
    return await freezePa12ErForwardShadowV2()
  } catch (error) {
    return {
      success: false,
      status: 'PA12_ER_FORWARD_SHADOW_V2_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      probabilityLayerAuthorized: false,
      marketRecommendationAuthorized: false,
      officialPicksModified: false,
      apostarActivated: false,
      writes: 0,
      error: errorMessage(error, 'Unknown PA-12 Pitcher ER forward shadow V2 freeze error'),
    }
  }
}

async function safePa12ErForwardShadowSettlement(targetDate: string) {
  try {
    return await settlePa12ErForwardShadowV2(targetDate)
  } catch (error) {
    return {
      success: false,
      status: 'PA12_ER_FORWARD_SHADOW_V2_SETTLEMENT_FAILED_NON_BLOCKING',
      targetDate,
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      probabilityLayerAuthorized: false,
      marketRecommendationAuthorized: false,
      officialPicksModified: false,
      apostarActivated: false,
      roiCertified: false,
      clvCertified: false,
      evCertified: false,
      writes: 0,
      error: errorMessage(error, 'Unknown PA-12 Pitcher ER forward shadow V2 settlement error'),
    }
  }
}

async function safeRunlineHomeP15ForwardFreeze() {
  try {
    return await freezeRunlineV2HomeP15Alternate()
  } catch (error) {
    return {
      success: false,
      status: 'RUNLINE_HOME_P15_FORWARD_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      writes: 0,
      error: errorMessage(error, 'Unknown Run Line V2 HOME +1.5 forward freeze error'),
    }
  }
}

async function safeRunlineHomeP15Settlement(targetDate: string) {
  try {
    return await settleRunlineV2HomeP15Alternate(targetDate)
  } catch (error) {
    return {
      success: false,
      status: 'RUNLINE_HOME_P15_SETTLEMENT_FAILED_NON_BLOCKING',
      targetDate,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      roiCertified: false,
      writes: 0,
      error: errorMessage(error, 'Unknown Run Line V2 HOME +1.5 settlement error'),
    }
  }
}

async function safeMoneylineForwardFreeze(historyReadiness: { ready: boolean; targetDate: string }) {
  try {
    return await runMlbMoneylineForwardFreeze({ historyReadiness })
  } catch (error) {
    // Moneyline remains fail-closed. Convert an exception into an explicit blocked
    // result so independent shadow-only research stages can still record their
    // own evidence without changing Moneyline recommendation eligibility.
    return {
      success: false,
      status: 'MONEYLINE_FORWARD_FREEZE_FAILED_FAIL_CLOSED',
      writes: 0,
      officialPickWrites: 0,
      apostarActive: false,
      error: errorMessage(error, 'Unknown Moneyline forward freeze error'),
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
    const pitcherErCapture = await safePa13PitcherErForwardCapture(clock.date, id)
    const supplementaryFailed = alternateHomeP15Capture.success === false || pitcherErCapture.success === false
    return {
      success: !supplementaryFailed,
      status: supplementaryFailed
        ? 'CORE_CAPTURED_SUPPLEMENTARY_RETRY_FAILED_NON_BLOCKING'
        : 'CORE_ALREADY_CAPTURED_SUPPLEMENTARY_EVALUATED',
      operatingDate: clock.date,
      completedAt: alreadyCaptured.completed_at,
      providerCallsMade:
        Number(alternateHomeP15Capture.providerCallsMade ?? 0) +
        Number(pitcherErCapture.providerCallsMade ?? 0),
      providerCreditsConsumed:
        Number(alternateHomeP15Capture.providerCreditsConsumed ?? 0) +
        Number(pitcherErCapture.providerCreditsConsumed ?? 0),
      researchOnly: true,
      alternateHomeP15Capture,
      pitcherErCapture,
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
    const pitcherErCapture = await safePa13PitcherErForwardCapture(clock.date, id)
    return {
      ...coreCapture,
      success:
        coreCapture.success !== false &&
        alternateHomeP15Capture.success !== false &&
        pitcherErCapture.success !== false,
      researchOnly: true,
      capturePurpose: 'ML_RUNLINE_TOTALS_HOME_P15_ALT_AND_PA13_PITCHER_ER_PROSPECTIVE_EVIDENCE',
      requestedEventCount: eventPlans.length,
      officialPicksModified: false,
      apostarActivated: false,
      alternateHomeP15Capture,
      pitcherErCapture,
      providerCallsMade:
        Number(coreCapture.providerCallsMade ?? 0) +
        Number(alternateHomeP15Capture.providerCallsMade ?? 0) +
        Number(pitcherErCapture.providerCallsMade ?? 0),
      providerCreditsConsumed:
        Number(coreCapture.providerCreditsConsumed ?? 0) +
        Number(alternateHomeP15Capture.providerCreditsConsumed ?? 0) +
        Number(pitcherErCapture.providerCreditsConsumed ?? 0),
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

    // Independent research-only Pitcher ER V2 freeze/settlement run before
    // Statcast catch-up. This preserves fixed-clock evidence even if a separate
    // ingestion/readiness stage fails later in the request.
    const operatingClock = puertoRicoClock()
    const pa12ErForwardShadowFreeze = await safePa12ErForwardShadowFreeze()
    const pa12ErForwardShadowSettlement = await safePa12ErForwardShadowSettlement(addDays(operatingClock.date, -1))

    const catchupRuns: Array<Record<string, unknown>> = []
    let reachedCurrent = false
    let wroteHistory = false

    for (let attempt = 0; attempt < MAX_CATCHUP_DAYS; attempt += 1) {
      const result = await refreshMlbStatcastDaily({ refreshAnalytics: false })
      catchupRuns.push(result as unknown as Record<string, unknown>)

      if (!result.success) {
        const readiness = await getMlbDailyHistoryReadiness()
        return apiOk({
          success: false,
          status: result.status,
          catchupRuns,
          dailyHistoryReadiness: readiness,
          prospectiveMarketCapture,
          pa12ErForwardShadowFreeze,
          pa12ErForwardShadowSettlement,
        }, id, {
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
      return apiOk({
        success: false,
        status: 'CATCHUP_LIMIT_REACHED',
        catchupRuns,
        dailyHistoryReadiness: readiness,
        prospectiveMarketCapture,
        pa12ErForwardShadowFreeze,
        pa12ErForwardShadowSettlement,
      }, id, {
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

    // Previous-day outcomes are read only after daily history/analytics are ready.
    // This is a separate research settlement stage and cannot affect today's freeze.
    const runlineHomeP15Settlement = readiness.ready && typeof readiness.targetDate === 'string'
      ? await safeRunlineHomeP15Settlement(readiness.targetDate)
      : null

    // Run Line is an independent shadow-only research stage. Execute its safe
    // freeze before Moneyline so a Moneyline runtime exception cannot erase a
    // valid prospective Run Line observation. This does not change Moneyline's
    // fail-closed recommendation gate or any production eligibility.
    const runlineHomeP15Freeze = readiness.ready
      ? await safeRunlineHomeP15ForwardFreeze()
      : null

    // Moneyline keeps its existing authorized gate and remains fail-closed.
    // Exceptions are represented as blocked results rather than aborting the
    // entire cron after independent research evidence has already been captured.
    const moneylineFreeze = readiness.ready
      ? await safeMoneylineForwardFreeze({
          ready: readiness.ready,
          targetDate: readiness.targetDate,
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
      runlineHomeP15ResearchFreeze: runlineHomeP15Freeze,
      runlineHomeP15ResearchSettlement: runlineHomeP15Settlement,
      prospectiveMarketCapture,
      pa12ErForwardShadowFreeze,
      pa12ErForwardShadowSettlement,
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
