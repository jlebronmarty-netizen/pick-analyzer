import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const PAGE_SIZE = 1000

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
  modeledRows: 3568,
  trainRows: 2194,
  validationRows: 729,
  testRows: 645,
  testMae: 1.53264877098586,
  testRmse: 1.89392266393888,
  validationSelected: 59,
  validationCorrect: 47,
  testSelected: 32,
  testCorrect: 26,
  combinedSelected: 91,
  combinedCorrect: 73,
})

type Fit = { intercept: number; slope: number }
type FrozenRow = {
  fixed_split: 'TRAIN' | 'VALIDATION' | 'TEST'
  actual_er: number | string
  prior_er_all: number | string
  pitcher_k_rate: number | string
  frozen_prediction: number | string
  frozen_residual: number | string
}

export type PitcherErRuntimeParity = {
  certified: boolean
  contract: 'MLB_PITCHER_ER_FROZEN_RUNTIME_PARITY/1.0.0'
  modelVersion: string
  strictPriorDate: true
  sameDateHistoryAllowed: false
  minimumPriorStarts: 3
  sourceFeatureVersion: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
  officialOutcomeSource: 'retrosheet_data_er'
  runtimeResidualSource: 'mlb_pitcher_er_frozen_2025_runtime_v1'
  frozenModel: typeof FROZEN_PITCHER_ER_MODEL
  observed: {
    modeledRows: number
    splitRows: { train: number; validation: number; test: number }
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

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

async function loadFrozenRows() {
  const rows: FrozenRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('mlb_pitcher_er_frozen_2025_runtime_v1')
      .select('fixed_split,actual_er,prior_er_all,pitcher_k_rate,frozen_prediction,frozen_residual')
      .order('fixed_split', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_ER_FROZEN_RUNTIME_READ_FAILED:' + result.error.message)
    rows.push(...((result.data ?? []) as FrozenRow[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

let runtimePromise: Promise<PitcherErFrozenRuntime> | null = null

async function buildRuntime(): Promise<PitcherErFrozenRuntime> {
  const rawRows = await loadFrozenRows()
  const rows = rawRows.flatMap((row) => {
    const actual = n(row.actual_er)
    const priorErAll = n(row.prior_er_all)
    const kRate = n(row.pitcher_k_rate)
    const predicted = n(row.frozen_prediction)
    const residual = n(row.frozen_residual)
    if (actual === null || priorErAll === null || kRate === null || predicted === null || residual === null) return []
    return [{
      split: row.fixed_split,
      actual,
      priorErAll,
      kRate,
      predicted,
      residual,
    }]
  })

  const train = rows.filter((row) => row.split === 'TRAIN')
  const validation = rows.filter((row) => row.split === 'VALIDATION')
  const test = rows.filter((row) => row.split === 'TEST')
  const trainResiduals = train.map((row) => row.residual).sort((a, b) => a - b)

  const baseFit = linearFit(train.map((row) => ({ x: row.priorErAll, y: row.actual })))
  const kResidualFit = baseFit
    ? linearFit(train.map((row) => ({
        x: row.kRate,
        y: row.actual - (baseFit.intercept + baseFit.slope * row.priorErAll),
      })))
    : null

  const testErrors = test.map((row) => row.predicted - row.actual)
  const testMae = mean(testErrors.map((error) => Math.abs(error)))
  const testRmse = testErrors.length
    ? Math.sqrt(testErrors.reduce((sum, error) => sum + error * error, 0) / testErrors.length)
    : null

  function selected(input: typeof rows) {
    let count = 0
    let correct = 0
    for (const row of input) {
      const probability = pitcherErOverProbability(trainResiduals, row.predicted, FROZEN_PITCHER_ER_MODEL.line)
      if (probability < FROZEN_PITCHER_ER_MODEL.minimumOverProbability) continue
      count += 1
      if (row.actual > FROZEN_PITCHER_ER_MODEL.line) correct += 1
    }
    return { count, correct }
  }

  const validationSelection = selected(validation)
  const testSelection = selected(test)
  const failures: string[] = []

  if (rows.length !== EXPECTED.modeledRows) failures.push('MODELED_ROW_COUNT_MISMATCH')
  if (train.length !== EXPECTED.trainRows || validation.length !== EXPECTED.validationRows || test.length !== EXPECTED.testRows) {
    failures.push('TEMPORAL_SPLIT_COUNT_MISMATCH')
  }
  if (!baseFit || !closeEnough(baseFit.intercept, FROZEN_PITCHER_ER_MODEL.baseIntercept) || !closeEnough(baseFit.slope, FROZEN_PITCHER_ER_MODEL.baseSlope)) {
    failures.push('BASE_FIT_CHECKSUM_MISMATCH')
  }
  if (!kResidualFit || !closeEnough(kResidualFit.intercept, FROZEN_PITCHER_ER_MODEL.kResidualIntercept) || !closeEnough(kResidualFit.slope, FROZEN_PITCHER_ER_MODEL.kResidualSlope)) {
    failures.push('K_RESIDUAL_FIT_CHECKSUM_MISMATCH')
  }
  if (!closeEnough(testMae, EXPECTED.testMae) || !closeEnough(testRmse, EXPECTED.testRmse)) {
    failures.push('TEST_ERROR_CHECKSUM_MISMATCH')
  }
  if (validationSelection.count !== EXPECTED.validationSelected || validationSelection.correct !== EXPECTED.validationCorrect) {
    failures.push('VALIDATION_SELECTION_CHECKSUM_MISMATCH')
  }
  if (testSelection.count !== EXPECTED.testSelected || testSelection.correct !== EXPECTED.testCorrect) {
    failures.push('TEST_SELECTION_CHECKSUM_MISMATCH')
  }
  if (
    validationSelection.count + testSelection.count !== EXPECTED.combinedSelected ||
    validationSelection.correct + testSelection.correct !== EXPECTED.combinedCorrect
  ) {
    failures.push('COMBINED_SELECTION_CHECKSUM_MISMATCH')
  }
  if (!trainResiduals.length) failures.push('TRAIN_RESIDUAL_DISTRIBUTION_EMPTY')

  return {
    trainResiduals,
    parity: {
      certified: failures.length === 0,
      contract: 'MLB_PITCHER_ER_FROZEN_RUNTIME_PARITY/1.0.0',
      modelVersion: FROZEN_PITCHER_ER_MODEL.modelVersion,
      strictPriorDate: true,
      sameDateHistoryAllowed: false,
      minimumPriorStarts: 3,
      sourceFeatureVersion: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1',
      officialOutcomeSource: 'retrosheet_data_er',
      runtimeResidualSource: 'mlb_pitcher_er_frozen_2025_runtime_v1',
      frozenModel: FROZEN_PITCHER_ER_MODEL,
      observed: {
        modeledRows: rows.length,
        splitRows: { train: train.length, validation: validation.length, test: test.length },
        baseFit,
        kResidualFit,
        testMae,
        testRmse,
        validationSelected: validationSelection.count,
        validationCorrect: validationSelection.correct,
        testSelected: testSelection.count,
        testCorrect: testSelection.correct,
        combinedSelected: validationSelection.count + testSelection.count,
        combinedCorrect: validationSelection.correct + testSelection.correct,
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
  return (await getFrozenPitcherErRuntime()).parity
}
