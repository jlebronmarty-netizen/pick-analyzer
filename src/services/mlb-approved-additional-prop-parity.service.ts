import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const PITCHER_BB_MODEL_VERSION = 'MLB_PITCHER_BB_V1'
const PITCHER_BB_ARTIFACT_DIGEST = '6094bc6e096cd9a37f63dbdf58c3c683a9bab78fd01f44a3e13c2717a9681a17'

export const ADDITIONAL_PROP_RUNTIME_PARITY = Object.freeze({
  pitcher_walks: {
    certified: true,
    contract: 'MLB_PITCHER_WALKS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'pitcher_bb_under_2p5_p85_v1',
    frozenAccuracy: 125 / 137,
    external2026: { selected: 137, correct: 125 },
    modelVersion: PITCHER_BB_MODEL_VERSION,
    artifactDigest: PITCHER_BB_ARTIFACT_DIGEST,
  },
  pitcher_outs: {
    certified: false,
    contract: 'MLB_PITCHER_OUTS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'pitcher_outs_under_18p5_p90_v1',
    frozenAccuracy: 215 / 226,
    frozenExternal2026: { selected: 226, correct: 215 },
    blocker: 'PITCHER_OUTS_INPUT_LINEAGE_NOT_EXACTLY_RECONCILED',
    note: 'Frozen SportsDataIO/Statcast holdout fingerprint is 226/215. Exact-MLBAM xyear reconstruction over the same historical window yields a different selected universe, so runtime remains fail-closed until input lineage is reconciled without retuning.',
  },
  batter_hits: {
    certified: true,
    contract: 'MLB_BATTER_HITS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'batter_hits_under_1p5_edge_0p75_v1',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 40886, intercept: 0.362037519693316, slope: 0.562031288216736 },
    external2026: { eligible: 35558, selected: 9833, correct: 8496 },
  },
  batter_total_bases: {
    certified: true,
    contract: 'MLB_BATTER_TOTAL_BASES_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'batter_total_bases_under_2p5_edge_1p5_v1',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 40886, intercept: 0.599532796678854, slope: 0.563175501776575 },
    external2026: { eligible: 35558, selected: 2336, correct: 2021 },
  },
  batter_home_runs: {
    certified: true,
    contract: 'MLB_BATTER_HOME_RUNS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'batter_hr_under_0p5_proj_0p10_v1',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 40886, intercept: 0.0562641814171271, slope: 0.536870614141035 },
    external2026: { eligible: 35558, selected: 13507, correct: 12448 },
  },
  batter_strikeouts: {
    certified: true,
    contract: 'MLB_BATTER_STRIKEOUTS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'batter_k_under_1p5_proj_0p5_v1',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 40886, intercept: 0.243436273584974, slope: 0.713440597820141 },
    external2026: { eligible: 35558, selected: 1074, correct: 1000 },
  },
  batter_walks: {
    certified: true,
    contract: 'MLB_BATTER_WALKS_APPROVED_RUNTIME_PARITY/1.0.0',
    candidateId: 'batter_walks_under_0p5_proj_0p20_v1',
    strictPriorDate: true,
    sameDateHistoryAllowed: false,
    minimumPriorGames: 10,
    externalRefit2025: { n: 40886, intercept: 0.117815177785939, slope: 0.593708345578887 },
    external2026: { eligible: 35558, selected: 3106, correct: 2590 },
  },
})

type JsonMap = Record<string, unknown>

function asRecord(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {}
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function loadStrictBatterTargetFeatureKeys(targetDate: string, playerIds: number[]) {
  if (!playerIds.length) return new Set<string>()
  const result = await supabaseAdmin
    .from('pick2_mlb_batter_daily_features')
    .select('target_game_pk,mlbam_batter_id,feature_date,as_of_date,source_window')
    .eq('feature_date', targetDate)
    .eq('feature_version', SOURCE_FEATURE_VERSION)
    .in('mlbam_batter_id', playerIds)
    .order('target_game_pk', { ascending: true })
  if (result.error) throw new Error('MLB_ADDITIONAL_PROP_BATTER_FEATURE_READ_FAILED:' + result.error.message)

  const keys = new Set<string>()
  for (const row of result.data ?? []) {
    const gamePk = n(row.target_game_pk)
    const playerId = n(row.mlbam_batter_id)
    const featureDate = String(row.feature_date ?? '')
    const asOfDate = String(row.as_of_date ?? '')
    const sourceWindow = asRecord(row.source_window)
    if (
      gamePk !== null &&
      playerId !== null &&
      featureDate === targetDate &&
      asOfDate < targetDate &&
      String(sourceWindow.rule ?? '') === SOURCE_RULE
    ) {
      keys.add(String(gamePk) + ':' + String(playerId))
    }
  }
  return keys
}

const EXPECTED_BB_CALIBRATION_2P5 = [
  { predictionBin: 4, sampleSize: 112, overCount: 9, overProbability: 0.0803571428571429 },
  { predictionBin: 5, sampleSize: 420, overCount: 82, overProbability: 0.195238095238095 },
  { predictionBin: 6, sampleSize: 936, overCount: 221, overProbability: 0.236111111111111 },
  { predictionBin: 7, sampleSize: 837, overCount: 245, overProbability: 0.292712066905615 },
  { predictionBin: 8, sampleSize: 248, overCount: 72, overProbability: 0.290322580645161 },
  { predictionBin: 9, sampleSize: 17, overCount: 5, overProbability: 0.294117647058824 },
  { predictionBin: 10, sampleSize: 2, overCount: 1, overProbability: 0.5 },
] as const

function approx(a: unknown, b: number, tolerance = 1e-12) {
  const value = n(a)
  return value !== null && Math.abs(value - b) <= tolerance
}

export async function getPitcherWalksRuntimeParity() {
  const failures: string[] = []
  const registry = await supabaseAdmin
    .from('pick2_model_registry')
    .select('id,status')
    .eq('sport_key', 'baseball_mlb')
    .eq('model_family', 'pitcher_walks')
    .eq('target', 'pitcher_walks_allowed')
    .maybeSingle()
  if (registry.error) throw new Error('MLB_PITCHER_WALKS_PARITY_REGISTRY_READ_FAILED:' + registry.error.message)
  if (!registry.data) {
    return {
      certified: false,
      contract: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_walks.contract,
      failures: ['MODEL_REGISTRY_ROW_MISSING'],
    }
  }

  const version = await supabaseAdmin
    .from('pick2_model_versions')
    .select('model_version,role,status,hyperparameters,artifact_digest')
    .eq('model_id', registry.data.id)
    .eq('model_version', PITCHER_BB_MODEL_VERSION)
    .maybeSingle()
  if (version.error) throw new Error('MLB_PITCHER_WALKS_PARITY_VERSION_READ_FAILED:' + version.error.message)
  if (!version.data) failures.push('MODEL_VERSION_MISSING')
  else {
    const hyper = asRecord(version.data.hyperparameters)
    const point = asRecord(hyper.point_model)
    const probability = asRecord(hyper.probability_model)
    if (String(version.data.role) !== 'shadow') failures.push('MODEL_ROLE_NOT_SHADOW')
    if (String(version.data.status) !== 'validated') failures.push('MODEL_STATUS_NOT_VALIDATED')
    if (String(hyper.activation ?? '') !== 'SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET') failures.push('ACTIVATION_CONTRACT_MISMATCH')
    if (String(version.data.artifact_digest ?? '') !== PITCHER_BB_ARTIFACT_DIGEST) failures.push('ARTIFACT_DIGEST_MISMATCH')
    if (!approx(point.intercept, 1.02751690958322)) failures.push('POINT_INTERCEPT_MISMATCH')
    if (!approx(point.coefficient_expected_bf_x_pitcher_bb_rate, 0.395408983049705)) failures.push('POINT_COEFFICIENT_MISMATCH')
    if (!approx(probability.bin_width_bb, 0.25)) failures.push('CALIBRATION_BIN_WIDTH_MISMATCH')
    if (n(probability.minimum_calibration_bin_n) !== 20) failures.push('CALIBRATION_MIN_N_MISMATCH')
  }

  const calibration = await supabaseAdmin
    .from('mlb_pitcher_bb_probability_calibration_v1_mv')
    .select('prediction_bin,bin_width,line,sample_size,over_count,over_probability')
    .eq('line', 2.5)
    .order('prediction_bin', { ascending: true })
  if (calibration.error) throw new Error('MLB_PITCHER_WALKS_PARITY_CALIBRATION_READ_FAILED:' + calibration.error.message)
  if ((calibration.data ?? []).length !== EXPECTED_BB_CALIBRATION_2P5.length) failures.push('CALIBRATION_ROW_COUNT_MISMATCH')

  for (const expected of EXPECTED_BB_CALIBRATION_2P5) {
    const row = (calibration.data ?? []).find((item) => n(item.prediction_bin) === expected.predictionBin)
    if (!row) {
      failures.push('CALIBRATION_BIN_' + expected.predictionBin + '_MISSING')
      continue
    }
    if (!approx(row.bin_width, 0.25)) failures.push('CALIBRATION_BIN_' + expected.predictionBin + '_WIDTH_MISMATCH')
    if (n(row.sample_size) !== expected.sampleSize) failures.push('CALIBRATION_BIN_' + expected.predictionBin + '_N_MISMATCH')
    if (n(row.over_count) !== expected.overCount) failures.push('CALIBRATION_BIN_' + expected.predictionBin + '_OVER_COUNT_MISMATCH')
    if (!approx(row.over_probability, expected.overProbability)) failures.push('CALIBRATION_BIN_' + expected.predictionBin + '_PROBABILITY_MISMATCH')
  }

  return {
    certified: failures.length === 0,
    contract: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_walks.contract,
    modelVersion: PITCHER_BB_MODEL_VERSION,
    artifactDigest: PITCHER_BB_ARTIFACT_DIGEST,
    frozenExternal2026: ADDITIONAL_PROP_RUNTIME_PARITY.pitcher_walks.external2026,
    failures,
  }
}
