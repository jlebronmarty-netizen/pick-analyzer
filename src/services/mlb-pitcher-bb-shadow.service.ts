import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type Row = Record<string, unknown>
type JsonMap = Record<string, unknown>

const MODEL_VERSION = 'MLB_PITCHER_BB_V1'
const MIN_PRIOR_APPEARANCES = 3
const BIN_WIDTH = 0.25
const MIN_CALIBRATION_BIN_N = 20
const SOURCE_RULE = 'source_game_date < target_game_date'
const ELIGIBLE_LINES = [0.5, 1.5, 2.5, 3.5] as const
const POINT = {
  intercept: 1.02751690958322,
  coefficient: 0.395408983049705,
} as const

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(value: unknown, label: string) {
  const valueNumber = numberOrNull(value)
  if (valueNumber === null) throw new Error(`Missing pitcher BB feature: ${label}`)
  return valueNumber
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function jsonMap(value: unknown): JsonMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : {}
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
    .select('id,status')
    .eq('sport_key', 'baseball_mlb')
    .eq('model_family', 'pitcher_walks')
    .eq('target', 'pitcher_walks_allowed')
    .maybeSingle()
  if (registry.error) throw new Error(`Pitcher BB registry read failed: ${registry.error.message}`)
  if (!registry.data) throw new Error('Pitcher BB model registry row is missing')

  const version = await supabaseAdmin
    .from('pick2_model_versions')
    .select('model_version,role,status,hyperparameters,metrics,artifact_digest')
    .eq('model_id', registry.data.id)
    .eq('model_version', MODEL_VERSION)
    .maybeSingle()
  if (version.error) throw new Error(`Pitcher BB model version read failed: ${version.error.message}`)
  if (!version.data) throw new Error(`Pitcher BB model version ${MODEL_VERSION} is missing`)

  const hyper = jsonMap(version.data.hyperparameters)
  const activation = text(hyper.activation)
  if (version.data.role !== 'shadow' || version.data.status !== 'validated' || activation !== 'SHADOW_RESEARCH_ONLY_NO_BETTING_MARKET') {
    throw new Error('Pitcher BB shadow model is not in the certified read-only state')
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

export async function getMlbPitcherBbShadowProjection(input: {
  targetGamePk: number
  pitcherId: number
  line?: number
}) {
  const [modelState, featureResult] = await Promise.all([
    readModelState(),
    supabaseAdmin
      .from('pick2_mlb_pitcher_daily_features')
      .select('target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,as_of_timestamp,feature_version,bb_rate,sample_sizes,source_window')
      .eq('target_game_pk', input.targetGamePk)
      .eq('mlbam_pitcher_id', input.pitcherId)
      .maybeSingle(),
  ])

  if (featureResult.error) throw new Error(`Pitcher BB feature read failed: ${featureResult.error.message}`)
  if (!featureResult.data) {
    return { status: 'NO_PITCHER_FEATURE' as const, model: modelState, targetGamePk: input.targetGamePk, pitcherId: input.pitcherId }
  }

  const feature = featureResult.data as Row
  const samples = jsonMap(feature.sample_sizes)
  const sourceWindow = jsonMap(feature.source_window)
  const featureDate = text(feature.feature_date)
  const asOfDate = text(feature.as_of_date)
  const sourceRule = text(sourceWindow.rule)
  if (!featureDate || !asOfDate || !(asOfDate < featureDate) || sourceRule !== SOURCE_RULE) {
    return {
      status: 'FEATURE_LINEAGE_NOT_CERTIFIED' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      featureDate,
      asOfDate,
      sourceRule,
    }
  }

  const priorAppearances = requiredNumber(samples.sample_size, 'sample_sizes.sample_size')
  const priorPlateAppearances = requiredNumber(samples.plate_appearances, 'sample_sizes.plate_appearances')
  if (priorAppearances < MIN_PRIOR_APPEARANCES || priorPlateAppearances <= 0) {
    return {
      status: 'INSUFFICIENT_PITCHER_HISTORY' as const,
      model: modelState,
      targetGamePk: input.targetGamePk,
      pitcherId: input.pitcherId,
      priorAppearances,
      minimumPriorAppearances: MIN_PRIOR_APPEARANCES,
    }
  }

  const expectedBf = priorPlateAppearances / priorAppearances
  const pitcherBbRate = requiredNumber(feature.bb_rate, 'pitcher.bb_rate')
  const component = expectedBf * pitcherBbRate
  const expectedWalks = Math.max(0, POINT.intercept + POINT.coefficient * component)

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
      const predictionBin = Math.floor(expectedWalks / BIN_WIDTH)
      const calibration = await supabaseAdmin
        .from('mlb_pitcher_bb_probability_calibration_v1_mv')
        .select('prediction_bin,bin_width,line,sample_size,over_count,over_probability')
        .eq('prediction_bin', predictionBin)
        .eq('line', input.line)
        .maybeSingle()
      if (calibration.error) throw new Error(`Pitcher BB calibration read failed: ${calibration.error.message}`)
      if (!calibration.data) {
        probability = { status: 'NO_CALIBRATION_BIN', requestedLine: input.line, predictionBin }
      } else {
        const sampleSize = requiredNumber(calibration.data.sample_size, 'calibration.sample_size')
        if (sampleSize < MIN_CALIBRATION_BIN_N) {
          probability = {
            status: 'INSUFFICIENT_CALIBRATION_SAMPLE', requestedLine: input.line, predictionBin,
            sampleSize, minimumSampleSize: MIN_CALIBRATION_BIN_N,
          }
        } else {
          const overProbability = requiredNumber(calibration.data.over_probability, 'calibration.over_probability')
          probability = {
            status: 'READY', line: input.line, overProbability, underProbability: 1 - overProbability,
            predictionBin, binWidth: requiredNumber(calibration.data.bin_width, 'calibration.bin_width'),
            sampleSize, overCount: requiredNumber(calibration.data.over_count, 'calibration.over_count'),
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
    labelSemantics: {
      target: 'BASES_ON_BALLS',
      includesIntentionalWalks: true,
      includesHitByPitch: false,
      legacyFieldWarning: 'Historical target_walks was BB + HBP and is not used as the canonical BB target.',
    },
    featureState: {
      featureDate,
      asOfDate,
      featureVersion: text(feature.feature_version),
      priorAppearances,
      priorPlateAppearances,
      expectedBattersFaced: expectedBf,
      sampleTier: sampleTier(priorAppearances),
    },
    inputs: { pitcherBbRate, expectedBfXPitcherBbRate: component },
    projection: { pointModel: 'pitcher_only_linear_v1', expectedWalks },
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
