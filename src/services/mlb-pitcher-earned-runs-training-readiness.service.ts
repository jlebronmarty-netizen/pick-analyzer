import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { SHARED_MLB_PITCHER_ER_OUTCOME_VERSION } from '@/lib/shared-mlb-pitcher-er-outcome-contract'
import { readSharedPitcherErOutcomePage } from '@/services/shared-mlb-pitcher-er-outcomes.service'

type RawRow = Record<string, unknown>
type Split = 'TRAIN' | 'VALIDATION' | 'TEST'
type Fit = Readonly<{ intercept: number; slope: number }>
type Scored = Readonly<{ actual: number; predicted: number }>
type Metrics = Readonly<{
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  correlation: number | null
  averagePrediction: number | null
  averageActual: number | null
}>

type OutcomeRow = Awaited<ReturnType<typeof readSharedPitcherErOutcomePage>>['data'][number]

type BaseRow = Readonly<{
  canonicalGamePk: number
  canonicalGameId: string
  date: string
  split: Split
  pitcherMlbamId: number
  pitcherSourceId: string
  actual: number
  pitcherKRate: number
}>

type HistoricalRow = BaseRow & Readonly<{
  priorErL5: number
  priorErAll: number
  priorStartCount: number
}>

type CandidateName = 'CALIBRATED_ER_ALL' | 'CALIBRATED_ER_ALL_PLUS_K_RATE'
type CandidateModel = Readonly<{
  name: CandidateName
  baseFit: Fit
  kRateResidualFit: Fit | null
}>

const MODEL_VERSION = 'MLB_PITCHER_ER_PA12_RESEARCH_V1'
const FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const OUTCOME_PAGE_SIZE = 250
const FEATURE_PAGE_SIZE = 1000
const EXPECTED_OUTCOMES = 4473
const EXPECTED_ELIGIBLE_OUTCOMES = 4470
const EXPECTED_ZERO_OUT_EXCLUSIONS = 3
const MIN_PRIOR_STARTS = 3
const FIXED_PROP_LINES = [1.5, 2.5, 3.5, 4.5] as const

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function correlation(rows: Scored[]) {
  if (rows.length < 2) return null
  const meanX = mean(rows.map((row) => row.predicted))
  const meanY = mean(rows.map((row) => row.actual))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let x2 = 0
  let y2 = 0
  for (const row of rows) {
    const x = row.predicted - meanX
    const y = row.actual - meanY
    numerator += x * y
    x2 += x * x
    y2 += y * y
  }
  return x2 > 0 && y2 > 0 ? numerator / Math.sqrt(x2 * y2) : null
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
  return Object.freeze({ intercept: meanY - slope * meanX, slope })
}

function validStrictAsOf(value: unknown, targetDate: string) {
  const asOf = textOrNull(value)
  return asOf !== null && /^\d{4}-\d{2}-\d{2}$/.test(asOf) && asOf < targetDate
}

function outcomeIdentity(row: Pick<OutcomeRow, 'canonicalGamePk' | 'pitcherMlbamId'>) {
  return `${row.canonicalGamePk}|${row.pitcherMlbamId}`
}

async function readCertifiedOutcomes() {
  const rows: OutcomeRow[] = []
  const seen = new Set<string>()
  let cursor = 0

  for (;;) {
    const page = await readSharedPitcherErOutcomePage(cursor, OUTCOME_PAGE_SIZE)
    for (const row of page.data) {
      const key = outcomeIdentity(row)
      if (seen.has(key)) throw new Error(`PA12_ER_TRAINING_OUTCOME_DUPLICATE:${key}`)
      seen.add(key)
      rows.push(row)
    }
    if (page.nextCursor === null) break
    if (page.nextCursor <= cursor) throw new Error('PA12_ER_TRAINING_OUTCOME_CURSOR_STALLED')
    cursor = page.nextCursor
  }

  const eligible = rows.filter((row) => row.researchOutcomeEligible)
  const zeroOut = rows.filter((row) => !row.researchOutcomeEligible && row.starterOuts === 0)
  if (rows.length !== EXPECTED_OUTCOMES) throw new Error(`PA12_ER_TRAINING_OUTCOME_COUNT_DRIFT:${rows.length}`)
  if (eligible.length !== EXPECTED_ELIGIBLE_OUTCOMES) throw new Error(`PA12_ER_TRAINING_ELIGIBLE_COUNT_DRIFT:${eligible.length}`)
  if (zeroOut.length !== EXPECTED_ZERO_OUT_EXCLUSIONS) throw new Error(`PA12_ER_TRAINING_ZERO_OUT_DRIFT:${zeroOut.length}`)

  return { rows, eligible, zeroOut }
}

async function readPregameFeatureRows(outcomes: OutcomeRow[]) {
  const outcomeByIdentity = new Map(outcomes.map((row) => [outcomeIdentity(row), row]))
  const rows: BaseRow[] = []
  const seen = new Set<string>()
  const audit = {
    featureRowsRead: 0,
    outcomeMatched: 0,
    excludedOutcomeIneligible: 0,
    invalidSplit: 0,
    strictAsOfRejected: 0,
    featureVersionRejected: 0,
    missingPitcherKRate: 0,
  }

  for (let offset = 0; ; offset += FEATURE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_pitcher_prop_backtest_2025_v1_enriched')
      .select('canonical_game_id,target_game_pk,game_date,fixed_split,pitcher_source_id,mlbam_pitcher_id,target_outs,pitcher_k_rate,pitcher_as_of_date,opponent_as_of_date,matchup_as_of_date,feature_version')
      .order('target_game_pk', { ascending: true })
      .order('mlbam_pitcher_id', { ascending: true })
      .range(offset, offset + FEATURE_PAGE_SIZE - 1)
    if (error) throw new Error(`PA12_ER_TRAINING_FEATURE_READ_FAILED:${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]

    for (const row of page) {
      audit.featureRowsRead += 1
      const canonicalGamePk = numberOrNull(row.target_game_pk)
      const pitcherMlbamId = numberOrNull(row.mlbam_pitcher_id)
      if (canonicalGamePk === null || pitcherMlbamId === null) continue
      const key = `${canonicalGamePk}|${pitcherMlbamId}`
      const outcome = outcomeByIdentity.get(key)
      if (!outcome) continue
      audit.outcomeMatched += 1
      if (!outcome.researchOutcomeEligible) {
        audit.excludedOutcomeIneligible += 1
        continue
      }
      if (seen.has(key)) throw new Error(`PA12_ER_TRAINING_FEATURE_DUPLICATE:${key}`)
      seen.add(key)

      const canonicalGameId = textOrNull(row.canonical_game_id)
      const date = textOrNull(row.game_date)
      const pitcherSourceId = textOrNull(row.pitcher_source_id)
      const split = textOrNull(row.fixed_split)
      const pitcherKRate = numberOrNull(row.pitcher_k_rate)
      if (!canonicalGameId || !date || !pitcherSourceId || !split || !['TRAIN', 'VALIDATION', 'TEST'].includes(split)) {
        audit.invalidSplit += 1
        continue
      }
      if (outcome.gameDate !== date || outcome.fixedSplit !== split || outcome.sourceLineage.canonicalGameId !== canonicalGameId || outcome.sourceLineage.retrosheetPitcherSourceId !== pitcherSourceId) {
        throw new Error(`PA12_ER_TRAINING_LINEAGE_DRIFT:${key}`)
      }
      if (String(row.feature_version ?? '') !== FEATURE_VERSION) {
        audit.featureVersionRejected += 1
        continue
      }
      if (!validStrictAsOf(row.pitcher_as_of_date, date) || !validStrictAsOf(row.opponent_as_of_date, date) || !validStrictAsOf(row.matchup_as_of_date, date)) {
        audit.strictAsOfRejected += 1
        continue
      }
      if (pitcherKRate === null) {
        audit.missingPitcherKRate += 1
        continue
      }

      rows.push(Object.freeze({
        canonicalGamePk,
        canonicalGameId,
        date,
        split: split as Split,
        pitcherMlbamId,
        pitcherSourceId,
        actual: outcome.observedEarnedRuns,
        pitcherKRate,
      }))
    }

    if (page.length < FEATURE_PAGE_SIZE) break
  }

  return { rows, audit }
}

function addStrictPriorEr(rows: BaseRow[]) {
  const sorted = [...rows].sort((a, b) =>
    a.date.localeCompare(b.date) || a.canonicalGamePk - b.canonicalGamePk || a.pitcherMlbamId - b.pitcherMlbamId,
  )
  const history = new Map<number, Array<{ date: string; er: number }>>()
  const output: HistoricalRow[] = []
  let excludedInsufficientHistory = 0
  let index = 0

  while (index < sorted.length) {
    const date = sorted[index].date
    let end = index
    while (end < sorted.length && sorted[end].date === date) end += 1
    const dayRows = sorted.slice(index, end)

    for (const row of dayRows) {
      const prior = history.get(row.pitcherMlbamId) ?? []
      if (prior.length < MIN_PRIOR_STARTS) {
        excludedInsufficientHistory += 1
        continue
      }
      const priorErAll = mean(prior.map((item) => item.er))
      const priorErL5 = mean(prior.slice(-5).map((item) => item.er))
      if (priorErAll === null || priorErL5 === null) continue
      output.push(Object.freeze({ ...row, priorErAll, priorErL5, priorStartCount: prior.length }))
    }

    for (const row of dayRows) {
      const prior = history.get(row.pitcherMlbamId) ?? []
      prior.push({ date: row.date, er: row.actual })
      history.set(row.pitcherMlbamId, prior)
    }
    index = end
  }

  return { rows: output, excludedInsufficientHistory }
}

function basePrediction(row: HistoricalRow, fit: Fit) {
  return fit.intercept + fit.slope * row.priorErAll
}

function fitCandidate(train: HistoricalRow[], name: CandidateName): CandidateModel {
  const baseFit = linearFit(train.map((row) => ({ x: row.priorErAll, y: row.actual })))
  if (!baseFit) throw new Error('PA12_ER_TRAINING_BASE_FIT_FAILED')
  if (name === 'CALIBRATED_ER_ALL') return Object.freeze({ name, baseFit, kRateResidualFit: null })
  const kRateResidualFit = linearFit(train.map((row) => ({ x: row.pitcherKRate, y: row.actual - basePrediction(row, baseFit) })))
  if (!kRateResidualFit) throw new Error('PA12_ER_TRAINING_K_RATE_RESIDUAL_FIT_FAILED')
  return Object.freeze({ name, baseFit, kRateResidualFit })
}

function predict(row: HistoricalRow, model: CandidateModel) {
  const base = basePrediction(row, model.baseFit)
  if (!model.kRateResidualFit) return base
  return base + model.kRateResidualFit.intercept + model.kRateResidualFit.slope * row.pitcherKRate
}

function score(rows: HistoricalRow[], model: CandidateModel): Scored[] {
  return rows.map((row) => ({ actual: row.actual, predicted: predict(row, model) }))
}

function baselineScore(rows: HistoricalRow[], kind: 'TRAIN_MEAN' | 'PRIOR_ER_ALL' | 'PRIOR_ER_L5', trainMean: number): Scored[] {
  return rows.map((row) => ({
    actual: row.actual,
    predicted: kind === 'TRAIN_MEAN' ? trainMean : kind === 'PRIOR_ER_ALL' ? row.priorErAll : row.priorErL5,
  }))
}

function probabilityDiagnostics(rows: Scored[], trainResiduals: number[]) {
  const sorted = [...trainResiduals].sort((a, b) => a - b)
  function probabilityResidualAbove(threshold: number) {
    let low = 0
    let high = sorted.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (sorted[mid] <= threshold) low = mid + 1
      else high = mid
    }
    return sorted.length ? (sorted.length - low) / sorted.length : 0
  }

  return FIXED_PROP_LINES.map((line) => {
    const observations = rows.map((row) => ({
      probabilityOver: probabilityResidualAbove(line - row.predicted),
      actualOver: row.actual > line ? 1 : 0,
    }))
    const actualRate = mean(observations.map((row) => row.actualOver)) ?? 0
    const brier = mean(observations.map((row) => (row.probabilityOver - row.actualOver) ** 2)) ?? 0
    const climatologyBrier = actualRate * (1 - actualRate)
    return Object.freeze({
      line,
      n: observations.length,
      actualOverRate: actualRate,
      meanPredictedOver: mean(observations.map((row) => row.probabilityOver)),
      brier,
      climatologyBrier,
      brierSkill: climatologyBrier > 0 ? 1 - brier / climatologyBrier : null,
    })
  })
}

function directionalAccuracy(rows: Scored[]) {
  return FIXED_PROP_LINES.map((line) => {
    const correct = rows.filter((row) => (row.predicted > line) === (row.actual > line)).length
    return Object.freeze({ line, n: rows.length, accuracy: rows.length ? correct / rows.length : null })
  })
}

export async function runMlbPitcherErTrainingReadiness() {
  const outcomes = await readCertifiedOutcomes()
  const base = await readPregameFeatureRows(outcomes.rows)
  const historical = addStrictPriorEr(base.rows)
  const train = historical.rows.filter((row) => row.split === 'TRAIN')
  const validation = historical.rows.filter((row) => row.split === 'VALIDATION')
  const test = historical.rows.filter((row) => row.split === 'TEST')

  if (train.length !== 2194 || validation.length !== 729 || test.length !== 645) {
    throw new Error(`PA12_ER_TRAINING_MODELED_SPLIT_DRIFT:${train.length}/${validation.length}/${test.length}`)
  }

  const trainMean = mean(train.map((row) => row.actual))
  if (trainMean === null) throw new Error('PA12_ER_TRAINING_MEAN_UNAVAILABLE')

  const candidateNames: CandidateName[] = ['CALIBRATED_ER_ALL', 'CALIBRATED_ER_ALL_PLUS_K_RATE']
  const candidates = candidateNames.map((name) => {
    const model = fitCandidate(train, name)
    return { model, validation: metrics(score(validation, model)) }
  })
  const ranked = [...candidates].sort((a, b) => (a.validation.rmse ?? Number.POSITIVE_INFINITY) - (b.validation.rmse ?? Number.POSITIVE_INFINITY))
  const selected = ranked[0]
  if (!selected || selected.validation.rmse === null) throw new Error('PA12_ER_TRAINING_VALIDATION_SELECTION_FAILED')

  // TEST is scored only after the candidate has been selected exclusively from TRAIN -> VALIDATION.
  const selectedTrain = score(train, selected.model)
  const selectedValidation = score(validation, selected.model)
  const selectedTest = score(test, selected.model)
  const trainResiduals = selectedTrain.map((row) => row.actual - row.predicted)

  return Object.freeze({
    modelVersion: MODEL_VERSION,
    status: 'RESEARCH_ONLY_NOT_PROMOTED',
    outcomeContractVersion: SHARED_MLB_PITCHER_ER_OUTCOME_VERSION,
    featureVersion: FEATURE_VERSION,
    sourceRule: SOURCE_RULE,
    admission: {
      certifiedOutcomeRows: outcomes.rows.length,
      researchOutcomeEligibleRows: outcomes.eligible.length,
      zeroOutExclusions: outcomes.zeroOut.length,
      featureAudit: base.audit,
      minimumPriorStarts: MIN_PRIOR_STARTS,
      excludedInsufficientHistory: historical.excludedInsufficientHistory,
      modeledSplit: { train: train.length, validation: validation.length, test: test.length },
      frozenTemporalBoundary: {
        train: '2025-04-01..2025-07-31',
        validation: '2025-08-01..2025-08-31',
        test: '2025-09-01..2025-09-28',
      },
    },
    selectionDiscipline: {
      fit: 'TRAIN_ONLY',
      candidateSelection: 'VALIDATION_RMSE_ONLY',
      fixedProbabilityLines: FIXED_PROP_LINES,
      probabilityCalibration: 'EMPIRICAL_TRAIN_RESIDUALS_ONLY',
      testPolicy: 'SCORE_ONLY_AFTER_VALIDATION_SELECTION_NO_TEST_TUNING',
    },
    baselines: {
      trainMean: {
        validation: metrics(baselineScore(validation, 'TRAIN_MEAN', trainMean)),
        test: metrics(baselineScore(test, 'TRAIN_MEAN', trainMean)),
      },
      priorErAll: {
        validation: metrics(baselineScore(validation, 'PRIOR_ER_ALL', trainMean)),
        test: metrics(baselineScore(test, 'PRIOR_ER_ALL', trainMean)),
      },
      priorErL5: {
        validation: metrics(baselineScore(validation, 'PRIOR_ER_L5', trainMean)),
        test: metrics(baselineScore(test, 'PRIOR_ER_L5', trainMean)),
      },
    },
    candidates: candidates.map(({ model, validation: validationMetrics }) => ({
      name: model.name,
      validation: validationMetrics,
      selected: model.name === selected.model.name,
    })),
    selectedCandidate: {
      name: selected.model.name,
      coefficients: selected.model,
      train: metrics(selectedTrain),
      validation: metrics(selectedValidation),
      sealedTest: metrics(selectedTest),
      validationProbabilityDiagnostics: probabilityDiagnostics(selectedValidation, trainResiduals),
      sealedTestProbabilityDiagnostics: probabilityDiagnostics(selectedTest, trainResiduals),
      validationDirectionalAccuracy: directionalAccuracy(selectedValidation),
      sealedTestDirectionalAccuracy: directionalAccuracy(selectedTest),
    },
    activation: {
      sportsbookCalls: 0,
      oddsApiCalls: 0,
      officialPickWrites: 0,
      productionDmlDdl: 0,
      productionBettingActivation: false,
      modelPromotion: false,
    },
  })
}
