import 'server-only'

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Split = 'TRAIN' | 'VALIDATION' | 'TEST' | 'HOLDOUT'
type Row = { split: Split; homeWin: number; features: number[] }
type Scale = { means: number[]; scales: number[] }
type Fit = { weights: number[]; lambda: number }

const MODEL_VERSION = 'MLB_MONEYLINE_V1'
const RESEARCH_VERSION = 'MLB_GAME_MODELS_RESEARCH_V1'
const PAGE_SIZE = 1000
const LAMBDAS = [0, 0.01, 0.1, 1, 10, 50] as const
const FEATURE_NAMES = [
  'recent_runs_per_game_diff',
  'recent_iso_diff',
  'recent_bb_rate_diff',
  'recent_k_rate_diff',
  'starter_k_minus_bb_rate_diff',
  'starter_whiff_rate_diff',
  'starter_csw_rate_diff',
  'starter_strike_rate_diff',
  'bullpen_k_minus_bb_rate_diff',
  'bullpen_whiff_rate_diff',
  'bullpen_pitches_24h_diff',
  'bullpen_high_workload_count_diff',
] as const

function num(value: unknown, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid Moneyline artifact field: ${label}`)
  return parsed
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sigmoid(value: number) {
  if (value >= 0) {
    const exp = Math.exp(-value)
    return 1 / (1 + exp)
  }
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-9, Math.max(1e-9, value))
}

function dot(a: number[], b: number[]) {
  let total = 0
  for (let index = 0; index < a.length; index += 1) total += a[index] * b[index]
  return total
}

function standardizer(rows: number[][]): Scale {
  const width = rows[0]?.length ?? 0
  const means = Array.from({ length: width }, (_, column) => mean(rows.map((row) => row[column])))
  const scales = Array.from({ length: width }, (_, column) => {
    const variance = mean(rows.map((row) => (row[column] - means[column]) ** 2))
    const sd = Math.sqrt(variance)
    return sd > 1e-9 ? sd : 1
  })
  return { means, scales }
}

function design(values: number[], scale: Scale) {
  return [1, ...values.map((value, index) => (value - scale.means[index]) / scale.scales[index])]
}

function logisticLoss(x: number[][], y: number[], weights: number[], lambda: number) {
  let loss = 0
  for (let row = 0; row < x.length; row += 1) {
    const probability = clampProbability(sigmoid(dot(x[row], weights)))
    loss -= y[row] * Math.log(probability) + (1 - y[row]) * Math.log(1 - probability)
  }
  loss /= x.length
  let penalty = 0
  for (let index = 1; index < weights.length; index += 1) penalty += weights[index] ** 2
  return loss + (lambda * penalty) / (2 * x.length)
}

function fitLogistic(x: number[][], y: number[], lambda: number): Fit | null {
  const width = x[0]?.length ?? 0
  if (!width || !x.length) return null
  const eventRate = clampProbability(mean(y))
  let weights = Array(width).fill(0) as number[]
  weights[0] = Math.log(eventRate / (1 - eventRate))
  let previousLoss = logisticLoss(x, y, weights, lambda)
  for (let iteration = 0; iteration < 1200; iteration += 1) {
    const gradient = Array(width).fill(0) as number[]
    for (let row = 0; row < x.length; row += 1) {
      const probability = sigmoid(dot(x[row], weights))
      const error = probability - y[row]
      for (let column = 0; column < width; column += 1) gradient[column] += x[row][column] * error
    }
    for (let column = 0; column < width; column += 1) {
      gradient[column] /= x.length
      if (column > 0) gradient[column] += (lambda * weights[column]) / x.length
    }
    const norm = Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
    if (!Number.isFinite(norm)) return null
    if (norm < 1e-7) break
    let step = 1
    let accepted = false
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = weights.map((value, index) => value - step * gradient[index])
      const candidateLoss = logisticLoss(x, y, candidate, lambda)
      if (Number.isFinite(candidateLoss) && candidateLoss <= previousLoss - 1e-8 * step * norm * norm) {
        weights = candidate
        if (Math.abs(previousLoss - candidateLoss) < 1e-10) return { weights, lambda }
        previousLoss = candidateLoss
        accepted = true
        break
      }
      step *= 0.5
    }
    if (!accepted) break
  }
  return weights.every(Number.isFinite) ? { weights, lambda } : null
}

function metrics(rows: Row[], fit: Fit, scale: Scale, baseline: number) {
  const probabilities = rows.map((row) => clampProbability(sigmoid(dot(design(row.features, scale), fit.weights))))
  const actual = rows.map((row) => row.homeWin)
  const brier = mean(probabilities.map((probability, index) => (probability - actual[index]) ** 2))
  const baselineBrier = mean(actual.map((value) => (baseline - value) ** 2))
  return {
    n: rows.length,
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    actualRate: mean(actual),
    predictedRate: mean(probabilities),
    bias: mean(probabilities) - mean(actual),
  }
}

async function fetchRows(): Promise<Row[]> {
  const output: Row[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_game_models_backtest_rows_v1_mv')
      .select('game_date,game_pk,fixed_split,home_win,home_team_k_rate,home_team_bb_rate,home_team_runs_per_game,home_team_iso,away_team_k_rate,away_team_bb_rate,away_team_runs_per_game,away_team_iso,home_starter_k_minus_bb_rate,home_starter_whiff_rate,home_starter_csw_rate,home_starter_strike_rate,away_starter_k_minus_bb_rate,away_starter_whiff_rate,away_starter_csw_rate,away_starter_strike_rate,home_bullpen_k_minus_bb_rate,home_bullpen_whiff_rate,home_bullpen_pitches_24h,home_bullpen_high_workload_count,away_bullpen_k_minus_bb_rate,away_bullpen_whiff_rate,away_bullpen_pitches_24h,away_bullpen_high_workload_count')
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`Moneyline artifact read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const homeRuns = num(row.home_team_runs_per_game, 'home_team_runs_per_game')
      const awayRuns = num(row.away_team_runs_per_game, 'away_team_runs_per_game')
      const homeIso = num(row.home_team_iso, 'home_team_iso')
      const awayIso = num(row.away_team_iso, 'away_team_iso')
      const homeBb = num(row.home_team_bb_rate, 'home_team_bb_rate')
      const awayBb = num(row.away_team_bb_rate, 'away_team_bb_rate')
      const homeK = num(row.home_team_k_rate, 'home_team_k_rate')
      const awayK = num(row.away_team_k_rate, 'away_team_k_rate')
      const homeStarterKbb = num(row.home_starter_k_minus_bb_rate, 'home_starter_k_minus_bb_rate')
      const awayStarterKbb = num(row.away_starter_k_minus_bb_rate, 'away_starter_k_minus_bb_rate')
      const homeStarterWhiff = num(row.home_starter_whiff_rate, 'home_starter_whiff_rate')
      const awayStarterWhiff = num(row.away_starter_whiff_rate, 'away_starter_whiff_rate')
      const homeStarterCsw = num(row.home_starter_csw_rate, 'home_starter_csw_rate')
      const awayStarterCsw = num(row.away_starter_csw_rate, 'away_starter_csw_rate')
      const homeStarterStrike = num(row.home_starter_strike_rate, 'home_starter_strike_rate')
      const awayStarterStrike = num(row.away_starter_strike_rate, 'away_starter_strike_rate')
      const homeBullpenKbb = num(row.home_bullpen_k_minus_bb_rate, 'home_bullpen_k_minus_bb_rate')
      const awayBullpenKbb = num(row.away_bullpen_k_minus_bb_rate, 'away_bullpen_k_minus_bb_rate')
      const homeBullpenWhiff = num(row.home_bullpen_whiff_rate, 'home_bullpen_whiff_rate')
      const awayBullpenWhiff = num(row.away_bullpen_whiff_rate, 'away_bullpen_whiff_rate')
      const homeBullpen24 = num(row.home_bullpen_pitches_24h, 'home_bullpen_pitches_24h')
      const awayBullpen24 = num(row.away_bullpen_pitches_24h, 'away_bullpen_pitches_24h')
      const homeBullpenLoad = num(row.home_bullpen_high_workload_count, 'home_bullpen_high_workload_count')
      const awayBullpenLoad = num(row.away_bullpen_high_workload_count, 'away_bullpen_high_workload_count')
      output.push({
        split: String(row.fixed_split) as Split,
        homeWin: row.home_win === true ? 1 : 0,
        features: [
          homeRuns-awayRuns, homeIso-awayIso, homeBb-awayBb, homeK-awayK,
          homeStarterKbb-awayStarterKbb, homeStarterWhiff-awayStarterWhiff,
          homeStarterCsw-awayStarterCsw, homeStarterStrike-awayStarterStrike,
          homeBullpenKbb-awayBullpenKbb, homeBullpenWhiff-awayBullpenWhiff,
          homeBullpen24-awayBullpen24, homeBullpenLoad-awayBullpenLoad,
        ],
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

export async function getMlbMoneylineFrozenArtifact() {
  const rows = await fetchRows()
  const train = rows.filter((row) => row.split === 'TRAIN')
  const validation = rows.filter((row) => row.split === 'VALIDATION')
  const test = rows.filter((row) => row.split === 'TEST')
  const holdout = rows.filter((row) => row.split === 'HOLDOUT')
  if (!train.length || !validation.length || !test.length || !holdout.length) throw new Error('Moneyline artifact split incomplete')
  const scale = standardizer(train.map((row) => row.features))
  const trainX = train.map((row) => design(row.features, scale))
  const trainY = train.map((row) => row.homeWin)
  const trainRate = mean(trainY)
  const candidates = LAMBDAS.flatMap((lambda) => {
    const fit = fitLogistic(trainX, trainY, lambda)
    if (!fit) return []
    return [{ fit, validation: metrics(validation, fit, scale, trainRate) }]
  }).sort((a, b) => a.validation.brier - b.validation.brier || a.fit.lambda - b.fit.lambda)
  const selected = candidates[0]
  if (!selected) throw new Error('No stable Moneyline artifact candidate')
  const evaluation = {
    validation: selected.validation,
    fixedTest2025: metrics(test, selected.fit, scale, trainRate),
    externalHoldout2026: metrics(holdout, selected.fit, scale, trainRate),
  }
  const blockers: string[] = []
  if ((evaluation.validation.brierSkill ?? -1) <= 0) blockers.push('VALIDATION_BRIER_SKILL_NOT_POSITIVE')
  if ((evaluation.fixedTest2025.brierSkill ?? -1) <= 0) blockers.push('FIXED_TEST_BRIER_SKILL_NOT_POSITIVE')
  if ((evaluation.externalHoldout2026.brierSkill ?? -1) <= 0) blockers.push('HOLDOUT_BRIER_SKILL_NOT_POSITIVE')
  if (Math.abs(evaluation.externalHoldout2026.bias) > 0.04) blockers.push('HOLDOUT_CALIBRATION_BIAS_TOO_HIGH')
  const artifact = {
    modelVersion: MODEL_VERSION,
    parentResearchVersion: RESEARCH_VERSION,
    type: 'ridge_logistic_gradient_descent_backtracking',
    selectedLambda: selected.fit.lambda,
    featureNames: FEATURE_NAMES,
    interceptAndStandardizedWeights: selected.fit.weights,
    standardizer: scale,
    trainHomeWinRate: trainRate,
    trainingContract: 'TRAIN_2025_ONLY_NO_REFIT_AFTER_VALIDATION_SELECTION',
  }
  const artifactDigest = createHash('sha256').update(JSON.stringify(artifact)).digest('hex')
  return {
    modelVersion: MODEL_VERSION,
    status: blockers.length ? 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW' : 'VALIDATED_SHADOW_ARTIFACT',
    shadowEligible: blockers.length === 0,
    blockers,
    artifact,
    artifactDigest,
    evaluation,
    dataQuality: {
      splitCounts: { train: train.length, validation: validation.length, fixedTest2025: test.length, externalHoldout2026: holdout.length },
      leakageDetected: false,
      sourceRule: 'source_game_date < target_game_date',
    },
    safety: {
      providerCalls: 0,
      theOddsApiCreditsConsumed: 0,
      officialPickWrites: 0,
      bettingActivated: false,
      productionEligible: false,
      recommendation: null,
      expectedValue: null,
    },
  }
}
