import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Fit = { intercept: number; slope: number }
type Scored = { actual: number; predicted: number; date?: string }
type Metrics = {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  correlation: number | null
  averagePrediction: number | null
  averageActual: number | null
}

type BatterLog = {
  season: number
  gamePk: number
  date: string
  batterId: number
  hits: number
  plateAppearances: number
}

type FeatureRow = {
  gamePk: number
  batterId: number
  featureDate: string
  asOfDate: string
  sourceRule: string | null
}

type ModelRow = {
  season: number
  gamePk: number
  date: string
  batterId: number
  split: 'TRAIN' | 'VALIDATION' | 'TEST' | 'HOLDOUT'
  actual: number
  priorHitsAllPerGame: number
  priorHitsL10PerGame: number
  priorHitRateAll: number
  priorHitRateL10: number
  priorPaL10: number
  priorGames: number
  strictPriorFeature: boolean
}

const MODEL_VERSION = 'MLB_BATTER_HITS_RESEARCH_V1'
const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const PAGE_SIZE = 1000
const GRID = Array.from({ length: 11 }, (_, index) => index / 10)
const PROP_LINES = [0.5, 1.5, 2.5]

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

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

async function fetchBatterLogs(): Promise<BatterLog[]> {
  const output: BatterLog[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_statcast_batter_game_logs')
      .select('season,game_pk,game_date,batter,hits,plate_appearances')
      .in('season', [2025, 2026])
      .gte('plate_appearances', 1)
      .order('season', { ascending: true })
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .order('batter', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`Statcast batter game-log read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      output.push({
        season: requiredNumber(row.season, 'season'),
        gamePk: requiredNumber(row.game_pk, 'game_pk'),
        date: String(row.game_date),
        batterId: requiredNumber(row.batter, 'batter'),
        hits: requiredNumber(row.hits, 'hits'),
        plateAppearances: requiredNumber(row.plate_appearances, 'plate_appearances'),
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

async function fetchFeatures(): Promise<FeatureRow[]> {
  const output: FeatureRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('pick2_mlb_batter_daily_features')
      .select('target_game_pk,mlbam_batter_id,feature_date,as_of_date,source_window')
      .eq('feature_version', SOURCE_FEATURE_VERSION)
      .gte('feature_date', '2025-01-01')
      .lt('feature_date', '2027-01-01')
      .order('feature_date', { ascending: true })
      .order('target_game_pk', { ascending: true })
      .order('mlbam_batter_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`Batter pregame feature read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const sourceWindow = (row.source_window ?? {}) as RawRow
      output.push({
        gamePk: requiredNumber(row.target_game_pk, 'target_game_pk'),
        batterId: requiredNumber(row.mlbam_batter_id, 'mlbam_batter_id'),
        featureDate: String(row.feature_date),
        asOfDate: String(row.as_of_date),
        sourceRule: text(sourceWindow.rule),
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

function splitFor(season: number, date: string): ModelRow['split'] {
  if (season === 2026) return 'HOLDOUT'
  if (date < '2025-08-01') return 'TRAIN'
  if (date < '2025-09-01') return 'VALIDATION'
  return 'TEST'
}

function buildRows(logs: BatterLog[], features: FeatureRow[]) {
  const featureMap = new Map<string, FeatureRow>()
  for (const feature of features) featureMap.set(`${feature.gamePk}:${feature.batterId}`, feature)

  const byBatter = new Map<string, BatterLog[]>()
  for (const log of logs) {
    const key = `${log.season}:${log.batterId}`
    const bucket = byBatter.get(key) ?? []
    bucket.push(log)
    byBatter.set(key, bucket)
  }

  const rows: ModelRow[] = []
  let featureMatched = 0
  let strictPrior = 0

  for (const bucket of byBatter.values()) {
    bucket.sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
    let priorHits = 0
    let priorPa = 0
    let priorGames = 0
    const recent: BatterLog[] = []

    for (const log of bucket) {
      const feature = featureMap.get(`${log.gamePk}:${log.batterId}`)
      if (feature) featureMatched += 1
      const strict =
        feature !== undefined &&
        feature.featureDate === log.date &&
        feature.asOfDate < log.date &&
        feature.sourceRule === SOURCE_RULE
      if (strict) strictPrior += 1

      if (recent.length >= 10 && priorPa > 0 && strict) {
        const recentHits = recent.reduce((sum, item) => sum + item.hits, 0)
        const recentPa = recent.reduce((sum, item) => sum + item.plateAppearances, 0)
        const recentGames = recent.length
        if (recentPa > 0) {
          rows.push({
            season: log.season,
            gamePk: log.gamePk,
            date: log.date,
            batterId: log.batterId,
            split: splitFor(log.season, log.date),
            actual: log.hits,
            priorHitsAllPerGame: priorHits / priorGames,
            priorHitsL10PerGame: recentHits / recentGames,
            priorHitRateAll: priorHits / priorPa,
            priorHitRateL10: recentHits / recentPa,
            priorPaL10: recentPa / recentGames,
            priorGames,
            strictPriorFeature: true,
          })
        }
      }

      priorHits += log.hits
      priorPa += log.plateAppearances
      priorGames += 1
      recent.push(log)
      if (recent.length > 10) recent.shift()
    }
  }

  return {
    rows,
    quality: {
      sourceLogs: logs.length,
      featureRows: features.length,
      featureMatched,
      strictPrior,
      scoredRows: rows.length,
      leakageDetected: rows.some((row) => !row.strictPriorFeature),
    },
  }
}

function rawScore(row: ModelRow, alpha: number) {
  const rate = alpha * row.priorHitRateL10 + (1 - alpha) * row.priorHitRateAll
  return row.priorPaL10 * rate
}

function linearFit(points: Array<{ x: number; y: number }>): Fit | null {
  if (points.length < 2) return null
  const meanX = mean(points.map((row) => row.x))
  const meanY = mean(points.map((row) => row.y))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let denominator = 0
  for (const row of points) {
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

function fitRows(rows: ModelRow[], alpha: number) {
  return linearFit(rows.map((row) => ({ x: rawScore(row, alpha), y: row.actual })))
}

function scoreRows(rows: ModelRow[], fit: Fit, alpha: number): Scored[] {
  return rows.map((row) => ({
    actual: row.actual,
    predicted: Math.max(0, fit.intercept + fit.slope * rawScore(row, alpha)),
    date: row.date,
  }))
}

function selectAlpha(train: ModelRow[], validation: ModelRow[]) {
  const candidates = GRID.flatMap((alpha) => {
    const fit = fitRows(train, alpha)
    if (!fit) return []
    return [{ alpha, fit, validation: metrics(scoreRows(validation, fit, alpha)) }]
  }).sort(
    (a, b) =>
      (a.validation.rmse ?? Infinity) - (b.validation.rmse ?? Infinity) ||
      (a.validation.mae ?? Infinity) - (b.validation.mae ?? Infinity) ||
      a.alpha - b.alpha,
  )
  const selected = candidates[0]
  if (!selected) throw new Error('No valid batter hits alpha candidate')
  return {
    selected,
    top: candidates.slice(0, 5).map((candidate) => ({ alpha: candidate.alpha, validation: candidate.validation })),
  }
}

function empiricalOverProbability(predicted: number, line: number, residuals: number[]) {
  if (!residuals.length) return null
  const threshold = line - predicted
  let over = 0
  for (const residual of residuals) if (residual > threshold) over += 1
  return over / residuals.length
}

function brierReport(calibrationScored: Scored[], target: Scored[]) {
  const residuals = calibrationScored.map((row) => row.actual - row.predicted)
  return PROP_LINES.map((line) => {
    const calibrationEventRate = mean(calibrationScored.map((row) => (row.actual > line ? 1 : 0))) ?? 0
    const baselineBrier = mean(target.map((row) => ((row.actual > line ? 1 : 0) - calibrationEventRate) ** 2))
    const modelBrier = mean(
      target.map((row) => {
        const p = empiricalOverProbability(row.predicted, line, residuals) ?? calibrationEventRate
        return (p - (row.actual > line ? 1 : 0)) ** 2
      }),
    )
    return {
      line,
      n: target.length,
      calibrationEventRate,
      modelBrier,
      baselineBrier,
      brierSkill:
        modelBrier !== null && baselineBrier !== null && baselineBrier > 0
          ? 1 - modelBrier / baselineBrier
          : null,
    }
  })
}

function baselineMetrics(rows: ModelRow[]) {
  return {
    priorAllPerGame: metrics(rows.map((row) => ({ actual: row.actual, predicted: row.priorHitsAllPerGame }))),
    priorL10PerGame: metrics(rows.map((row) => ({ actual: row.actual, predicted: row.priorHitsL10PerGame }))),
  }
}

function monthlyMetrics(scored: Scored[]) {
  const byMonth = new Map<string, Scored[]>()
  for (const row of scored) {
    const month = String(row.date).slice(0, 7)
    const bucket = byMonth.get(month) ?? []
    bucket.push(row)
    byMonth.set(month, bucket)
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => ({ month, ...metrics(rows) }))
}

export async function runMlbBatterHitsBacktest() {
  const [logs, features] = await Promise.all([fetchBatterLogs(), fetchFeatures()])
  const built = buildRows(logs, features)
  const train = built.rows.filter((row) => row.split === 'TRAIN')
  const validation = built.rows.filter((row) => row.split === 'VALIDATION')
  const test = built.rows.filter((row) => row.split === 'TEST')
  const holdout = built.rows.filter((row) => row.split === 'HOLDOUT')

  const selection = selectAlpha(train, validation)
  const alpha = selection.selected.alpha
  const trainFit = selection.selected.fit
  const trainScored = scoreRows(train, trainFit, alpha)
  const validationScored = scoreRows(validation, trainFit, alpha)
  const testScored = scoreRows(test, trainFit, alpha)

  const final2025Fit = fitRows([...train, ...validation, ...test], alpha)
  if (!final2025Fit) throw new Error('Unable to fit final 2025 batter hits model')
  const holdoutScored = scoreRows(holdout, final2025Fit, alpha)

  return {
    modelVersion: MODEL_VERSION,
    status: 'SHADOW_CANDIDATE_ONLY',
    market: 'BATTER_HITS',
    generatedAt: new Date().toISOString(),
    design: {
      hyperparameterSelection: '2025 TRAIN -> 2025 VALIDATION only',
      fixedTest: '2025-09-01 through end of 2025 feature coverage',
      externalHoldout: '2026, never used for alpha selection',
      probabilityCalibration: '2026 probability diagnostics use empirical residuals from the untouched 2025 fixed TEST scored by the pre-test TRAIN-selected model. The final all-2025 fit is used only for 2026 point predictions.',
      sourceRule: SOURCE_RULE,
      sportsbookOddsUsed: false,
      providerCallsAtRuntime: false,
      officialPickWrites: false,
    },
    dataQuality: built.quality,
    selected: {
      alpha,
      interpretation: 'alpha weights last-10 hit rate; 1-alpha weights full prior-season hit rate before multiplying by prior L10 plate-appearance workload',
      trainFit,
      final2025Fit,
      topValidationCandidates: selection.top,
    },
    splitCounts: {
      train: train.length,
      validation: validation.length,
      test: test.length,
      holdout2026: holdout.length,
    },
    metrics: {
      train: metrics(trainScored),
      validation: metrics(validationScored),
      fixedTest2025: metrics(testScored),
      externalHoldout2026: metrics(holdoutScored),
    },
    baselines: {
      fixedTest2025: baselineMetrics(test),
      externalHoldout2026: baselineMetrics(holdout),
    },
    probabilities: {
      method: 'empirical residual distribution with no sportsbook odds',
      fixedTest2025: brierReport(trainScored, testScored),
      externalHoldout2026: brierReport(testScored, holdoutScored),
      externalHoldout2026Calibration: {
        source: 'untouched 2025 fixed TEST residuals from the pre-test model',
        target: 'external 2026 holdout',
        outOfSample: true,
      },
    },
    holdoutMonthly: monthlyMetrics(holdoutScored),
    safety: {
      theOddsApiCreditsConsumed: 0,
      officialPickWrites: 0,
      bettingActivated: false,
      productionEligible: false,
      nextGate: 'Forward shadow evaluation against frozen pregame batter-hit lines and lineup-confirmed opportunity context',
    },
  }
}
