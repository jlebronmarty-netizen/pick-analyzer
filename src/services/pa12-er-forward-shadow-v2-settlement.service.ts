import 'server-only'

import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { mapConcurrent, readMlbOfficialPitcherGameLog } from '@/services/mlb-official-pitcher-gamelog.service'

const SEASON = 2026
const MODEL_VERSION = 'MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2'
const FREEZE_JOB_TYPE = 'pa12_er_forward_shadow_v2_freeze_v1'
const PILOT_JOB_TYPE = 'pa12_er_forward_shadow_v2_audit_v1'
const SETTLEMENT_JOB_TYPE = 'pa12_er_forward_shadow_v2_settlement_v1'
const PROVIDER = 'internal-model'

type PointPrediction = {
  gamePk?: number
  pitcherMlbamId?: number
  pitcherId?: number
  pitcherName?: string | null
  predictedEr?: number | null
  eligible?: boolean
  targetStart?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asPredictions(metadata: Record<string, unknown>) {
  if (Array.isArray(metadata.pointPredictions)) {
    return metadata.pointPredictions.filter((row): row is PointPrediction => Boolean(row && typeof row === 'object'))
  }
  const result = asRecord(metadata.result)
  const forward = asRecord(result.forward)
  return Array.isArray(forward.predictions)
    ? forward.predictions.filter((row): row is PointPrediction => Boolean(row && typeof row === 'object'))
    : []
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveInteger(value: unknown) {
  const parsed = n(value)
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function correlation(rows: Array<{ predictedEr: number; actualEr: number }>) {
  if (rows.length < 2) return null
  const px = mean(rows.map((row) => row.predictedEr))
  const ay = mean(rows.map((row) => row.actualEr))
  if (px === null || ay === null) return null
  let numerator = 0
  let x2 = 0
  let y2 = 0
  for (const row of rows) {
    const x = row.predictedEr - px
    const y = row.actualEr - ay
    numerator += x * y
    x2 += x * x
    y2 += y * y
  }
  return x2 > 0 && y2 > 0 ? numerator / Math.sqrt(x2 * y2) : null
}

async function findFreeze(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,job_type,completed_at,metadata')
    .in('job_type', [FREEZE_JOB_TYPE, PILOT_JOB_TYPE])
    .eq('sport_key', 'baseball_mlb')
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`PA12_ER_V2_SETTLEMENT_FREEZE_READ_FAILED:${error.message}`)

  return (data ?? []).find((row) => {
    const metadata = asRecord(row.metadata)
    return metadata.targetDate === targetDate
  }) ?? null
}

async function findSettlement(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,completed_at,metadata')
    .eq('job_type', SETTLEMENT_JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('provider', PROVIDER)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`PA12_ER_V2_SETTLEMENT_EXISTING_READ_FAILED:${error.message}`)

  return (data ?? []).find((row) => asRecord(row.metadata).targetDate === targetDate) ?? null
}

async function officialScheduleState(targetDate: string) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}`,
    { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
  )
  if (!response.ok) throw new Error(`PA12_ER_V2_SCHEDULE_HTTP_${response.status}`)
  const payload = await response.json() as any
  const games = (payload?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])

  const map = new Map<number, 'FINAL' | 'NO_PLAY' | 'PENDING'>()
  for (const game of games) {
    const gamePk = Number(game?.gamePk)
    if (!Number.isSafeInteger(gamePk) || gamePk <= 0) continue
    const detailed = String(game?.status?.detailedState ?? '').toLowerCase()
    const abstract = String(game?.status?.abstractGameState ?? '')
    const coded = String(game?.status?.codedGameState ?? '')
    if (abstract === 'Final' || coded === 'F' || detailed.includes('final')) map.set(gamePk, 'FINAL')
    else if (detailed.includes('postpon') || detailed.includes('cancel')) map.set(gamePk, 'NO_PLAY')
    else map.set(gamePk, 'PENDING')
  }
  return map
}

export async function settlePa12ErForwardShadowV2(targetDate: string) {
  const base = {
    success: true,
    modelVersion: MODEL_VERSION,
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
  }

  const prior = await findSettlement(targetDate)
  if (prior) {
    const metadata = asRecord(prior.metadata)
    return {
      ...base,
      status: 'REUSE_NO_OP',
      settlementJobId: prior.id,
      settledAt: prior.completed_at,
      scoredRows: Number(metadata.scoredRows ?? 0),
      mae: metadata.mae ?? null,
      rmse: metadata.rmse ?? null,
    }
  }

  const freeze = await findFreeze(targetDate)
  if (!freeze) return { ...base, status: 'WAITING_FOR_FREEZE' }

  const freezeMetadata = asRecord(freeze.metadata)
  const predictions = asPredictions(freezeMetadata).flatMap((row) => {
    if (row.eligible !== true) return []
    const gamePk = positiveInteger(row.gamePk)
    const pitcherMlbamId = positiveInteger(row.pitcherMlbamId ?? row.pitcherId)
    const predictedEr = n(row.predictedEr)
    if (gamePk === null || pitcherMlbamId === null || predictedEr === null) return []
    return [{
      gamePk,
      pitcherMlbamId,
      pitcherName: row.pitcherName ?? null,
      predictedEr,
      targetStart: row.targetStart ?? null,
    }]
  })

  if (!predictions.length) {
    return { ...base, status: 'WAITING_FOR_ELIGIBLE_POINT_PREDICTIONS' }
  }

  const schedule = await officialScheduleState(targetDate)
  const pendingGames = [...new Set(predictions.map((row) => row.gamePk).filter((gamePk) => schedule.get(gamePk) === 'PENDING' || !schedule.has(gamePk)))]
  if (pendingGames.length) {
    return { ...base, status: 'WAITING_FOR_FINAL_SCHEDULE', pendingGames }
  }

  const noPlayGames = new Set(
    predictions.map((row) => row.gamePk).filter((gamePk) => schedule.get(gamePk) === 'NO_PLAY'),
  )
  const scoreable = predictions.filter((row) => !noPlayGames.has(row.gamePk))
  const pitcherIds = [...new Set(scoreable.map((row) => row.pitcherMlbamId))]
  const gameLogs = await mapConcurrent(pitcherIds, 8, async (pitcherId) => ({
    pitcherId,
    rows: await readMlbOfficialPitcherGameLog(pitcherId, SEASON),
  }))
  const byPitcher = new Map(gameLogs.map((row) => [row.pitcherId, row.rows]))

  const unresolved: Array<{ gamePk: number; pitcherMlbamId: number }> = []
  const results = scoreable.flatMap((prediction) => {
    const outcome = (byPitcher.get(prediction.pitcherMlbamId) ?? []).find((row) => row.gamePk === prediction.gamePk)
    if (!outcome || outcome.earnedRuns === null) {
      unresolved.push({ gamePk: prediction.gamePk, pitcherMlbamId: prediction.pitcherMlbamId })
      return []
    }
    return [{
      ...prediction,
      actualEr: outcome.earnedRuns,
      error: prediction.predictedEr - outcome.earnedRuns,
      absoluteError: Math.abs(prediction.predictedEr - outcome.earnedRuns),
      squaredError: (prediction.predictedEr - outcome.earnedRuns) ** 2,
    }]
  })

  if (unresolved.length) {
    return { ...base, status: 'WAITING_FOR_FINAL_ER_OUTCOMES', unresolved }
  }

  const mae = mean(results.map((row) => row.absoluteError))
  const mse = mean(results.map((row) => row.squaredError))
  const bias = mean(results.map((row) => row.error))
  const averagePrediction = mean(results.map((row) => row.predictedEr))
  const averageActual = mean(results.map((row) => row.actualEr))
  const corr = correlation(results)
  const completedAt = new Date().toISOString()

  const { data: inserted, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: SETTLEMENT_JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: completedAt,
    completed_at: completedAt,
    status: 'completed',
    records_fetched: predictions.length,
    records_inserted: results.length,
    records_updated: 0,
    records_skipped: predictions.filter((row) => noPlayGames.has(row.gamePk)).length,
    error_count: 0,
    metadata: {
      checkpoint: SETTLEMENT_JOB_TYPE,
      targetDate,
      freezeJobId: freeze.id,
      freezeJobType: freeze.job_type,
      freezeCompletedAt: freeze.completed_at,
      modelVersion: MODEL_VERSION,
      scoredRows: results.length,
      noPlayGames: [...noPlayGames],
      mae,
      rmse: mse === null ? null : Math.sqrt(mse),
      bias,
      correlation: corr,
      averagePrediction,
      averageActual,
      results,
      outcomeSource: 'MLB_STATSAPI_GAMELOG_EARNED_RUNS',
      forecastMetricsOnly: true,
      probabilityLayerAuthorized: false,
      marketRecommendationAuthorized: false,
      historicalPricingCertified: false,
      roiCertified: false,
      clvCertified: false,
      evCertified: false,
      researchOnly: true,
      shadowOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      modelRetuned: false,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (error) throw new Error(`PA12_ER_V2_SETTLEMENT_WRITE_FAILED:${error.message}`)

  return {
    ...base,
    status: 'SETTLED_FORECAST_METRICS',
    settlementJobId: inserted?.id ?? null,
    scoredRows: results.length,
    noPlayGames: [...noPlayGames],
    mae,
    rmse: mse === null ? null : Math.sqrt(mse),
    bias,
    correlation: corr,
    averagePrediction,
    averageActual,
    writes: 1,
    providerCalls: { MLB_OFFICIAL_SCHEDULE: 1, MLB_OFFICIAL_GAMELOG: pitcherIds.length, sportsbook: 0 },
  }
}
