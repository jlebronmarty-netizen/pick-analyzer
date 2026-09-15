import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Fit = { intercept: number; slope: number }
type Scored = { actual: number; predicted: number }
type Metrics = {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  correlation: number | null
  averagePrediction: number | null
  averageActual: number | null
}

type Split = 'TRAIN' | 'VALIDATION' | 'TEST'

type BaseRow = {
  canonicalGameId: string
  date: string
  split: Split
  pitcherSourceId: string
  actual: number
  pitcherKRate: number
}

type HistoricalRow = BaseRow & {
  priorErL5: number
  priorErAll: number
  priorStartCount: number
}

type Model = {
  baseFit: Fit
  kRateResidualFit: Fit
}

const MODEL_VERSION = 'MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2'
const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const PAGE_SIZE = 1000
const PROP_LINES = [1.5, 2.5, 3.5, 4.5]
const MIN_PRIOR_STARTS = 3
const SELECTED_SECOND_STAGE_FEATURE = 'pitcher_k_rate'

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
  return { intercept: meanY - slope * meanX, slope }
}

function validStrictAsOf(value: unknown, targetDate: string) {
  const asOf = textOrNull(value)
  return asOf !== null && /^\d{4}-\d{2}-\d{2}$/.test(asOf) && asOf < targetDate
}

async function fetchOfficialEarnedRuns2025() {
  const labels = new Map<string, number>()
  let duplicateKeys = 0
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('historical_raw_records')
      .select('game_reference,parsed_fields')
      .eq('source', 'retrosheet')
      .eq('season', '2025')
      .eq('record_type', 'data')
      .eq('parsed_fields->>0', 'data')
      .eq('parsed_fields->>1', 'er')
      .order('source_line', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`Retrosheet ER label read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const fields = Array.isArray(row.parsed_fields) ? row.parsed_fields : []
      const pitcherSourceId = String(fields[2] ?? '')
      const earnedRuns = numberOrNull(fields[3])
      const gameReference = String(row.game_reference ?? '')
      if (!pitcherSourceId || !gameReference || earnedRuns === null || earnedRuns < 0) continue
      const key = `retrosheet:mlb:game:${gameReference}|${pitcherSourceId}`
      if (labels.has(key)) duplicateKeys += 1
      labels.set(key, earnedRuns)
    }
    if (page.length < PAGE_SIZE) break
  }
  if (duplicateKeys > 0) throw new Error(`Retrosheet ER labels are not unique: ${duplicateKeys} duplicate keys`)
  return labels
}

async function fetchPregameBase2025(labels: Map<string, number>) {
  const rows: BaseRow[] = []
  const audit = {
    mappedRows: 0,
    missingOfficialEr: 0,
    excludedZeroOuts: 0,
    nonStrictFeatureRows: 0,
    missingPitcherKRate: 0,
    invalidSplitRows: 0,
  }

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_pitcher_prop_backtest_2025_v1_enriched')
      .select('canonical_game_id,game_date,fixed_split,pitcher_source_id,target_outs,pitcher_k_rate,pitcher_as_of_date,opponent_as_of_date,matchup_as_of_date,feature_version')
      .order('game_date', { ascending: true })
      .order('canonical_game_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`2025 ER pregame base read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]

    for (const row of page) {
      audit.mappedRows += 1
      const canonicalGameId = String(row.canonical_game_id ?? '')
      const pitcherSourceId = String(row.pitcher_source_id ?? '')
      const date = String(row.game_date ?? '')
      const split = String(row.fixed_split ?? '') as Split
      const outs = numberOrNull(row.target_outs)
      const pitcherKRate = numberOrNull(row.pitcher_k_rate)
      const officialEr = labels.get(`${canonicalGameId}|${pitcherSourceId}`)

      if (officialEr === undefined) {
        audit.missingOfficialEr += 1
        continue
      }
      if (outs === null || outs <= 0) {
        audit.excludedZeroOuts += 1
        continue
      }
      if (!['TRAIN', 'VALIDATION', 'TEST'].includes(split)) {
        audit.invalidSplitRows += 1
        continue
      }

      const strictPrior =
        validStrictAsOf(row.pitcher_as_of_date, date) &&
        validStrictAsOf(row.opponent_as_of_date, date) &&
        validStrictAsOf(row.matchup_as_of_date, date) &&
        String(row.feature_version ?? '') === SOURCE_FEATURE_VERSION
      if (!strictPrior) {
        audit.nonStrictFeatureRows += 1
        continue
      }
      if (pitcherKRate === null) {
        audit.missingPitcherKRate += 1
        continue
      }

      rows.push({ canonicalGameId, date, split, pitcherSourceId, actual: officialEr, pitcherKRate })
    }

    if (page.length < PAGE_SIZE) break
  }

  return { rows, audit }
}

function addStrictPriorEr(rows: BaseRow[]) {
  const sorted = [...rows].sort((a, b) =>
    a.date.localeCompare(b.date) || a.canonicalGameId.localeCompare(b.canonicalGameId) || a.pitcherSourceId.localeCompare(b.pitcherSourceId),
  )
  const history = new Map<string, Array<{ date: string; er: number }>>()
  const output: HistoricalRow[] = []
  let excludedInsufficientHistory = 0
  let index = 0

  while (index < sorted.length) {
    const date = sorted[index].date
    let end = index
    while (end < sorted.length && sorted[end].date === date) end += 1
    const dayRows = sorted.slice(index, end)

    for (const row of dayRows) {
      const prior = history.get(row.pitcherSourceId) ?? []
      if (prior.length < MIN_PRIOR_STARTS) {
        excludedInsufficientHistory += 1
        continue
      }
      const priorErAll = mean(prior.map((item) => item.er))
      const priorErL5 = mean(prior.slice(-5).map((item) => item.er))
      if (priorErAll === null || priorErL5 === null) continue
      output.push({ ...row, priorErAll, priorErL5, priorStartCount: prior.length })
    }

    for (const row of dayRows) {
      const prior = history.get(row.pitcherSourceId) ?? []
      prior.push({ date: row.date, er: row.actual })
      history.set(row.pitcherSourceId, prior)
    }
    index = end
  }

  return { rows: output, excludedInsufficientHistory }
}

function basePrediction(row: HistoricalRow, fit: Fit) {
  return fit.intercept + fit.slope * row.priorErAll
}

function finalPrediction(row: HistoricalRow, model: Model) {
  const base = basePrediction(row, model.baseFit)
  return base + model.kRateResidualFit.intercept + model.kRateResidualFit.slope * row.pitcherKRate
}

function fitModel(train: HistoricalRow[]): Model {
  const baseFit = linearFit(train.map((row) => ({ x: row.priorErAll, y: row.actual })))
  if (!baseFit) throw new Error('Earned-runs base fit failed')
  const kRateResidualFit = linearFit(
    train.map((row) => ({ x: row.pitcherKRate, y: row.actual - basePrediction(row, baseFit) })),
  )
  if (!kRateResidualFit) throw new Error('Earned-runs K-rate residual fit failed')
  return { baseFit, kRateResidualFit }
}

function scoreBase(rows: HistoricalRow[], fit: Fit): Scored[] {
  return rows.map((row) => ({ actual: row.actual, predicted: basePrediction(row, fit) }))
}

function scoreModel(rows: HistoricalRow[], model: Model): Scored[] {
  return rows.map((row) => ({ actual: row.actual, predicted: finalPrediction(row, model) }))
}

function baseline(rows: HistoricalRow[], kind: 'prior_all' | 'l5' | 'train_mean', trainMean: number) {
  return rows.map((row) => ({
    actual: row.actual,
    predicted: kind === 'prior_all' ? row.priorErAll : kind === 'l5' ? row.priorErL5 : trainMean,
  }))
}

function empiricalProbabilityMetrics(rows: Scored[], trainResiduals: number[]) {
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

  return PROP_LINES.map((line) => {
    const observations = rows.map((row) => {
      const probabilityOver = probabilityResidualAbove(line - row.predicted)
      return { probabilityOver, actualOver: row.actual > line ? 1 : 0 }
    })
    const actualRate = mean(observations.map((row) => row.actualOver)) ?? 0
    const brier = mean(observations.map((row) => (row.probabilityOver - row.actualOver) ** 2)) ?? 0
    const climatologyBrier = actualRate * (1 - actualRate)
    return {
      line,
      n: observations.length,
      actualOverRate: actualRate,
      meanPredictedOver: mean(observations.map((row) => row.probabilityOver)),
      brier,
      climatologyBrier,
      brierSkill: climatologyBrier > 0 ? 1 - brier / climatologyBrier : null,
    }
  })
}

function directionalAccuracy(rows: Scored[]) {
  return PROP_LINES.map((line) => {
    const correct = rows.filter((row) => (row.predicted > line) === (row.actual > line)).length
    const predictedOver = rows.filter((row) => row.predicted > line).length
    const actualOver = rows.filter((row) => row.actual > line).length
    return {
      line,
      n: rows.length,
      accuracy: rows.length ? correct / rows.length : null,
      predictedOverRate: rows.length ? predictedOver / rows.length : null,
      actualOverRate: rows.length ? actualOver / rows.length : null,
    }
  })
}

export async function runMlbPitcherEarnedRunsBacktest() {
  const labels = await fetchOfficialEarnedRuns2025()
  const base = await fetchPregameBase2025(labels)
  const historical = addStrictPriorEr(base.rows)
  const train = historical.rows.filter((row) => row.split === 'TRAIN')
  const validation = historical.rows.filter((row) => row.split === 'VALIDATION')
  const test = historical.rows.filter((row) => row.split === 'TEST')
  if (!train.length || !validation.length || !test.length) throw new Error('Earned-runs temporal split is incomplete')

  const model = fitModel(train)
  const trainMean = mean(train.map((row) => row.actual))
  if (trainMean === null) throw new Error('Earned-runs training mean is unavailable')

  const trainBase = scoreBase(train, model.baseFit)
  const validationBase = scoreBase(validation, model.baseFit)
  const testBase = scoreBase(test, model.baseFit)
  const trainScored = scoreModel(train, model)
  const validationScored = scoreModel(validation, model)
  const testScored = scoreModel(test, model)
  const trainResiduals = trainScored.map((row) => row.actual - row.predicted)

  return {
    modelVersion: MODEL_VERSION,
    status: 'RESEARCH_ONLY',
    activation: {
      sportsbookCalls: 0,
      oddsApiCalls: 0,
      officialPickWrites: 0,
      productionDmlDdl: 0,
      productionBettingActivation: false,
    },
    researchBoundary: {
      target: 'official Retrosheet data,er only',
      targetRunsAllowedUsedAsEarnedRuns: false,
      excludedZeroOutStarters: true,
      minimumPriorStarts: MIN_PRIOR_STARTS,
      sourceFeatureVersion: SOURCE_FEATURE_VERSION,
      strictSourceRule: SOURCE_RULE,
      sameDateHistoryAllowed: false,
      selectedSecondStageFeature: SELECTED_SECOND_STAGE_FEATURE,
      secondStageSelectedOnValidationOnly: true,
      testUsedForSelection: false,
      roiClaimedWithoutHistoricalPrices: false,
    },
    dataAudit: {
      officialErLabels: labels.size,
      ...base.audit,
      strictPregameBaseRows: base.rows.length,
      excludedInsufficientHistory: historical.excludedInsufficientHistory,
      modeledRows: historical.rows.length,
      splitRows: { train: train.length, validation: validation.length, test: test.length },
    },
    model: {
      baseFeature: 'prior_er_all',
      baseFit: model.baseFit,
      secondStageFeature: SELECTED_SECOND_STAGE_FEATURE,
      kRateResidualFit: model.kRateResidualFit,
    },
    selectionEvidence: {
      train: { base: metrics(trainBase), selectedModel: metrics(trainScored) },
      validation: { base: metrics(validationBase), selectedModel: metrics(validationScored) },
    },
    fixed2025Test: {
      base: metrics(testBase),
      selectedModel: metrics(testScored),
      baselines: {
        trainMean: metrics(baseline(test, 'train_mean', trainMean)),
        priorAll: metrics(baseline(test, 'prior_all', trainMean)),
        priorL5: metrics(baseline(test, 'l5', trainMean)),
      },
      directionalAccuracy: directionalAccuracy(testScored),
      probability: empiricalProbabilityMetrics(testScored, trainResiduals),
    },
    nextGate: 'IMPROVE_AND_CONFIRM_OUT_OF_SAMPLE_SKILL_BEFORE_ANY_SHADOW_PROMOTION',
    note: 'Research-only earned-runs model. It cannot create Official Picks or activate betting without a separate authorized gate.',
  }
}
