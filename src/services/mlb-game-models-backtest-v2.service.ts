import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Split = 'TRAIN' | 'VALIDATION' | 'TEST' | 'HOLDOUT'
type GameRow = {
  gameDate: string
  split: Split
  homeWin: number
  margin: number
  total: number
  diff: number[]
  sum: number[]
}
type Standardizer = { means: number[]; scales: number[] }
type Fit = { weights: number[]; lambda: number }
type Scored = { actual: number; predicted: number }

const MODEL_VERSION = 'MLB_GAME_MODELS_RESEARCH_V1'
const PAGE_SIZE = 1000
const LAMBDAS = [0, 0.01, 0.1, 1, 10, 50] as const
const RUN_LINES = [-1.5, 1.5] as const
const TOTAL_LINES = [7.5, 8.5, 9.5, 10.5] as const

const DIFF_FEATURES = [
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

const SUM_FEATURES = [
  'recent_runs_per_game_sum',
  'recent_iso_sum',
  'recent_bb_rate_sum',
  'recent_k_rate_sum',
  'starter_k_minus_bb_rate_sum',
  'starter_whiff_rate_sum',
  'starter_csw_rate_sum',
  'starter_strike_rate_sum',
  'bullpen_k_minus_bb_rate_sum',
  'bullpen_whiff_rate_sum',
  'bullpen_pitches_24h_sum',
  'bullpen_high_workload_count_sum',
] as const

function num(value: unknown, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid MLB game-model field: ${label}`)
  return parsed
}

function mean(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-9, Math.max(1e-9, value))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const exp = Math.exp(-value)
    return 1 / (1 + exp)
  }
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function dot(a: number[], b: number[]) {
  let total = 0
  for (let index = 0; index < a.length; index += 1) total += a[index] * b[index]
  return total
}

function standardizer(rows: number[][]): Standardizer {
  const width = rows[0]?.length ?? 0
  const means = Array.from({ length: width }, (_, column) => mean(rows.map((row) => row[column])))
  const scales = Array.from({ length: width }, (_, column) => {
    const variance = mean(rows.map((row) => (row[column] - means[column]) ** 2))
    const standardDeviation = Math.sqrt(variance)
    return standardDeviation > 1e-9 ? standardDeviation : 1
  })
  return { means, scales }
}

function design(values: number[], scale: Standardizer) {
  return [1, ...values.map((value, index) => (value - scale.means[index]) / scale.scales[index])]
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-14) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    const divisor = augmented[column][column]
    for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      if (Math.abs(factor) < 1e-18) continue
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index]
      }
    }
  }
  return augmented.map((row) => row[size])
}

function fitRidge(x: number[][], y: number[], lambda: number): Fit | null {
  const width = x[0]?.length ?? 0
  if (!width) return null
  const xtx = Array.from({ length: width }, () => Array(width).fill(0) as number[])
  const xty = Array(width).fill(0) as number[]
  for (let row = 0; row < x.length; row += 1) {
    for (let left = 0; left < width; left += 1) {
      xty[left] += x[row][left] * y[row]
      for (let right = 0; right < width; right += 1) xtx[left][right] += x[row][left] * x[row][right]
    }
  }
  for (let index = 0; index < width; index += 1) {
    xtx[index][index] += index === 0 ? 1e-8 : lambda + 1e-8
  }
  const weights = solveLinearSystem(xtx, xty)
  return weights ? { weights, lambda } : null
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
    const gradientNorm = Math.sqrt(gradient.reduce((sum, value) => sum + value * value, 0))
    if (!Number.isFinite(gradientNorm)) return null
    if (gradientNorm < 1e-7) break

    let stepSize = 1
    let accepted = false
    let candidate = weights
    let candidateLoss = previousLoss
    for (let attempt = 0; attempt < 24; attempt += 1) {
      candidate = weights.map((value, index) => value - stepSize * gradient[index])
      candidateLoss = logisticLoss(x, y, candidate, lambda)
      if (Number.isFinite(candidateLoss) && candidateLoss <= previousLoss - 1e-8 * stepSize * gradientNorm * gradientNorm) {
        accepted = true
        break
      }
      stepSize *= 0.5
    }
    if (!accepted) break
    weights = candidate
    if (Math.abs(previousLoss - candidateLoss) < 1e-10) break
    previousLoss = candidateLoss
  }

  if (weights.some((value) => !Number.isFinite(value))) return null
  return { weights, lambda }
}

function regressionMetrics(rows: Scored[]) {
  const errors = rows.map((row) => row.predicted - row.actual)
  const averageActual = mean(rows.map((row) => row.actual))
  const averagePrediction = mean(rows.map((row) => row.predicted))
  let covariance = 0
  let predictionVariance = 0
  let actualVariance = 0
  for (const row of rows) {
    covariance += (row.predicted - averagePrediction) * (row.actual - averageActual)
    predictionVariance += (row.predicted - averagePrediction) ** 2
    actualVariance += (row.actual - averageActual) ** 2
  }
  return {
    n: rows.length,
    mae: mean(errors.map((error) => Math.abs(error))),
    rmse: Math.sqrt(mean(errors.map((error) => error * error))),
    bias: mean(errors),
    correlation: predictionVariance > 0 && actualVariance > 0 ? covariance / Math.sqrt(predictionVariance * actualVariance) : null,
    averagePrediction,
    averageActual,
  }
}

function probabilityMetrics(actual: number[], predicted: number[], frozenRate: number) {
  const probabilities = predicted.map(clampProbability)
  const brier = mean(probabilities.map((probability, index) => (probability - actual[index]) ** 2))
  const baselineBrier = mean(actual.map((value) => (frozenRate - value) ** 2))
  const logLoss = -mean(probabilities.map((probability, index) => {
    return actual[index] * Math.log(probability) + (1 - actual[index]) * Math.log(1 - probability)
  }))
  return {
    n: actual.length,
    brier,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brier / baselineBrier : null,
    logLoss,
    actualRate: mean(actual),
    predictedRate: mean(probabilities),
    bias: mean(probabilities) - mean(actual),
  }
}

function residualProbability(prediction: number, line: number, residuals: number[]) {
  const threshold = line - prediction
  let over = 0
  for (const residual of residuals) if (residual > threshold) over += 1
  return (over + 0.5) / (residuals.length + 1)
}

async function fetchRows(): Promise<GameRow[]> {
  const output: GameRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_game_models_backtest_rows_v1_mv')
      .select('game_date,game_pk,fixed_split,home_win,home_run_margin,total_runs,home_team_k_rate,home_team_bb_rate,home_team_runs_per_game,home_team_iso,away_team_k_rate,away_team_bb_rate,away_team_runs_per_game,away_team_iso,home_starter_k_minus_bb_rate,home_starter_whiff_rate,home_starter_csw_rate,home_starter_strike_rate,away_starter_k_minus_bb_rate,away_starter_whiff_rate,away_starter_csw_rate,away_starter_strike_rate,home_bullpen_k_minus_bb_rate,home_bullpen_whiff_rate,home_bullpen_pitches_24h,home_bullpen_high_workload_count,away_bullpen_k_minus_bb_rate,away_bullpen_whiff_rate,away_bullpen_pitches_24h,away_bullpen_high_workload_count')
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`MLB game-model read failed: ${error.message}`)
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
      const homeBullpenWorkload = num(row.home_bullpen_high_workload_count, 'home_bullpen_high_workload_count')
      const awayBullpenWorkload = num(row.away_bullpen_high_workload_count, 'away_bullpen_high_workload_count')
      output.push({
        gameDate: String(row.game_date),
        split: String(row.fixed_split) as Split,
        homeWin: row.home_win === true ? 1 : 0,
        margin: num(row.home_run_margin, 'home_run_margin'),
        total: num(row.total_runs, 'total_runs'),
        diff: [
          homeRuns - awayRuns,
          homeIso - awayIso,
          homeBb - awayBb,
          homeK - awayK,
          homeStarterKbb - awayStarterKbb,
          homeStarterWhiff - awayStarterWhiff,
          homeStarterCsw - awayStarterCsw,
          homeStarterStrike - awayStarterStrike,
          homeBullpenKbb - awayBullpenKbb,
          homeBullpenWhiff - awayBullpenWhiff,
          homeBullpen24 - awayBullpen24,
          homeBullpenWorkload - awayBullpenWorkload,
        ],
        sum: [
          homeRuns + awayRuns,
          homeIso + awayIso,
          homeBb + awayBb,
          homeK + awayK,
          homeStarterKbb + awayStarterKbb,
          homeStarterWhiff + awayStarterWhiff,
          homeStarterCsw + awayStarterCsw,
          homeStarterStrike + awayStarterStrike,
          homeBullpenKbb + awayBullpenKbb,
          homeBullpenWhiff + awayBullpenWhiff,
          homeBullpen24 + awayBullpen24,
          homeBullpenWorkload + awayBullpenWorkload,
        ],
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

function scoreLinear(rows: GameRow[], fit: Fit, scale: Standardizer, target: 'margin' | 'total') {
  return rows.map((row) => ({
    actual: target === 'margin' ? row.margin : row.total,
    predicted: dot(design(target === 'margin' ? row.diff : row.sum, scale), fit.weights),
  }))
}

function selectLinear(train: GameRow[], validation: GameRow[], target: 'margin' | 'total') {
  const scale = standardizer(train.map((row) => target === 'margin' ? row.diff : row.sum))
  const trainX = train.map((row) => design(target === 'margin' ? row.diff : row.sum, scale))
  const trainY = train.map((row) => target === 'margin' ? row.margin : row.total)
  const candidates = LAMBDAS.flatMap((lambda) => {
    const fit = fitRidge(trainX, trainY, lambda)
    if (!fit) return []
    return [{ lambda, fit, metrics: regressionMetrics(scoreLinear(validation, fit, scale, target)) }]
  }).sort((left, right) => left.metrics.rmse - right.metrics.rmse || left.metrics.mae - right.metrics.mae || left.lambda - right.lambda)
  const selected = candidates[0]
  if (!selected) throw new Error(`No stable ${target} ridge candidate`)
  return { scale, selected, top: candidates.slice(0, 4).map(({ lambda, metrics }) => ({ lambda, metrics })) }
}

function selectMoneyline(train: GameRow[], validation: GameRow[]) {
  const scale = standardizer(train.map((row) => row.diff))
  const trainX = train.map((row) => design(row.diff, scale))
  const trainY = train.map((row) => row.homeWin)
  const trainRate = mean(trainY)
  const candidates = LAMBDAS.flatMap((lambda) => {
    const fit = fitLogistic(trainX, trainY, lambda)
    if (!fit) return []
    const actual = validation.map((row) => row.homeWin)
    const predicted = validation.map((row) => sigmoid(dot(design(row.diff, scale), fit.weights)))
    return [{ lambda, fit, metrics: probabilityMetrics(actual, predicted, trainRate) }]
  }).sort((left, right) => left.metrics.brier - right.metrics.brier || left.lambda - right.lambda)
  const selected = candidates[0]
  if (!selected) throw new Error('No stable Moneyline logistic candidate')
  return { scale, trainRate, selected, top: candidates.slice(0, 4).map(({ lambda, metrics }) => ({ lambda, metrics })) }
}

export async function getMlbGameModelsBacktest() {
  const rows = await fetchRows()
  const train = rows.filter((row) => row.split === 'TRAIN')
  const validation = rows.filter((row) => row.split === 'VALIDATION')
  const test = rows.filter((row) => row.split === 'TEST')
  const holdout = rows.filter((row) => row.split === 'HOLDOUT')
  if (!train.length || !validation.length || !test.length || !holdout.length) {
    throw new Error('MLB game-model split is incomplete')
  }

  const moneyline = selectMoneyline(train, validation)
  const evaluateMoneyline = (target: GameRow[]) => probabilityMetrics(
    target.map((row) => row.homeWin),
    target.map((row) => sigmoid(dot(design(row.diff, moneyline.scale), moneyline.selected.fit.weights))),
    moneyline.trainRate,
  )
  const moneylineMetrics = {
    train: evaluateMoneyline(train),
    validation: moneyline.selected.metrics,
    fixedTest2025: evaluateMoneyline(test),
    externalHoldout2026: evaluateMoneyline(holdout),
  }
  const moneylineBlockers: string[] = []
  if ((moneylineMetrics.validation.brierSkill ?? -1) <= 0) moneylineBlockers.push('VALIDATION_BRIER_SKILL_NOT_POSITIVE')
  if ((moneylineMetrics.fixedTest2025.brierSkill ?? -1) <= 0) moneylineBlockers.push('FIXED_TEST_BRIER_SKILL_NOT_POSITIVE')
  if ((moneylineMetrics.externalHoldout2026.brierSkill ?? -1) <= 0) moneylineBlockers.push('HOLDOUT_BRIER_SKILL_NOT_POSITIVE')
  if (Math.abs(moneylineMetrics.externalHoldout2026.bias) > 0.04) moneylineBlockers.push('HOLDOUT_CALIBRATION_BIAS_TOO_HIGH')

  const margin = selectLinear(train, validation, 'margin')
  const marginTrain = scoreLinear(train, margin.selected.fit, margin.scale, 'margin')
  const marginTest = scoreLinear(test, margin.selected.fit, margin.scale, 'margin')
  const marginHoldout = scoreLinear(holdout, margin.selected.fit, margin.scale, 'margin')
  const trainMarginMean = mean(train.map((row) => row.margin))
  const marginBaseline = (target: GameRow[]) => regressionMetrics(target.map((row) => ({ actual: row.margin, predicted: trainMarginMean })))
  const marginResiduals = marginTrain.map((row) => row.actual - row.predicted)
  const runLineProbability = (scored: Scored[]) => RUN_LINES.map((line) => {
    const actual = scored.map((row) => row.actual > line ? 1 : 0)
    const predicted = scored.map((row) => residualProbability(row.predicted, line, marginResiduals))
    const frozenRate = mean(train.map((row) => row.margin > line ? 1 : 0))
    return { line, ...probabilityMetrics(actual, predicted, frozenRate) }
  })
  const marginMetrics = {
    validation: margin.selected.metrics,
    fixedTest2025: regressionMetrics(marginTest),
    externalHoldout2026: regressionMetrics(marginHoldout),
    baselines: {
      validation: marginBaseline(validation),
      fixedTest2025: marginBaseline(test),
      externalHoldout2026: marginBaseline(holdout),
    },
    probabilities: {
      fixedTest2025: runLineProbability(marginTest),
      externalHoldout2026: runLineProbability(marginHoldout),
    },
  }
  const marginBlockers: string[] = []
  if (marginMetrics.validation.rmse >= marginMetrics.baselines.validation.rmse) marginBlockers.push('VALIDATION_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.fixedTest2025.rmse >= marginMetrics.baselines.fixedTest2025.rmse) marginBlockers.push('FIXED_TEST_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.externalHoldout2026.rmse >= marginMetrics.baselines.externalHoldout2026.rmse) marginBlockers.push('HOLDOUT_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.probabilities.fixedTest2025.some((row) => (row.brierSkill ?? -1) <= 0)) marginBlockers.push('FIXED_TEST_RUN_LINE_BRIER_SKILL_NOT_POSITIVE')
  if (marginMetrics.probabilities.externalHoldout2026.some((row) => (row.brierSkill ?? -1) <= 0)) marginBlockers.push('HOLDOUT_RUN_LINE_BRIER_SKILL_NOT_POSITIVE')

  const totals = selectLinear(train, validation, 'total')
  const totalTrain = scoreLinear(train, totals.selected.fit, totals.scale, 'total')
  const totalTest = scoreLinear(test, totals.selected.fit, totals.scale, 'total')
  const totalHoldout = scoreLinear(holdout, totals.selected.fit, totals.scale, 'total')
  const trainTotalMean = mean(train.map((row) => row.total))
  const totalBaseline = (target: GameRow[]) => regressionMetrics(target.map((row) => ({ actual: row.total, predicted: trainTotalMean })))
  const totalResiduals = totalTrain.map((row) => row.actual - row.predicted)
  const totalProbability = (scored: Scored[]) => TOTAL_LINES.map((line) => {
    const actual = scored.map((row) => row.actual > line ? 1 : 0)
    const predicted = scored.map((row) => residualProbability(row.predicted, line, totalResiduals))
    const frozenRate = mean(train.map((row) => row.total > line ? 1 : 0))
    return { line, ...probabilityMetrics(actual, predicted, frozenRate) }
  })
  const totalMetrics = {
    validation: totals.selected.metrics,
    fixedTest2025: regressionMetrics(totalTest),
    externalHoldout2026: regressionMetrics(totalHoldout),
    baselines: {
      validation: totalBaseline(validation),
      fixedTest2025: totalBaseline(test),
      externalHoldout2026: totalBaseline(holdout),
    },
    probabilities: {
      fixedTest2025: totalProbability(totalTest),
      externalHoldout2026: totalProbability(totalHoldout),
    },
  }
  const totalBlockers: string[] = []
  if (totalMetrics.validation.rmse >= totalMetrics.baselines.validation.rmse) totalBlockers.push('VALIDATION_RMSE_NOT_BETTER_THAN_BASELINE')
  if (totalMetrics.fixedTest2025.rmse >= totalMetrics.baselines.fixedTest2025.rmse) totalBlockers.push('FIXED_TEST_RMSE_NOT_BETTER_THAN_BASELINE')
  if (totalMetrics.externalHoldout2026.rmse >= totalMetrics.baselines.externalHoldout2026.rmse) totalBlockers.push('HOLDOUT_RMSE_NOT_BETTER_THAN_BASELINE')
  if (totalMetrics.probabilities.fixedTest2025.some((row) => (row.brierSkill ?? -1) <= 0)) totalBlockers.push('FIXED_TEST_TOTAL_BRIER_SKILL_NOT_POSITIVE')
  if (totalMetrics.probabilities.externalHoldout2026.some((row) => (row.brierSkill ?? -1) <= 0)) totalBlockers.push('HOLDOUT_TOTAL_BRIER_SKILL_NOT_POSITIVE')

  return {
    modelVersion: MODEL_VERSION,
    status: 'RESEARCH_COMPLETE',
    markets: {
      moneyline: {
        status: moneylineBlockers.length ? 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW' : 'SHADOW_CANDIDATE_ONLY',
        shadowEligible: moneylineBlockers.length === 0,
        blockers: moneylineBlockers,
        selectedLambda: moneyline.selected.lambda,
        featureNames: DIFF_FEATURES,
        topValidationCandidates: moneyline.top,
        metrics: moneylineMetrics,
      },
      runLine: {
        status: marginBlockers.length ? 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW' : 'SHADOW_CANDIDATE_ONLY',
        shadowEligible: marginBlockers.length === 0,
        blockers: marginBlockers,
        selectedLambda: margin.selected.lambda,
        featureNames: DIFF_FEATURES,
        topValidationCandidates: margin.top,
        metrics: marginMetrics,
      },
      totals: {
        status: totalBlockers.length ? 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW' : 'SHADOW_CANDIDATE_ONLY',
        shadowEligible: totalBlockers.length === 0,
        blockers: totalBlockers,
        selectedLambda: totals.selected.lambda,
        featureNames: SUM_FEATURES,
        topValidationCandidates: totals.top,
        metrics: totalMetrics,
      },
    },
    dataQuality: {
      rows: rows.length,
      splitCounts: {
        train: train.length,
        validation: validation.length,
        fixedTest2025: test.length,
        externalHoldout2026: holdout.length,
      },
      leakageDetected: false,
      sourceRule: 'source_game_date < target_game_date',
    },
    safety: {
      sportsbookOddsUsed: false,
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
