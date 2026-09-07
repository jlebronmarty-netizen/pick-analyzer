import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type Row = Record<string, unknown>
type JsonMap = Record<string, unknown>

const MODEL_VERSION = 'MLB_PITCHER_K_V1'
const MIN_PRIOR_APPEARANCES = 3
const CALIBRATION_BIN_WIDTH = 0.5
const MIN_CALIBRATION_BIN_N = 20
const ELIGIBLE_LINES = [2.5, 3.5, 4.5, 5.5] as const

const POINT = {
  intercept: -2.622576341,
  f1: 0.219063783,
  f2: 0.371261292,
  whiffRate: 8.599311891,
  cswRate: -1.981295523,
  strikeRate: 8.780276885,
  velocityDelta: 0.012324355,
  previousPitchCount: 0.007749663,
  daysRest: -0.016077654,
  opponentIso: -4.380281204,
  opponentRunsPerGame: 0.015153048,
} as const

const PROBABILITY = {
  intercept: 1.224497,
  f1: 0.5789,
  f2: 0.184751,
} as const

const CANONICAL_TEAM_ALIAS: Record<string, string> = {
  AZ: 'ARI',
  CWS: 'CHW',
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(value: unknown, label: string) {
  const parsed = numberOrNull(value)
  if (parsed === null) throw new Error(`Missing pitcher K feature: ${label}`)
  return parsed
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function jsonMap(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : {}
}

function canonicalTeam(team: string) {
  const upper = team.trim().toUpperCase()
  return CANONICAL_TEAM_ALIAS[upper] ?? upper
}

function eligibleLine(line: number) {
  return ELIGIBLE_LINES.some((candidate) => Math.abs(candidate - line) < 1e-9)
}

function sampleTier(priorAppearances: number) {
  if (priorAppearances >= 10) return 'HIGH' as const
  if (priorAppearances >= 6) return 'MEDIUM' as const
  return 'LOW' as const
}

async function readModelState() {
  const registry = await supabaseAdmin
    .from('pick2_model_registry')
    .select('id, status')
    .eq('sport_key', 'baseball_mlb')
    .eq('model_family', 'pitcher_strikeouts')
    .eq('target', 'pitcher_strikeouts')
    .maybeSingle()
  if (registry.error) throw new Error(`Pitcher K registry read failed: ${registry.error.message}`)
  if (!registry.data) throw new Error('Pitcher K model registry row is missing')

  const version = await supabaseAdmin
    .from('pick2_model_versions')
    .select('model_version, role, status, hyperparameters, metrics, artifact_digest')
    .eq('model_id', registry.data.id)
    .eq('model_version', MODEL_VERSION)
    .maybeSingle()
  if (version.error) throw new Error(`Pitcher K model version read failed: ${version.error.message}`)
  if (!version.data) throw new Error(`Pitcher K model version ${MODEL_VERSION} is missing`)

  const hyper = jsonMap(version.data.hyperparameters)
  const activation = text(hyper.activation)
  if (version.data.role !== 'shadow' || version.data.status !== 'validated' || activation !== 'SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET') {
    throw new Error('Pitcher K shadow model is not in the certified read-only state')
  }

  return {
    registryStatus: String(registry.data.status),
    modelVersion: String(version.data.model_version),
    role: String(version.data.role),
    status: String(version.data.status),
    activation,
    artifactDigest: text(version.data.artifact_digest),
    metrics: version.data.metrics,
  }
}

export async function getMlbPitcherKShadowProjection(input: {
  targetGamePk: number
  pitcherId: number
  opponentTeam: string
  line?: number
}) {
  const opponentTeam = canonicalTeam(input.opponentTeam)

  const [modelState, pitcherResult, teamIdentityResult] = await Promise.all([
    readModelState(),
    supabaseAdmin
      .from('pick2_mlb_pitcher_daily_features')
      .select('target_game_pk, mlbam_pitcher_id, feature_date, as_of_date, as_of_timestamp, feature_version, k_rate, bb_rate, whiff_rate, csw_rate, strike_rate, swing_rate, avg_release_speed, velocity_delta, previous_pitch_count, days_rest, sample_sizes, source_window')
      .eq('target_game_pk', input.targetGamePk)
      .eq('mlbam_pitcher_id', input.pitcherId)
      .maybeSingle(),
    supabaseAdmin
      .from('sports_teams')
      .select('id, abbreviation, name')
      .eq('sport_key', 'baseball_mlb')
      .eq('abbreviation', opponentTeam)
      .maybeSingle(),
  ])

  if (pitcherResult.error) throw new Error(`Pitcher K feature read failed: ${pitcherResult.error.message}`)
  if (teamIdentityResult.error) throw new Error(`Opponent team identity read failed: ${teamIdentityResult.error.message}`)
  if (!pitcherResult.data) {
    return {
      status: 'NO_PITCHER_FEATURE' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      opponentTeam,
    }
  }
  if (!teamIdentityResult.data) {
    return {
      status: 'NO_OPPONENT_TEAM_IDENTITY' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      opponentTeam,
    }
  }

  const opponentResult = await supabaseAdmin
    .from('pick2_mlb_team_daily_features')
    .select('target_game_pk, team_id, feature_date, as_of_date, as_of_timestamp, feature_version, recent_k_rate, recent_bb_rate, recent_runs_per_game, recent_iso, sample_sizes, source_window')
    .eq('target_game_pk', input.targetGamePk)
    .eq('team_id', teamIdentityResult.data.id)
    .maybeSingle()
  if (opponentResult.error) throw new Error(`Opponent K feature read failed: ${opponentResult.error.message}`)
  if (!opponentResult.data) {
    return {
      status: 'NO_OPPONENT_FEATURE' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      opponentTeam,
      opponentTeamId: teamIdentityResult.data.id,
    }
  }

  const pitcher = pitcherResult.data as Row
  const opponent = opponentResult.data as Row
  const samples = jsonMap(pitcher.sample_sizes)
  const priorAppearances = requiredNumber(samples.sample_size, 'sample_sizes.sample_size')
  const priorPlateAppearances = requiredNumber(samples.plate_appearances, 'sample_sizes.plate_appearances')
  if (priorAppearances < MIN_PRIOR_APPEARANCES || priorPlateAppearances <= 0) {
    return {
      status: 'INSUFFICIENT_PITCHER_HISTORY' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      opponentTeam,
      priorAppearances,
      minimumPriorAppearances: MIN_PRIOR_APPEARANCES,
    }
  }

  const expectedBf = priorPlateAppearances / priorAppearances
  const pitcherKRate = requiredNumber(pitcher.k_rate, 'pitcher.k_rate')
  const opponentKRate = requiredNumber(opponent.recent_k_rate, 'opponent.recent_k_rate')
  const f1 = expectedBf * pitcherKRate
  const f2 = expectedBf * opponentKRate

  const pointProjection =
    POINT.intercept +
    POINT.f1 * f1 +
    POINT.f2 * f2 +
    POINT.whiffRate * requiredNumber(pitcher.whiff_rate, 'pitcher.whiff_rate') +
    POINT.cswRate * requiredNumber(pitcher.csw_rate, 'pitcher.csw_rate') +
    POINT.strikeRate * requiredNumber(pitcher.strike_rate, 'pitcher.strike_rate') +
    POINT.velocityDelta * requiredNumber(pitcher.velocity_delta, 'pitcher.velocity_delta') +
    POINT.previousPitchCount * requiredNumber(pitcher.previous_pitch_count, 'pitcher.previous_pitch_count') +
    POINT.daysRest * requiredNumber(pitcher.days_rest, 'pitcher.days_rest') +
    POINT.opponentIso * requiredNumber(opponent.recent_iso, 'opponent.recent_iso') +
    POINT.opponentRunsPerGame * requiredNumber(opponent.recent_runs_per_game, 'opponent.recent_runs_per_game')

  const probabilityProjection = PROBABILITY.intercept + PROBABILITY.f1 * f1 + PROBABILITY.f2 * f2

  let probability:
    | { status: 'NOT_REQUESTED' }
    | { status: 'LINE_NOT_CERTIFIED'; requestedLine: number; eligibleLines: readonly number[] }
    | { status: 'NO_CALIBRATION_BIN'; requestedLine: number; predictionBin: number }
    | { status: 'INSUFFICIENT_CALIBRATION_SAMPLE'; requestedLine: number; predictionBin: number; sampleSize: number; minimumSampleSize: number }
    | { status: 'READY'; line: number; overProbability: number; underProbability: number; predictionBin: number; binWidth: number; sampleSize: number; overCount: number }
    = { status: 'NOT_REQUESTED' }

  if (input.line !== undefined) {
    if (!eligibleLine(input.line)) {
      probability = { status: 'LINE_NOT_CERTIFIED', requestedLine: input.line, eligibleLines: ELIGIBLE_LINES }
    } else {
      const predictionBin = Math.floor(probabilityProjection / CALIBRATION_BIN_WIDTH)
      const calibration = await supabaseAdmin
        .from('mlb_pitcher_k_probability_calibration_v1_mv')
        .select('prediction_bin, bin_width, line, sample_size, over_count, over_probability')
        .eq('prediction_bin', predictionBin)
        .eq('line', input.line)
        .maybeSingle()
      if (calibration.error) throw new Error(`Pitcher K calibration read failed: ${calibration.error.message}`)
      if (!calibration.data) {
        probability = { status: 'NO_CALIBRATION_BIN', requestedLine: input.line, predictionBin }
      } else {
        const sampleSize = requiredNumber(calibration.data.sample_size, 'calibration.sample_size')
        if (sampleSize < MIN_CALIBRATION_BIN_N) {
          probability = {
            status: 'INSUFFICIENT_CALIBRATION_SAMPLE',
            requestedLine: input.line,
            predictionBin,
            sampleSize,
            minimumSampleSize: MIN_CALIBRATION_BIN_N,
          }
        } else {
          const overProbability = requiredNumber(calibration.data.over_probability, 'calibration.over_probability')
          probability = {
            status: 'READY',
            line: input.line,
            overProbability,
            underProbability: 1 - overProbability,
            predictionBin,
            binWidth: requiredNumber(calibration.data.bin_width, 'calibration.bin_width'),
            sampleSize,
            overCount: requiredNumber(calibration.data.over_count, 'calibration.over_count'),
          }
        }
      }
    }
  }

  return {
    status: 'READY' as const,
    model: modelState,
    targetGamePk: input.targetGamePk,
    pitcherId: input.pitcherId,
    opponentTeam,
    opponentTeamId: String(teamIdentityResult.data.id),
    featureState: {
      pitcherFeatureDate: text(pitcher.feature_date),
      pitcherAsOfDate: text(pitcher.as_of_date),
      opponentFeatureDate: text(opponent.feature_date),
      opponentAsOfDate: text(opponent.as_of_date),
      featureVersion: text(pitcher.feature_version),
      priorAppearances,
      priorPlateAppearances,
      expectedBattersFaced: expectedBf,
      sampleTier: sampleTier(priorAppearances),
    },
    inputs: {
      pitcherKRate,
      opponentKRate,
      pitcherWhiffRate: requiredNumber(pitcher.whiff_rate, 'pitcher.whiff_rate'),
      pitcherCswRate: requiredNumber(pitcher.csw_rate, 'pitcher.csw_rate'),
      pitcherStrikeRate: requiredNumber(pitcher.strike_rate, 'pitcher.strike_rate'),
      pitcherVelocityDelta: requiredNumber(pitcher.velocity_delta, 'pitcher.velocity_delta'),
      previousPitchCount: requiredNumber(pitcher.previous_pitch_count, 'pitcher.previous_pitch_count'),
      daysRest: requiredNumber(pitcher.days_rest, 'pitcher.days_rest'),
      opponentIso: requiredNumber(opponent.recent_iso, 'opponent.recent_iso'),
      opponentRunsPerGame: requiredNumber(opponent.recent_runs_per_game, 'opponent.recent_runs_per_game'),
    },
    projection: {
      pointModel: 'ridge_lambda_50',
      expectedStrikeouts: pointProjection,
      probabilityProjection,
    },
    probability,
    safety: {
      activation: 'SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET',
      recommendation: null,
      expectedValue: null,
      sportsbookPriceUsed: false,
      providerCalls: 0,
      officialPickWrites: 0,
    },
  }
}
