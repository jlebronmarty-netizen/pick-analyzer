import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const CONTRACT_VERSION = 'PE_MLB_MONEYLINE_RECOMMENDATION/1.0.0'
const MODEL_VERSION = 'pregame_high_conf_home_v2'
const MLB_TIME_ZONE = 'America/New_York'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function currentMlbDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MLB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isFailClosedRow(row: { route_details?: unknown }) {
  const details = row.route_details
  return Boolean(details && typeof details === 'object' && !Array.isArray(details) && (details as Record<string, unknown>).failClosed === true)
}

const safety = {
  recommendationServingAuthorized: true,
  officialPicksWrites: false,
  apostarActive: false,
  scope: 'MONEYLINE_ONLY',
} as const

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const params = new URL(request.url).searchParams
  const requestedDate = params.get('date')
  const targetDate = requestedDate ?? currentMlbDate()

  if (!DATE_RE.test(targetDate)) {
    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: 'INVALID_REQUEST',
      error: 'date must use YYYY-MM-DD',
      data: null,
    }, { status: 400, headers })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('mlb_ml_forward_tracker_v1')
      .select('tracking_date,event_id,game_pk,start_time,home_team,away_team,model_version,snapshot_ts,feature_cutoff_ts,data_status,standard_score,pick_status,recommended_team,recommended_side,route_id,route_details,market_moneyline,market_no_vig_prob,result_status,frozen_at')
      .eq('tracking_date', targetDate)
      .eq('model_version', MODEL_VERSION)
      .order('start_time', { ascending: true })

    if (error) throw new Error('MONEYLINE_TRACKER_READ_FAILED')

    if (!data?.length) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'TRACKER_NOT_READY',
        asOf: new Date().toISOString(),
        data: {
          targetDate,
          modelVersion: MODEL_VERSION,
          evaluatedGames: 0,
          picksCount: 0,
          actionablePicksCount: 0,
          failClosedGames: 0,
          coverageComplete: false,
          recommendations: [],
          safety,
        },
      }, { status: 409, headers })
    }

    const invalidRows = data.filter((row) =>
      row.data_status !== 'FROZEN' ||
      !row.frozen_at ||
      (row.pick_status !== 'PICK' && row.pick_status !== 'NO_PICK')
    )

    if (invalidRows.length > 0) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'TRACKER_NOT_READY',
        asOf: new Date().toISOString(),
        data: {
          targetDate,
          modelVersion: MODEL_VERSION,
          evaluatedGames: data.length,
          picksCount: 0,
          actionablePicksCount: 0,
          failClosedGames: 0,
          coverageComplete: false,
          recommendations: [],
          failClosedReason: 'UNFROZEN_OR_UNEXPECTED_TRACKER_STATE',
          safety,
        },
      }, { status: 409, headers })
    }

    const frozenInputGaps = data.filter(isFailClosedRow)
    const pickRows = data.filter((row) => row.pick_status === 'PICK')
    const failClosedPick = pickRows.some(isFailClosedRow)
    const malformedPick = pickRows.some((row) =>
      !row.recommended_team ||
      !row.recommended_side ||
      !row.route_id ||
      !row.start_time ||
      !row.feature_cutoff_ts ||
      !row.frozen_at
    )

    if (failClosedPick || malformedPick) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'TRACKER_NOT_READY',
        asOf: new Date().toISOString(),
        data: {
          targetDate,
          modelVersion: MODEL_VERSION,
          evaluatedGames: data.length,
          picksCount: 0,
          actionablePicksCount: 0,
          failClosedGames: frozenInputGaps.length,
          coverageComplete: false,
          recommendations: [],
          failClosedReason: failClosedPick ? 'FAIL_CLOSED_ROW_CANNOT_BE_PICK' : 'MALFORMED_FROZEN_PICK',
          safety,
        },
      }, { status: 409, headers })
    }

    const nowMs = Date.now()
    const recommendations = pickRows.map((row) => {
      const startMs = Date.parse(row.start_time as string)
      const isPregame = Number.isFinite(startMs) && nowMs < startMs
      return {
        eventId: row.event_id,
        gamePk: row.game_pk,
        startTime: row.start_time,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        recommendedTeam: row.recommended_team,
        recommendedSide: row.recommended_side,
        routeId: row.route_id,
        routeDetails: row.route_details,
        modelVersion: row.model_version,
        standardScore: safeNumber(row.standard_score),
        marketMoneyline: typeof row.market_moneyline === 'number' ? row.market_moneyline : null,
        marketNoVigProbability: safeNumber(row.market_no_vig_prob),
        snapshotTs: row.snapshot_ts,
        featureCutoffTs: row.feature_cutoff_ts,
        frozenAt: row.frozen_at,
        lifecycle: isPregame ? 'PREGAME' : 'STARTED_OR_FINAL',
        actionable: isPregame,
      }
    })

    const actionablePicksCount = recommendations.filter((row) => row.actionable).length
    const coverageComplete = frozenInputGaps.length === 0

    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: pickRows.length > 0 ? 'PICK_AVAILABLE' : 'NO_PICK',
      asOf: new Date().toISOString(),
      data: {
        targetDate,
        modelVersion: MODEL_VERSION,
        evaluatedGames: data.length,
        picksCount: pickRows.length,
        actionablePicksCount,
        failClosedGames: frozenInputGaps.length,
        coverageComplete,
        recommendations,
        note: pickRows.length === 0
          ? coverageComplete
            ? 'No game met the frozen certified Moneyline selection criteria.'
            : 'No valid Moneyline recommendation; one or more games failed closed because decision-relevant inputs were unavailable.'
          : coverageComplete
            ? null
            : 'Valid recommendations are shown; games with incomplete decision-relevant inputs remain excluded fail-closed.',
        safety,
      },
    }, { headers })
  } catch {
    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: 'MONEYLINE_RECOMMENDATION_READ_UNAVAILABLE',
      data: null,
    }, { status: 503, headers })
  }
}
