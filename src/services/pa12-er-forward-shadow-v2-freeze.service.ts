import 'server-only'

import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { mapConcurrent, readMlbOfficialPitcherGameLog } from '@/services/mlb-official-pitcher-gamelog.service'

const TIME_ZONE = 'America/Puerto_Rico'
const SEASON = 2026
const FREEZE_START_MINUTE = 10 * 60 + 45
const FREEZE_END_MINUTE = 11 * 60
const PA13_SOURCE = 'PA13_PITCHER_ER_FORWARD_CAPTURE_V1'
const JOB_TYPE = 'pa12_er_forward_shadow_v2_freeze_v1'
const PROVIDER = 'internal-model'
const MODEL_VERSION = 'MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2'
const MIN_PRIOR_STARTS = 3
const BASE_INTERCEPT = 1.90273530551357
const BASE_SLOPE = 0.227085168912444
const K_RESIDUAL_INTERCEPT = 0.653408289475204
const K_RESIDUAL_SLOPE = -3.0156054216154

type QuoteTargetRow = {
  event_id: string
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

type PitcherHistoryRow = {
  pitcher: number | string
  strikeouts: number | string | null
  batters_faced: number | string | null
}

function dateInPuertoRico(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function minuteOfDayPuertoRico(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return Number(parts.hour) * 60 + Number(parts.minute)
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function existingFreeze(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,completed_at,status,metadata')
    .eq('job_type', JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('provider', PROVIDER)
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`PA12_ER_V2_FREEZE_LEDGER_READ_FAILED:${error.message}`)

  return (data ?? []).find((row) => asRecord(row.metadata).targetDate === targetDate) ?? null
}

async function loadTargets(targetDate: string, now: Date) {
  const range = puertoRicoUtcRange(targetDate)
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('event_id,snapshot_time,metadata')
    .eq('provider', 'the-odds-api')
    .eq('market', 'pitcher_earned_runs')
    .eq('metadata->>source', PA13_SOURCE)
    .gte('snapshot_time', range.utcStart)
    .lt('snapshot_time', range.utcEndExclusive)
    .order('snapshot_time', { ascending: false })
    .limit(5000)
  if (error) throw new Error(`PA12_ER_V2_TARGET_READ_FAILED:${error.message}`)

  const targets = new Map<string, {
    gamePk: number
    pitcherMlbamId: number
    pitcherName: string | null
    eventId: string
    targetStart: string
    latestQuoteSnapshot: string
  }>()

  for (const row of (data ?? []) as QuoteTargetRow[]) {
    const metadata = asRecord(row.metadata)
    const gamePk = n(metadata.canonicalGamePk)
    const pitcherMlbamId = n(metadata.pitcherMlbamId)
    const targetStart = typeof metadata.targetStart === 'string' ? metadata.targetStart : null
    const pitcherName = typeof metadata.pitcherName === 'string' ? metadata.pitcherName : null
    if (!gamePk || !pitcherMlbamId || !targetStart) continue
    if (dateInPuertoRico(new Date(targetStart)) !== targetDate) continue
    if (Date.parse(row.snapshot_time) >= Date.parse(targetStart)) continue
    if (Date.parse(row.snapshot_time) > now.getTime()) continue

    const key = `${gamePk}:${pitcherMlbamId}`
    const prior = targets.get(key)
    if (!prior || Date.parse(row.snapshot_time) > Date.parse(prior.latestQuoteSnapshot)) {
      targets.set(key, {
        gamePk,
        pitcherMlbamId,
        pitcherName,
        eventId: row.event_id,
        targetStart,
        latestQuoteSnapshot: row.snapshot_time,
      })
    }
  }

  return [...targets.values()].sort((a, b) => a.gamePk - b.gamePk || a.pitcherMlbamId - b.pitcherMlbamId)
}

async function loadKHistory(targetDate: string, pitcherIds: number[]) {
  if (!pitcherIds.length) return new Map<number, { k: number; bf: number; appearances: number }>()

  const { data, error } = await supabaseAdmin
    .from('mlb_ml_xyear_pitcher_game_v1')
    .select('pitcher,strikeouts,batters_faced')
    .eq('season', SEASON)
    .lt('game_date', targetDate)
    .in('pitcher', pitcherIds)
    .limit(5000)
  if (error) throw new Error(`PA12_ER_V2_K_HISTORY_READ_FAILED:${error.message}`)

  const result = new Map<number, { k: number; bf: number; appearances: number }>()
  for (const row of (data ?? []) as PitcherHistoryRow[]) {
    const pitcherId = n(row.pitcher)
    const strikeouts = n(row.strikeouts)
    const battersFaced = n(row.batters_faced)
    if (!pitcherId || strikeouts === null || battersFaced === null) continue
    const aggregate = result.get(pitcherId) ?? { k: 0, bf: 0, appearances: 0 }
    aggregate.k += strikeouts
    aggregate.bf += battersFaced
    aggregate.appearances += 1
    result.set(pitcherId, aggregate)
  }
  return result
}

export async function freezePa12ErForwardShadowV2({
  targetDate,
  now = new Date(),
}: {
  targetDate?: string
  now?: Date
} = {}) {
  const today = dateInPuertoRico(now)
  const date = targetDate ?? today
  const base = {
    success: true,
    modelVersion: MODEL_VERSION,
    targetDate: date,
    researchOnly: true,
    shadowOnly: true,
    productionEligible: false,
    probabilityLayerAuthorized: false,
    marketRecommendationAuthorized: false,
    officialPicksModified: false,
    apostarActivated: false,
    sportsbookInputToModel: false,
    modelRetuned: false,
    writes: 0,
  }

  if (date !== today) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }

  const prior = await existingFreeze(date)
  if (prior) {
    const metadata = asRecord(prior.metadata)
    return {
      ...base,
      status: 'REUSE_NO_OP',
      freezeJobId: prior.id,
      frozenAt: prior.completed_at,
      eligibleRows: Number(metadata.eligibleRows ?? 0),
      blockedRows: Number(metadata.blockedRows ?? 0),
    }
  }

  const clockMinute = minuteOfDayPuertoRico(now)
  if (clockMinute < FREEZE_START_MINUTE) return { ...base, status: 'NOT_IN_FREEZE_WINDOW' }
  if (clockMinute >= FREEZE_END_MINUTE) {
    return {
      ...base,
      success: false,
      status: 'BLOCK_FREEZE_WINDOW_MISSED',
      freezeWindow: '10:45-10:59 America/Puerto_Rico',
    }
  }

  const targets = await loadTargets(date, now)
  if (!targets.length) return { ...base, status: 'WAITING_FOR_PA13_FORWARD_QUOTES' }

  const earliestStart = Math.min(...targets.map((row) => Date.parse(row.targetStart)))
  if (!Number.isFinite(earliestStart) || now.getTime() >= earliestStart) {
    return { ...base, success: false, status: 'BLOCK_FREEZE_AFTER_FIRST_PITCH', targetRows: targets.length }
  }

  const pitcherIds = [...new Set(targets.map((row) => row.pitcherMlbamId))]
  const [kHistory, gameLogs] = await Promise.all([
    loadKHistory(date, pitcherIds),
    mapConcurrent(pitcherIds, 8, async (pitcherId) => ({
      pitcherId,
      rows: await readMlbOfficialPitcherGameLog(pitcherId, SEASON),
    })),
  ])
  const gameLogByPitcher = new Map(gameLogs.map((row) => [row.pitcherId, row.rows]))

  const pointPredictions = targets.map((target) => {
    const starts = (gameLogByPitcher.get(target.pitcherMlbamId) ?? [])
      .filter((row) => row.date < date && row.gamesStarted > 0 && row.earnedRuns !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)

    const k = kHistory.get(target.pitcherMlbamId) ?? { k: 0, bf: 0, appearances: 0 }
    const priorStarts = starts.length
    const priorErAll = priorStarts
      ? starts.reduce((sum, row) => sum + Number(row.earnedRuns), 0) / priorStarts
      : null
    const kRate = k.bf > 0 ? k.k / k.bf : null
    const eligible = priorStarts >= MIN_PRIOR_STARTS && priorErAll !== null && kRate !== null
    const predictedEr = eligible
      ? BASE_INTERCEPT + BASE_SLOPE * priorErAll + K_RESIDUAL_INTERCEPT + K_RESIDUAL_SLOPE * kRate
      : null

    return {
      gamePk: target.gamePk,
      eventId: target.eventId,
      pitcherMlbamId: target.pitcherMlbamId,
      pitcherName: target.pitcherName,
      targetStart: target.targetStart,
      latestIdentityQuoteSnapshot: target.latestQuoteSnapshot,
      eligible,
      predictedEr,
      priorStarts,
      priorErAll,
      kRate,
      priorAllAppearances: k.appearances,
      priorK: k.k,
      priorBF: k.bf,
      maxPriorStartDate: starts.at(-1)?.date ?? null,
      maxPriorStartGamePk: starts.at(-1)?.gamePk ?? null,
      blockReason: eligible
        ? null
        : priorStarts < MIN_PRIOR_STARTS
          ? 'SHORT_ER_START_HISTORY'
          : kRate === null
            ? 'MISSING_K_RATE'
            : 'MISSING_ER_HISTORY',
    }
  })

  const eligibleRows = pointPredictions.filter((row) => row.eligible).length
  const blockedRows = pointPredictions.length - eligibleRows
  const frozenAt = now.toISOString()
  const completedAt = new Date().toISOString()
  const { data: inserted, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: frozenAt,
    completed_at: completedAt,
    status: blockedRows > 0 ? 'partial' : 'completed',
    records_fetched: pointPredictions.length,
    records_inserted: eligibleRows,
    records_updated: 0,
    records_skipped: blockedRows,
    error_count: 0,
    metadata: {
      checkpoint: JOB_TYPE,
      targetDate: date,
      frozenAt,
      modelVersion: MODEL_VERSION,
      inheritedFrozenMathFrom: 'MLB_PITCHER_ER_PA12_RESEARCH_V1',
      coefficients: {
        baseIntercept: BASE_INTERCEPT,
        baseSlope: BASE_SLOPE,
        kResidualIntercept: K_RESIDUAL_INTERCEPT,
        kResidualSlope: K_RESIDUAL_SLOPE,
        minimumPriorStarts: MIN_PRIOR_STARTS,
      },
      featureSemantics: {
        priorErAll: 'MLB Official earnedRuns over prior starts only, strict game date < target date',
        pitcherKRate: 'sum strikeouts / sum batters faced over all prior appearances, strict game date < target date',
      },
      targetIdentitySource: PA13_SOURCE,
      targetRows: pointPredictions.length,
      eligibleRows,
      blockedRows,
      pointPredictions,
      evaluationStatus: 'AWAITING_FINAL_OUTCOMES',
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      probabilityLayerAuthorized: false,
      marketRecommendationAuthorized: false,
      sportsbookInputToModel: false,
      historicalPricingCertified: false,
      roiCertified: false,
      clvCertified: false,
      evCertified: false,
      officialPicksModified: false,
      apostarActivated: false,
      modelRetuned: false,
      oddsApiCalls: 0,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (error) throw new Error(`PA12_ER_V2_FREEZE_WRITE_FAILED:${error.message}`)

  return {
    ...base,
    status: eligibleRows ? 'FROZEN_POINT_PREDICTIONS_AVAILABLE' : 'FROZEN_NO_ELIGIBLE_PREDICTIONS',
    freezeJobId: inserted?.id ?? null,
    frozenAt,
    targetRows: pointPredictions.length,
    eligibleRows,
    blockedRows,
    writes: 1,
    providerCalls: { MLB_OFFICIAL_GAMELOG: pitcherIds.length, sportsbook: 0 },
  }
}
