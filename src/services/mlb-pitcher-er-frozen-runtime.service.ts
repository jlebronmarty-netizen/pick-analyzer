import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const PAGE_SIZE = 1000
const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const MIN_PRIOR_STARTS = 3

export const FROZEN_PITCHER_ER_MODEL = Object.freeze({
  candidateId: 'pitcher_er_over_1p5_p70_v1',
  modelVersion: 'MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2',
  line: 1.5,
  minimumOverProbability: 0.7,
  baseIntercept: 1.90273530551357,
  baseSlope: 0.227085168912444,
  kResidualIntercept: 0.653408289475203,
  kResidualSlope: -3.0156054216154,
})

const EXPECTED = Object.freeze({
  testMae: 1.53264877098586,
  testRmse: 1.89392266393888,
  validationSelected: 59,
  validationCorrect: 47,
  testSelected: 32,
  testCorrect: 26,
  combinedSelected: 91,
  combinedCorrect: 73,
})

type Split = 'TRAIN' | 'VALIDATION' | 'TEST'
type RawRow = Record<string, unknown>
type BaseRow = {
  canonicalGameId: string
  date: string
  split: Split
  pitcherSourceId: string
  actual: number
  pitcherKRate: number
}
type HistoricalRow = BaseRow & {
  priorErAll: number
  priorStartCount: number
}
type Fit = { intercept: number; slope: number }

export type PitcherErRuntimeParity = {
  certified: boolean
  contract: 'MLB_PITCHER_ER_FROZEN_RUNTIME_PARITY/1.0.0'
  modelVersion: string
  strictPriorDate: true
  sameDateHistoryAllowed: false
  minimumPriorStarts: number
  sourceFeatureVersion: string
  officialOutcomeSource: 'retrosheet_data_er'
  frozenModel: typeof FROZEN_PITCHER_ER_MODEL
  observed: {
    officialErLabels: number
    strictPregameBaseRows: number
    modeledRows: number
    splitRows: Record<Lowercase<Split>, number>
    baseFit: Fit | null
    kResidualFit: Fit | null
    testMae: number | null
    testRmse: number | null
    validationSelected: number
    validationCorrect: number
    testSelected: number
    testCorrect: number
    combinedSelected: number
    combinedCorrect: number
  }
  expected: typeof EXPECTED
  failures: string[]
}

export type PitcherErFrozenRuntime = {
  parity: PitcherErRuntimeParity
  trainResiduals: number[]
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textOrNull(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
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
    const result = await supabaseAdmin
      .from('historical_raw_records')
      .select('game_reference,parsed_fields')
      .eq('source', 'retrosheet')
      .eq('season', '2025')
      .eq('record_type', 'data')
      .eq('parsed_fields->>0', 'data')
      .eq('parsed_fields->>1', 'er')
      .order('source_line', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_ER_PARITY_LABEL_READ_FAILED:' + result.error.message)

    const page = (result.data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const fields = Array.isArray(row.parsed_fields) ? row.parsed_fields : []
      const pitcherSourceId = String(fields[2] ?? '')
      const earnedRuns = numberOrNull(fields[3])
      const gameReference = String(row.game_reference ?? '')
      if (!pitcherSourceId || !gameReference || earnedRuns === null || earnedRuns < 0) continue
      const key = 'retrosheet:mlb:game:' + gameReference + '|' + pitcherSourceId
      if (labels.has(key)) duplicateKeys += 1
      labels.set(key, earnedRuns)
    }
    if (page.length < PAGE_SIZE) break
  }

  if (duplicateKeys > 0) throw new Error('MLB_ER_PARITY_DUPLICATE_OFFICIAL_LABELS:' + duplicateKeys)
  return labels
}

async function fetchPregameBase2025(labels: Map<string, number>) {
  const rows: BaseRow[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('mlb_pitcher_prop_backtest_2025_v1_enriched')
      .select('canonical_game_id,game_date,fixed_split,pitcher_source_id,target_outs,pitcher_k_rate,pitcher_as_of_date,opponent_as_of_date,matchup_as_of_date,feature_version')
      .order('game_date', { ascending: true })
      .order('canonical_game_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_ER_PARITY_BASE_READ_FAILED:' + result.error.message)

    const page = (result.data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const canonicalGameId = String(row.canonical_game_id ?? '')
      const pitcherSourceId = String(row.pitcher_source_id ?? '')
      const date = String(row.game_date ?? '')
      const split = String(row.fixed_split ?? '') as Split
      const outs = numberOrNull(row.target_outs)
      const pitcherKRate = numberOrNull(row.pitcher_k_rate)
      const officialEr = labels.get(canonicalGameId + '|' + pitcherSourceId)

      if (officialEr === undefined || outs === null || outs <= 0 || pitcherKRate === null) continue
      if (!['TRAIN', 'VALIDATION', 'TEST'].includes(split)) continue
      if (
        !validStrictAsOf(row.pitcher_as_of_date, date) ||
        !validStrictAsOf(row.opponent_as_of_date, date) ||
        !validStrictAsOf(row.matchup_as_of_date, date) ||
        String(row.feature_version ?? '') !== SOURCE_FEATURE_VERSION
      ) continue

      rows.push({ canonicalGameId, date, split, pitcherSourceId, actual: officialEr, pitcherKRate })
    }

    if (page.length < PAGE_SIZE) break
  }

  return rows
}

function addStrictPriorEr(rows: BaseRow[]) {
  const sorted = [...rows].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.canonicalGameId.localeCompare(b.canonicalGameId) ||
    a.pitcherSourceId.localeCompare(b.pitcherSourceId),
  )
  const history = new Map<string, Array<{ date: string; er: number }>>()
  const output: HistoricalRow[] = []
  let index = 0

  while (index < sorted.length) {
    const date = sorted[index].date
    let end = index
    while (end < sorted.length && sorted[end].date === date) end += 1
    const dayRows = sorted.slice(index, end)

    for (const row of dayRows) {
      const prior = history.get(row.pitcherSourceId) ?? []
      if (prior.length < MIN_PRIOR_STARTS) continue
      const priorErAll = mean(prior.map((item) => item.er))
      if (priorErAll === null) continue
      output.push({ ...row, priorErAll, priorStartCount: prior.length })
    }

    for (const row of dayRows) {
      const prior = history.get(row.pitcherSourceId) ?? []
      prior.push({ date: row.date, er: row.actual })
      history.set(row.pitcherSourceId, prior)
    }
    index = end
  }

  return output
}

function basePrediction(row: HistoricalRow, fit: Fit) {
  return fit.intercept + fit.slope * row.priorErAll
}

function finalPrediction(row: HistoricalRow, model: { baseFit: Fit; kResidualFit: Fit }) {
  return basePrediction(row, model.baseFit) + model.kResidualFit.intercept + model.kResidualFit.slope * row.pitcherKRate
}

function frozenPrediction(row: HistoricalRow) {
  return FROZEN_PITCHER_ER_MODEL.baseIntercept +
    FROZEN_PITCHER_ER_MODEL.baseSlope * row.priorErAll +
    FROZEN_PITCHER_ER_MODEL.kResidualIntercept +
    FROZEN_PITCHER_ER_MODEL.kResidualSlope * row.pitcherKRate
}

function residualAboveProbability(sorted: number[], threshold: number) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (sorted[mid] <= threshold) low = mid + 1
    else high = mid
  }
  return sorted.length ? (sorted.length - low) / sorted.length : 0
}

export function pitcherErOverProbability(sortedTrainResiduals: number[], predictedEr: number, line = 1.5) {
  return residualAboveProbability(sortedTrainResiduals, line - predictedEr)
}

function closeEnough(actual: number | null, expected: number, tolerance = 1e-12) {
  return actual !== null && Math.abs(actual - expected) <= tolerance
}

let runtimePromise: Promise<PitcherErFrozenRuntime> | null = null

async function buildRuntime(): Promise<PitcherErFrozenRuntime> {
  const labels = await fetchOfficialEarnedRuns2025()
  const base = await fetchPregameBase2025(labels)
  const historical = addStrictPriorEr(base)
  const train = historical.filter((row) => row.split === 'TRAIN')
  const validation = historical.filter((row) => row.split === 'VALIDATION')
  const test = historical.filter((row) => row.split === 'TEST')

  const baseFit = linearFit(train.map((row) => ({ x: row.priorErAll, y: row.actual })))
  const kResidualFit = baseFit
    ? linearFit(train.map((row) => ({
        x: row.pitcherKRate,
        y: row.actual - basePrediction(row, baseFit),
      })))
    : null

  const frozenTrainResiduals = train
    .map((row) => row.actual - frozenPrediction(row))
    .sort((a, b) => a - b)

  const testErrors = test.map((row) => frozenPrediction(row) - row.actual)
  const testMae = mean(testErrors.map((error) => Math.abs(error)))
  const testRmse = testErrors.length
    ? Math.sqrt(testErrors.reduce((sum, error) => sum + error * error, 0) / testErrors.length)
    : null

  function selected(rows: HistoricalRow[]) {
    let n = 0
    let correct = 0
    for (const row of rows) {
      const predicted = frozenPrediction(row)
      const probabilityOver = pitcherErOverProbability(frozenTrainResiduals, predicted, FROZEN_PITCHER_ER_MODEL.line)
      if (probabilityOver < FROZEN_PITCHER_ER_MODEL.minimumOverProbability) continue
      n += 1
      if (row.actual > FROZEN_PITCHER_ER_MODEL.line) correct += 1
    }
    return { n, correct }
  }

  const validationSelected = selected(validation)
  const testSelected = selected(test)
  const failures: string[] = []

  if (!baseFit || !closeEnough(baseFit.intercept, FROZEN_PITCHER_ER_MODEL.baseIntercept) || !closeEnough(baseFit.slope, FROZEN_PITCHER_ER_MODEL.baseSlope)) {
    failures.push('BASE_FIT_CHECKSUM_MISMATCH')
  }
  if (!kResidualFit || !closeEnough(kResidualFit.intercept, FROZEN_PITCHER_ER_MODEL.kResidualIntercept) || !closeEnough(kResidualFit.slope, FROZEN_PITCHER_ER_MODEL.kResidualSlope)) {
    failures.push('K_RESIDUAL_FIT_CHECKSUM_MISMATCH')
  }
  if (!closeEnough(testMae, EXPECTED.testMae) || !closeEnough(testRmse, EXPECTED.testRmse)) {
    failures.push('TEST_ERROR_CHECKSUM_MISMATCH')
  }
  if (validationSelected.n !== EXPECTED.validationSelected || validationSelected.correct !== EXPECTED.validationCorrect) {
    failures.push('VALIDATION_SELECTION_CHECKSUM_MISMATCH')
  }
  if (testSelected.n !== EXPECTED.testSelected || testSelected.correct !== EXPECTED.testCorrect) {
    failures.push('TEST_SELECTION_CHECKSUM_MISMATCH')
  }
  if (
    validationSelected.n + testSelected.n !== EXPECTED.combinedSelected ||
    validationSelected.correct + testSelected.correct !== EXPECTED.combinedCorrect
  ) {
    failures.push('COMBINED_SELECTION_CHECKSUM_MISMATCH')
  }
  if (!train.length || !frozenTrainResiduals.length) failures.push('TRAIN_RESIDUAL_DISTRIBUTION_EMPTY')

  return {
    trainResiduals: frozenTrainResiduals,
    parity: {
      certified: failures.length === 0,
      contract: 'MLB_PITCHER_ER_FROZEN_RUNTIME_PARITY/1.0.0',
      modelVersion: FROZEN_PITCHER_ER_MODEL.modelVersion,
      strictPriorDate: true,
      sameDateHistoryAllowed: false,
      minimumPriorStarts: MIN_PRIOR_STARTS,
      sourceFeatureVersion: SOURCE_FEATURE_VERSION,
      officialOutcomeSource: 'retrosheet_data_er',
      frozenModel: FROZEN_PITCHER_ER_MODEL,
      observed: {
        officialErLabels: labels.size,
        strictPregameBaseRows: base.length,
        modeledRows: historical.length,
        splitRows: {
          train: train.length,
          validation: validation.length,
          test: test.length,
        },
        baseFit,
        kResidualFit,
        testMae,
        testRmse,
        validationSelected: validationSelected.n,
        validationCorrect: validationSelected.correct,
        testSelected: testSelected.n,
        testCorrect: testSelected.correct,
        combinedSelected: validationSelected.n + testSelected.n,
        combinedCorrect: validationSelected.correct + testSelected.correct,
      },
      expected: EXPECTED,
      failures,
    },
  }
}

export async function getFrozenPitcherErRuntime() {
  runtimePromise ??= buildRuntime().catch((error) => {
    runtimePromise = null
    throw error
  })
  return runtimePromise
}

export async function getFrozenPitcherErRuntimeParity() {
  const runtime = await getFrozenPitcherErRuntime()
  return runtime.parity
}
