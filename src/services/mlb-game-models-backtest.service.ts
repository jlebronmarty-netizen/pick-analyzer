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
type LinearFit = { weights: number[]; lambda: number }
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
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`Invalid MLB game-model field: ${label}`)
  return n
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-9, Math.max(1e-9, value))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const e = Math.exp(-value)
    return 1 / (1 + e)
  }
  const e = Math.exp(value)
  return e / (1 + e)
}

function dot(a: number[], b: number[]) {
  let out = 0
  for (let i = 0; i < a.length; i += 1) out += a[i] * b[i]
  return out
}

function standardizer(rows: number[][]): Standardizer {
  const width = rows[0]?.length ?? 0
  const means = Array.from({ length: width }, (_, j) => mean(rows.map((row) => row[j])))
  const scales = Array.from({ length: width }, (_, j) => {
    const variance = mean(rows.map((row) => (row[j] - means[j]) ** 2))
    const sd = Math.sqrt(variance)
    return sd > 1e-9 ? sd : 1
  })
  return { means, scales }
}

function transform(values: number[], s: Standardizer) {
  return values.map((value, i) => (value - s.means[i]) / s.scales[i])
}

function design(values: number[], s: Standardizer) {
  return [1, ...transform(values, s)]
}

function solveLinearSystem(aInput: number[][], bInput: number[]) {
  const n = bInput.length
  const a = aInput.map((row, i) => [...row, bInput[i]])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    const divisor = a[col][col]
    for (let k = col; k <= n; k += 1) a[col][k] /= divisor
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = a[row][col]
      if (factor === 0) continue
      for (let k = col; k <= n; k += 1) a[row][k] -= factor * a[col][k]
    }
  }
  return a.map((row) => row[n])
}

function fitRidge(x: number[][], y: number[], lambda: number): LinearFit {
  const p = x[0].length
  const xtx = Array.from({ length: p }, () => Array(p).fill(0) as number[])
  const xty = Array(p).fill(0) as number[]
  for (let i = 0; i < x.length; i += 1) {
    for (let j = 0; j < p; j += 1) {
      xty[j] += x[i][j] * y[i]
      for (let k = 0; k < p; k += 1) xtx[j][k] += x[i][j] * x[i][k]
    }
  }
  for (let j = 1; j < p; j += 1) xtx[j][j] += lambda
  const weights = solveLinearSystem(xtx, xty)
  if (!weights) throw new Error('Game-model ridge solve failed')
  return { weights, lambda }
}

function fitLogistic(x: number[][], y: number[], lambda: number): LinearFit {
  const p = x[0].length
  let weights = Array(p).fill(0) as number[]
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const hessian = Array.from({ length: p }, () => Array(p).fill(0) as number[])
    const gradient = Array(p).fill(0) as number[]
    for (let i = 0; i < x.length; i += 1) {
      const prob = sigmoid(dot(x[i], weights))
      const variance = Math.max(1e-6, prob * (1 - prob))
      for (let j = 0; j < p; j += 1) {
        gradient[j] += x[i][j] * (y[i] - prob)
        for (let k = 0; k < p; k += 1) hessian[j][k] += variance * x[i][j] * x[i][k]
      }
    }
    for (let j = 1; j < p; j += 1) {
      gradient[j] -= lambda * weights[j]
      hessian[j][j] += lambda
    }
    const step = solveLinearSystem(hessian, gradient)
    if (!step) throw new Error('Game-model logistic solve failed')
    let maxStep = 0
    weights = weights.map((value, j) => {
      maxStep = Math.max(maxStep, Math.abs(step[j]))
      return value + step[j]
    })
    if (maxStep < 1e-8) break
  }
  return { weights, lambda }
}

function regressionMetrics(rows: Scored[]) {
  const errors = rows.map((row) => row.predicted - row.actual)
  const avgActual = mean(rows.map((row) => row.actual))
  const avgPred = mean(rows.map((row) => row.predicted))
  let covariance = 0
  let predVar = 0
  let actualVar = 0
  for (const row of rows) {
    covariance += (row.predicted - avgPred) * (row.actual - avgActual)
    predVar += (row.predicted - avgPred) ** 2
    actualVar += (row.actual - avgActual) ** 2
  }
  return {
    n: rows.length,
    mae: mean(errors.map((error) => Math.abs(error))),
    rmse: Math.sqrt(mean(errors.map((error) => error * error))),
    bias: mean(errors),
    correlation: predVar > 0 && actualVar > 0 ? covariance / Math.sqrt(predVar * actualVar) : null,
    averagePrediction: avgPred,
    averageActual: avgActual,
  }
}

function probabilityMetrics(actual: number[], predicted: number[], frozenRate: number) {
  const probabilities = predicted.map(clampProbability)
  const brier = mean(probabilities.map((p, i) => (p - actual[i]) ** 2))
  const baselineBrier = mean(actual.map((v) => (frozenRate - v) ** 2))
  const logLoss = -mean(probabilities.map((p, i) => actual[i] * Math.log(p) + (1 - actual[i]) * Math.log(1 - p)))
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

function residualProbability(predicted: number, line: number, residuals: number[]) {
  let count = 0
  const threshold = line - predicted
  for (const residual of residuals) if (residual > threshold) count += 1
  return (count + 0.5) / (residuals.length + 1)
}

function thresholdReport(rows: Scored[], trainResiduals: number[], lines: readonly number[]) {
  return lines.map((line) => {
    const actual = rows.map((row) => (row.actual > line ? 1 : 0))
    const predicted = rows.map((row) => residualProbability(row.predicted, line, trainResiduals))
    const frozenRate = mean(trainResiduals.map(() => 0))
    void frozenRate
    return { line, actual, predicted }
  })
}

async function fetchRows(): Promise<GameRow[]> {
  const output: GameRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_game_models_backtest_rows_v1_mv')
      .select('game_date,fixed_split,home_win,home_run_margin,total_runs,home_team_k_rate,home_team_bb_rate,home_team_runs_per_game,home_team_iso,away_team_k_rate,away_team_bb_rate,away_team_runs_per_game,away_team_iso,home_starter_k_minus_bb_rate,home_starter_whiff_rate,home_starter_csw_rate,home_starter_strike_rate,away_starter_k_minus_bb_rate,away_starter_whiff_rate,away_starter_csw_rate,away_starter_strike_rate,home_bullpen_k_minus_bb_rate,home_bullpen_whiff_rate,home_bullpen_pitches_24h,home_bullpen_high_workload_count,away_bullpen_k_minus_bb_rate,away_bullpen_whiff_rate,away_bullpen_pitches_24h,away_bullpen_high_workload_count')
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
      const homeSkbb = num(row.home_starter_k_minus_bb_rate, 'home_starter_k_minus_bb_rate')
      const awaySkbb = num(row.away_starter_k_minus_bb_rate, 'away_starter_k_minus_bb_rate')
      const homeSwhiff = num(row.home_starter_whiff_rate, 'home_starter_whiff_rate')
      const awaySwhiff = num(row.away_starter_whiff_rate, 'away_starter_whiff_rate')
      const homeScsw = num(row.home_starter_csw_rate, 'home_starter_csw_rate')
      const awayScsw = num(row.away_starter_csw_rate, 'away_starter_csw_rate')
      const homeSstrike = num(row.home_starter_strike_rate, 'home_starter_strike_rate')
      const awaySstrike = num(row.away_starter_strike_rate, 'away_starter_strike_rate')
      const homeBkbb = num(row.home_bullpen_k_minus_bb_rate, 'home_bullpen_k_minus_bb_rate')
      const awayBkbb = num(row.away_bullpen_k_minus_bb_rate, 'away_bullpen_k_minus_bb_rate')
      const homeBwhiff = num(row.home_bullpen_whiff_rate, 'home_bullpen_whiff_rate')
      const awayBwhiff = num(row.away_bullpen_whiff_rate, 'away_bullpen_whiff_rate')
      const homeB24 = num(row.home_bullpen_pitches_24h, 'home_bullpen_pitches_24h')
      const awayB24 = num(row.away_bullpen_pitches_24h, 'away_bullpen_pitches_24h')
      const homeBload = num(row.home_bullpen_high_workload_count, 'home_bullpen_high_workload_count')
      const awayBload = num(row.away_bullpen_high_workload_count, 'away_bullpen_high_workload_count')
      output.push({
        gameDate: String(row.game_date),
        split: String(row.fixed_split) as Split,
        homeWin: row.home_win === true ? 1 : 0,
        margin: num(row.home_run_margin, 'home_run_margin'),
        total: num(row.total_runs, 'total_runs'),
        diff: [homeRuns-awayRuns,homeIso-awayIso,homeBb-awayBb,homeK-awayK,homeSkbb-awaySkbb,homeSwhiff-awaySwhiff,homeScsw-awayScsw,homeSstrike-awaySstrike,homeBkbb-awayBkbb,homeBwhiff-awayBwhiff,homeB24-awayB24,homeBload-awayBload],
        sum: [homeRuns+awayRuns,homeIso+awayIso,homeBb+awayBb,homeK+awayK,homeSkbb+awaySkbb,homeSwhiff+awaySwhiff,homeScsw+awayScsw,homeSstrike+awaySstrike,homeBkbb+awayBkbb,homeBwhiff+awayBwhiff,homeB24+awayB24,homeBload+awayBload],
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

function scoreLinear(rows: GameRow[], fit: LinearFit, s: Standardizer, kind: 'margin' | 'total') {
  return rows.map((row) => ({ actual: kind === 'margin' ? row.margin : row.total, predicted: dot(design(kind === 'margin' ? row.diff : row.sum, s), fit.weights) }))
}

function selectLinear(train: GameRow[], validation: GameRow[], kind: 'margin' | 'total') {
  const vectors = train.map((row) => kind === 'margin' ? row.diff : row.sum)
  const s = standardizer(vectors)
  const trainX = vectors.map((values) => design(values, s))
  const trainY = train.map((row) => kind === 'margin' ? row.margin : row.total)
  const candidates = LAMBDAS.map((lambda) => {
    const fit = fitRidge(trainX, trainY, lambda)
    const metrics = regressionMetrics(scoreLinear(validation, fit, s, kind))
    return { lambda, fit, metrics }
  }).sort((a,b) => a.metrics.rmse - b.metrics.rmse || a.metrics.mae - b.metrics.mae || a.lambda - b.lambda)
  const selected = candidates[0]
  return { s, selected, top: candidates.slice(0,4).map(({lambda,metrics}) => ({lambda,metrics})) }
}

function selectMoneyline(train: GameRow[], validation: GameRow[]) {
  const s = standardizer(train.map((row) => row.diff))
  const trainX = train.map((row) => design(row.diff, s))
  const trainY = train.map((row) => row.homeWin)
  const trainRate = mean(trainY)
  const candidates = LAMBDAS.map((lambda) => {
    const fit = fitLogistic(trainX, trainY, lambda)
    const actual = validation.map((row) => row.homeWin)
    const predicted = validation.map((row) => sigmoid(dot(design(row.diff, s), fit.weights)))
    const metrics = probabilityMetrics(actual, predicted, trainRate)
    return { lambda, fit, metrics }
  }).sort((a,b) => a.metrics.brier - b.metrics.brier || a.lambda - b.lambda)
  return { s, trainRate, selected: candidates[0], top: candidates.slice(0,4).map(({lambda,metrics}) => ({lambda,metrics})) }
}

export async function getMlbGameModelsBacktest() {
  const rows = await fetchRows()
  const train = rows.filter((row) => row.split === 'TRAIN')
  const validation = rows.filter((row) => row.split === 'VALIDATION')
  const test = rows.filter((row) => row.split === 'TEST')
  const holdout = rows.filter((row) => row.split === 'HOLDOUT')
  if (!train.length || !validation.length || !test.length || !holdout.length) throw new Error('MLB game-model split is incomplete')

  const ml = selectMoneyline(train, validation)
  const mlEval = (target: GameRow[]) => probabilityMetrics(
    target.map((row) => row.homeWin),
    target.map((row) => sigmoid(dot(design(row.diff, ml.s), ml.selected.fit.weights))),
    ml.trainRate,
  )
  const mlMetrics = { train: mlEval(train), validation: ml.selected.metrics, fixedTest2025: mlEval(test), externalHoldout2026: mlEval(holdout) }
  const mlBlockers: string[] = []
  if ((mlMetrics.validation.brierSkill ?? -1) <= 0) mlBlockers.push('VALIDATION_BRIER_SKILL_NOT_POSITIVE')
  if ((mlMetrics.fixedTest2025.brierSkill ?? -1) <= 0) mlBlockers.push('FIXED_TEST_BRIER_SKILL_NOT_POSITIVE')
  if ((mlMetrics.externalHoldout2026.brierSkill ?? -1) <= 0) mlBlockers.push('HOLDOUT_BRIER_SKILL_NOT_POSITIVE')
  if (Math.abs(mlMetrics.externalHoldout2026.bias) > 0.04) mlBlockers.push('HOLDOUT_CALIBRATION_BIAS_TOO_HIGH')

  const margin = selectLinear(train, validation, 'margin')
  const marginTrain = scoreLinear(train, margin.selected.fit, margin.s, 'margin')
  const marginTest = scoreLinear(test, margin.selected.fit, margin.s, 'margin')
  const marginHoldout = scoreLinear(holdout, margin.selected.fit, margin.s, 'margin')
  const trainMarginMean = mean(train.map((row) => row.margin))
  const marginBaseline = (target: GameRow[]) => regressionMetrics(target.map((row) => ({actual: row.margin, predicted: trainMarginMean})))
  const marginResiduals = marginTrain.map((row) => row.actual - row.predicted)
  const runLineProb = (targetRows: GameRow[], scored: Scored[]) => RUN_LINES.map((line) => {
    const actual = scored.map((row) => row.actual > line ? 1 : 0)
    const predicted = scored.map((row) => residualProbability(row.predicted, line, marginResiduals))
    const frozenRate = mean(train.map((row) => row.margin > line ? 1 : 0))
    return { line, ...probabilityMetrics(actual, predicted, frozenRate) }
  })
  const marginMetrics = {
    validation: margin.selected.metrics,
    fixedTest2025: regressionMetrics(marginTest),
    externalHoldout2026: regressionMetrics(marginHoldout),
    baselines: { validation: marginBaseline(validation), fixedTest2025: marginBaseline(test), externalHoldout2026: marginBaseline(holdout) },
    probabilities: { fixedTest2025: runLineProb(test, marginTest), externalHoldout2026: runLineProb(holdout, marginHoldout) },
  }
  const marginBlockers: string[] = []
  if (marginMetrics.validation.rmse >= marginMetrics.baselines.validation.rmse) marginBlockers.push('VALIDATION_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.fixedTest2025.rmse >= marginMetrics.baselines.fixedTest2025.rmse) marginBlockers.push('FIXED_TEST_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.externalHoldout2026.rmse >= marginMetrics.baselines.externalHoldout2026.rmse) marginBlockers.push('HOLDOUT_RMSE_NOT_BETTER_THAN_BASELINE')
  if (marginMetrics.probabilities.fixedTest2025.some((row) => (row.brierSkill ?? -1) <= 0)) marginBlockers.push('FIXED_TEST_RUN_LINE_BRIER_SKILL_NOT_POSITIVE')
  if (marginMetrics.probabilities.externalHoldout2026.some((row) => (row.brierSkill ?? -1) <= 0)) marginBlockers.push('HOLDOUT_RUN_LINE_BRIER_SKILL_NOT_POSITIVE')

  const total = selectLinear(train, validation, 'total')
  const totalTrain = scoreLinear(train, total.selected.fit, total.s, 'total')
  const totalTest = scoreLinear(test, total.selected.fit, total.s, 'total')
  const totalHoldout = scoreLinear(holdout, total.selected.fit, total.s, 'total')
  const trainTotalMean = mean(train.map((row) => row.total))
  const totalBaseline = (target: GameRow[]) => regressionMetrics(target.map((row) => ({actual: row.total, predicted: trainTotalMean})))
  const totalResiduals = totalTrain.map((row) => row.actual - row.predicted)
  const totalProb = (scored: Scored[]) => TOTAL_LINES.map((line) => {
    const actual = scored.map((row) => row.actual > line ? 1 : 0)
    const predicted = scored.map((row) => residualProbability(row.predicted, line, totalResiduals))
    const frozenRate = mean(train.map((row) => row.total > line ? 1 : 0))
    return { line, ...probabilityMetrics(actual, predicted, frozenRate) }
  })
  const totalMetrics = {
    validation: total.selected.metrics,
    fixedTest2025: regressionMetrics(totalTest),
    externalHoldout2026: regressionMetrics(totalHoldout),
    baselines: { validation: totalBaseline(validation), fixedTest2025: totalBaseline(test), externalHoldout2026: totalBaseline(holdout) },
    probabilities: { fixedTest2025: totalProb(totalTest), externalHoldout2026: totalProb(totalHoldout) },
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
        status: mlBlockers.length ? 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW' : 'SHADOW_CANDIDATE_ONLY',
        shadowEligible: mlBlockers.length === 0,
        blockers: mlBlockers,
        selectedLambda: ml.selected.lambda,
        featureNames: DIFF_FEATURES,
        topValidationCandidates: ml.top,
        metrics: mlMetrics,
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
        selectedLambda: total.selected.lambda,
        featureNames: SUM_FEATURES,
        topValidationCandidates: total.top,
        metrics: totalMetrics,
      },
    },
    dataQuality: {
      rows: rows.length,
      splitCounts: { train: train.length, validation: validation.length, fixedTest2025: test.length, externalHoldout2026: holdout.length },
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
