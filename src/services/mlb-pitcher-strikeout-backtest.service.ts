import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>

type HistoricalRow = {
  date: string
  split: 'TRAIN' | 'VALIDATION' | 'TEST'
  actual: number
  pitcherKRate: number
  opponentKRate: number
  priorKAll: number | null
  priorBfL5: number | null
  previousPitchCount: number
  priorPitches: number
  priorPlateAppearances: number
}

type CrossSeasonRow = {
  season: number
  gamePk: number
  date: string
  pitcherId: number
  actual: number
  actualBf: number
  pitcherKRate: number
  opponentKRate: number
  previousPitchCount: number
  priorPitches: number
  priorPlateAppearances: number
  sourceRule: string | null
  sourceAsOfDate: string | null
}

type Scored = { actual: number; predicted: number }

type Fit = { intercept: number; slope: number }

type Metrics = {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  correlation: number | null
  averagePrediction: number | null
  averageActual: number | null
}

const MODEL_VERSION = 'MLB_PITCHER_STRIKEOUT_RESEARCH_V1'
const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const PAGE_SIZE = 1000
const GRID = Array.from({ length: 11 }, (_, index) => index / 10)
const PROP_LINES = [3.5, 4.5, 5.5, 6.5, 7.5]

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(value: unknown, label: string) {
  const parsed = numberOrNull(value)
  if (parsed === null) throw new Error(`Missing numeric field ${label}`)
  return parsed
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function fetchPaged(table: string, columns: string, orderColumns: string[]) {
  const rows: RawRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabaseAdmin.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1)
    for (const column of orderColumns) query = query.order(column, { ascending: true })
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function loadHistorical2025(): Promise<HistoricalRow[]> {
  const rows = await fetchPaged(
    'mlb_pitcher_prop_backtest_2025_v1_enriched',
    'game_date,fixed_split,target_strikeouts,pitcher_k_rate,opponent_recent_k_rate,prior_k_all,prior_bf_l5,previous_pitch_count,pitcher_prior_pitches,pitcher_prior_plate_appearances',
    ['game_date'],
  )
  return rows.map((row) => ({
    date: String(row.game_date),
    split: String(row.fixed_split) as HistoricalRow['split'],
    actual: requiredNumber(row.target_strikeouts, 'target_strikeouts'),
    pitcherKRate: requiredNumber(row.pitcher_k_rate, 'pitcher_k_rate'),
    opponentKRate: requiredNumber(row.opponent_recent_k_rate, 'opponent_recent_k_rate'),
    priorKAll: numberOrNull(row.prior_k_all),
    priorBfL5: numberOrNull(row.prior_bf_l5),
    previousPitchCount: requiredNumber(row.previous_pitch_count, 'previous_pitch_count'),
    priorPitches: requiredNumber(row.pitcher_prior_pitches, 'pitcher_prior_pitches'),
    priorPlateAppearances: requiredNumber(row.pitcher_prior_plate_appearances, 'pitcher_prior_plate_appearances'),
  }))
}

async function loadCrossSeasonRows(): Promise<CrossSeasonRow[]> {
  const rows = await fetchPaged(
    'mlb_pitcher_strikeout_backtest_rows_v1_mv',
    'season,target_game_pk,feature_date,mlbam_pitcher_id,actual_strikeouts,actual_plate_appearances,pitcher_k_rate,opponent_k_rate,previous_pitch_count,prior_pitches,prior_plate_appearances,source_rule,source_as_of_date',
    ['feature_date', 'target_game_pk', 'mlbam_pitcher_id'],
  )
  return rows.map((row) => ({
    season: requiredNumber(row.season, 'season'),
    gamePk: requiredNumber(row.target_game_pk, 'target_game_pk'),
    date: String(row.feature_date),
    pitcherId: requiredNumber(row.mlbam_pitcher_id, 'mlbam_pitcher_id'),
    actual: requiredNumber(row.actual_strikeouts, 'actual_strikeouts'),
    actualBf: requiredNumber(row.actual_plate_appearances, 'actual_plate_appearances'),
    pitcherKRate: requiredNumber(row.pitcher_k_rate, 'pitcher_k_rate'),
    opponentKRate: requiredNumber(row.opponent_k_rate, 'opponent_k_rate'),
    previousPitchCount: requiredNumber(row.previous_pitch_count, 'previous_pitch_count'),
    priorPitches: requiredNumber(row.prior_pitches, 'prior_pitches'),
    priorPlateAppearances: requiredNumber(row.prior_plate_appearances, 'prior_plate_appearances'),
    sourceRule: text(row.source_rule),
    sourceAsOfDate: text(row.source_as_of_date),
  }))
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function rawScore(input: {
  pitcherKRate: number
  opponentKRate: number
  priorKAll: number | null
  priorBfL5: number | null
  previousPitchCount: number
  priorPitches: number
  priorPlateAppearances: number
  alpha: number
  beta: number
}) {
  const matchupRate = input.alpha * input.pitcherKRate + (1 - input.alpha) * input.opponentKRate
  if (input.priorKAll !== null && input.priorBfL5 !== null) {
    const matchupExpected = input.priorBfL5 * matchupRate
    return input.beta * matchupExpected + (1 - input.beta) * input.priorKAll
  }
  if (input.priorPitches <= 0 || input.priorPlateAppearances <= 0) return null
  const expectedBf = input.previousPitchCount * (input.priorPlateAppearances / input.priorPitches)
  return expectedBf * matchupRate
}

function linearFit(rows: Array<{ x: number; y: number }>): Fit | null {
  if (rows.length < 2) return null
  const meanX = mean(rows.map((row) => row.x))
  const meanY = mean(rows.map((row) => row.y))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let denominator = 0
  for (const row of rows) {
    numerator += (row.x - meanX) * (row.y - meanY)
    denominator += (row.x - meanX) ** 2
  }
  if (denominator <= 0) return null
  const slope = numerator / denominator
  return { intercept: meanY - slope * meanX, slope }
}

function correlation(rows: Scored[]) {
  if (rows.length < 2) return null
  const meanX = mean(rows.map((row) => row.predicted))
  const meanY = mean(rows.map((row) => row.actual))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let xSum = 0
  let ySum = 0
  for (const row of rows) {
    const x = row.predicted - meanX
    const y = row.actual - meanY
    numerator += x * y
    xSum += x * x
    ySum += y * y
  }
  return xSum > 0 && ySum > 0 ? numerator / Math.sqrt(xSum * ySum) : null
}

function metrics(rows: Scored[]): Metrics {
  if (!rows.length) {
    return { n: 0, mae: null, rmse: null, bias: null, correlation: null, averagePrediction: null, averageActual: null }
  }
  const errors = rows.map((row) => row.predicted - row.actual)
  return {
    n: rows.length,
    mae: mean(errors.map((error) => Math.abs(error))),
    rmse: Math.sqrt(mean(errors.map((error) => error * error)) ?? 0),
    bias: mean(errors),
    correlation: correlation(rows),
    averagePrediction: mean(rows.map((row) => row.predicted)),
    averageActual: mean(rows.map((row) => row.actual)),
  }
}

function fitHistorical(rows: HistoricalRow[], alpha: number, beta: number) {
  const points = rows.flatMap((row) => {
    const x = rawScore({ ...row, alpha, beta })
    return x === null ? [] : [{ x, y: row.actual }]
  })
  return linearFit(points)
}

function scoreHistorical(rows: HistoricalRow[], fit: Fit, alpha: number, beta: number): Scored[] {
  return rows.flatMap((row) => {
    const raw = rawScore({ ...row, alpha, beta })
    return raw === null ? [] : [{ actual: row.actual, predicted: fit.intercept + fit.slope * raw }]
  })
}

function selectHyperparameters(train: HistoricalRow[], validation: HistoricalRow[]) {
  const candidates: Array<{ alpha: number; beta: number; fit: Fit; validation: Metrics }> = []
  for (const alpha of GRID) {
    for (const beta of GRID) {
      const fit = fitHistorical(train, alpha, beta)
      if (!fit) continue
      candidates.push({ alpha, beta, fit, validation: metrics(scoreHistorical(validation, fit, alpha, beta)) })
    }
  }
  candidates.sort((a, b) =>
    (a.validation.rmse ?? Infinity) - (b.validation.rmse ?? Infinity) ||
    (a.validation.mae ?? Infinity) - (b.validation.mae ?? Infinity) ||
    a.alpha - b.alpha || a.beta - b.beta,
  )
  const selected = candidates[0]
  if (!selected) throw new Error('No valid pitcher strikeout hyperparameter candidate')
  return {
    selected,
    top: candidates.slice(0, 10).map((candidate) => ({
      alpha: candidate.alpha,
      beta: candidate.beta,
      validation: candidate.validation,
    })),
  }
}

type RollingInput = CrossSeasonRow & { priorKAll: number | null; priorBfL5: number | null }

function addStrictPriorDateRolling(rows: CrossSeasonRow[]): RollingInput[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.pitcherId - b.pitcherId)
  const history = new Map<number, Array<{ strikeouts: number; bf: number; date: string }>>()
  const output: RollingInput[] = []
  let index = 0
  while (index < sorted.length) {
    const date = sorted[index].date
    let end = index
    while (end < sorted.length && sorted[end].date === date) end += 1
    const dateRows = sorted.slice(index, end)
    for (const row of dateRows) {
      const prior = (history.get(row.pitcherId) ?? []).filter((item) => item.date < date)
      output.push({
        ...row,
        priorKAll: mean(prior.map((item) => item.strikeouts)),
        priorBfL5: mean(prior.slice(-5).map((item) => item.bf)),
      })
    }
    for (const row of dateRows) {
      const prior = history.get(row.pitcherId) ?? []
      prior.push({ strikeouts: row.actual, bf: row.actualBf, date: row.date })
      history.set(row.pitcherId, prior)
    }
    index = end
  }
  return output
}

function scoreCrossSeason(rows: RollingInput[], fit: Fit, alpha: number, beta: number): Scored[] {
  return rows.flatMap((row) => {
    const raw = rawScore({ ...row, alpha, beta })
    return raw === null ? [] : [{ actual: row.actual, predicted: fit.intercept + fit.slope * raw }]
  })
}

function poissonCdf(maxK: number, lambda: number) {
  let probability = Math.exp(-lambda)
  let total = probability
  for (let k = 1; k <= maxK; k += 1) {
    probability *= lambda / k
    total += probability
  }
  return Math.min(1, Math.max(0, total))
}

function probabilityMetrics(rows: Scored[]) {
  return PROP_LINES.map((line) => {
    const observations = rows.map((row) => {
      const lambda = Math.min(15, Math.max(0.25, row.predicted))
      const probabilityOver = 1 - poissonCdf(Math.floor(line), lambda)
      const actualOver = row.actual > line ? 1 : 0
      return { probabilityOver, actualOver }
    })
    const actualRate = mean(observations.map((row) => row.actualOver)) ?? 0
    const brier = mean(observations.map((row) => (row.probabilityOver - row.actualOver) ** 2)) ?? 0
    const logLoss = -(mean(observations.map((row) =>
      row.actualOver * Math.log(Math.max(1e-9, row.probabilityOver)) +
      (1 - row.actualOver) * Math.log(Math.max(1e-9, 1 - row.probabilityOver)),
    )) ?? 0)
    const climatologyBrier = actualRate * (1 - actualRate)
    return {
      line,
      n: observations.length,
      actualOverRate: actualRate,
      meanPredictedOver: mean(observations.map((row) => row.probabilityOver)),
      brier,
      logLoss,
      climatologyBrier,
      brierSkill: climatologyBrier > 0 ? 1 - brier / climatologyBrier : null,
    }
  })
}

function baselineCrossSeason(rows: RollingInput[], kind: 'prior_all' | 'workload', alpha: number) {
  return rows.flatMap((row) => {
    let predicted: number | null = null
    if (kind === 'prior_all') predicted = row.priorKAll
    else {
      predicted = rawScore({ ...row, priorKAll: null, priorBfL5: null, alpha, beta: 1 })
    }
    return predicted === null ? [] : [{ actual: row.actual, predicted }]
  })
}

function monthlyMetrics(rows: Array<RollingInput & { prediction?: number }>, fit: Fit, alpha: number, beta: number) {
  const byMonth = new Map<string, Scored[]>()
  for (const row of rows) {
    const raw = rawScore({ ...row, alpha, beta })
    if (raw === null) continue
    const key = row.date.slice(0, 7)
    const bucket = byMonth.get(key) ?? []
    bucket.push({ actual: row.actual, predicted: fit.intercept + fit.slope * raw })
    byMonth.set(key, bucket)
  }
  return [...byMonth.entries()].map(([month, bucket]) => ({ month, ...metrics(bucket) }))
}

export async function runMlbPitcherStrikeoutBacktest() {
  const [historical, crossSeason] = await Promise.all([loadHistorical2025(), loadCrossSeasonRows()])
  const train = historical.filter((row) => row.split === 'TRAIN')
  const validation = historical.filter((row) => row.split === 'VALIDATION')
  const test = historical.filter((row) => row.split === 'TEST')
  const search = selectHyperparameters(train, validation)
  const alpha = search.selected.alpha
  const beta = search.selected.beta

  const trainValidationFit = fitHistorical([...train, ...validation], alpha, beta)
  if (!trainValidationFit) throw new Error('Unable to fit 2025 train+validation strikeout model')
  const testMetrics = metrics(scoreHistorical(test, trainValidationFit, alpha, beta))

  const all2025Fit = fitHistorical(historical, alpha, beta)
  if (!all2025Fit) throw new Error('Unable to fit full 2025 strikeout model')
  const rolling = addStrictPriorDateRolling(crossSeason)
  const holdout2026 = rolling.filter((row) => row.season === 2026)
  const holdoutScores = scoreCrossSeason(holdout2026, all2025Fit, alpha, beta)
  const holdoutMetrics = metrics(holdoutScores)
  const priorAllBaseline = metrics(baselineCrossSeason(holdout2026, 'prior_all', alpha))
  const workloadBaseline = metrics(baselineCrossSeason(holdout2026, 'workload', alpha))
  const probabilities = probabilityMetrics(holdoutScores)

  const temporal2025Safe = historical.length === 4473
  const temporalCrossSafe = crossSeason.every((row) => row.sourceRule === SOURCE_RULE && row.sourceAsOfDate !== null && row.sourceAsOfDate < row.date)
  const probabilitySkillPositive = probabilities.every((row) => (row.brierSkill ?? -1) > 0)
  const beatsBaselines =
    holdoutMetrics.rmse !== null &&
    priorAllBaseline.rmse !== null &&
    workloadBaseline.rmse !== null &&
    holdoutMetrics.rmse < priorAllBaseline.rmse &&
    holdoutMetrics.rmse < workloadBaseline.rmse

  return {
    mode: 'mlb_pitcher_strikeout_backtest_v1',
    status: beatsBaselines && probabilitySkillPositive && temporal2025Safe && temporalCrossSafe
      ? 'SHADOW_CANDIDATE_ONLY'
      : 'RESEARCH_ONLY',
    modelVersion: MODEL_VERSION,
    activation: {
      sportsbookOddsUsed: false,
      providerCallsMade: 0,
      writesMade: 0,
      officialPickEligible: false,
      productionBettingActivationEnabled: false,
    },
    source: {
      featureVersion: SOURCE_FEATURE_VERSION,
      temporalRule: SOURCE_RULE,
      historical2025Rows: historical.length,
      crossSeasonRows: crossSeason.length,
      holdout2026Rows: holdout2026.length,
      temporal2025Safe,
      temporalCrossSafe,
    },
    selection: {
      train: { rows: train.length, dateRange: ['2025-04-01', '2025-07-31'] },
      validation: { rows: validation.length, dateRange: ['2025-08-01', '2025-08-31'] },
      untouchedTest: { rows: test.length, dateRange: ['2025-09-01', '2025-09-28'] },
      selectedAlphaPitcherRateWeight: alpha,
      selectedBetaMatchupExpectedWeight: beta,
      validationMetrics: search.selected.validation,
      topGridCandidates: search.top,
    },
    fixed2025Test: {
      fit: trainValidationFit,
      metrics: testMetrics,
    },
    external2026Holdout: {
      fitFromAll2025: all2025Fit,
      metrics: holdoutMetrics,
      baselines: {
        priorStarterAverage: priorAllBaseline,
        workloadMatchup: workloadBaseline,
      },
      probabilityCalibration: probabilities,
      monthly: monthlyMetrics(holdout2026, all2025Fit, alpha, beta),
    },
    interpretation: {
      formula: 'Expected Ks blend pitcher/opponent pregame K rates with prior starter workload, then apply a 2025-only affine calibration.',
      selectedWeightsAreResearchOnly: true,
      poissonProbabilitiesAreResearchOnly: true,
      nextGate: 'Forward shadow evaluation against real pregame prop lines; no activation from historical backtest alone.',
    },
  }
}
