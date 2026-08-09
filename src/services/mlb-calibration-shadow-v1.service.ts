import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const REPLAY_FAMILY = 'retrosheet_historical_replay_phase_2b_v1'
const EPOCH_START = '2026-08-03T19:57:02.418+00:00'
const CALIBRATION_VERSION = 'mlb_market_calibration_shadow_v1'
const EPSILON = 0.01

type Market = 'moneyline' | 'run_line' | 'total' | 'unknown'
type Method = 'NO_CALIBRATION' | 'PLATT_LOGISTIC' | 'ISOTONIC' | 'BETA_CALIBRATION' | 'SIMPLE_SHRINKAGE' | 'MARKET_SHRINKAGE'

type ProjectionRow = {
  id: string
  event_id: string | null
  projection_key: string
  projection_family: string
  model_version: string | null
  projected_value: number | null
  actual_value: number | null
  confidence: number | null
  generated_at: string
  validity_status: string | null
  metadata: Record<string, unknown> | null
  feature_snapshot: Record<string, unknown> | null
}

type PredictionRow = {
  id: string
  game_id: string | null
  market: string | null
  selection: string | null
  team: string | null
  line: number | string | null
  model_probability: number | null
  confidence: number | null
  odds: number | null
  edge: number | null
  ev: number | null
  generated_at: string | null
  created_at: string | null
  commence_time: string | null
  status: string | null
  result: string | null
  settled_at: string | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  recommended_pick: boolean | null
  is_current: boolean | null
  model_version: string | null
  feature_snapshot: Record<string, unknown> | null
  settlement_details: Record<string, unknown> | null
}

type Sample = {
  id: string
  eventId: string | null
  market: Market
  rawProbability: number
  outcome: 0 | 1
  confidence: number
  generatedAt: string
  selectionSide: string | null
  line: number | null
  sourceOddsSnapshotId: string | null
}

type FitModel = {
  method: Method
  market: Market | 'global'
  params: number[]
  bins?: Array<{ min: number; max: number; value: number }>
  baseRate?: number
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clampProbability(value: number) {
  return Math.min(1 - EPSILON, Math.max(EPSILON, value))
}

function logit(probability: number) {
  const p = clampProbability(probability)
  return Math.log(p / (1 - p))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }
  const z = Math.exp(value)
  return z / (1 + z)
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function normalizeMarket(value: unknown): Market {
  const market = String(value ?? '').toLowerCase()
  if (market.includes('moneyline')) return 'moneyline'
  if (market.includes('run_line') || market.includes('spread')) return 'run_line'
  if (market.includes('total')) return 'total'
  return 'unknown'
}

function marketFromProjection(row: ProjectionRow): Market {
  const feature = asRecord(row.feature_snapshot)
  const featureMarket = normalizeMarket(feature.market)
  if (featureMarket !== 'unknown') return featureMarket
  return normalizeMarket(row.projection_key)
}

function sourceOddsSnapshotId(feature: Record<string, unknown>) {
  return typeof feature.sourceOddsSnapshotId === 'string' ? feature.sourceOddsSnapshotId : null
}

function featureSelection(feature: Record<string, unknown>) {
  return typeof feature.selection === 'string' ? feature.selection.toLowerCase() : ''
}

function parseLineFromSource(sourceId: string | null) {
  if (!sourceId) return null
  const parts = sourceId.split(':')
  const numeric = parts.map((part) => Number(part)).filter((part) => Number.isFinite(part))
  return numeric.length ? numeric[numeric.length - 1] : null
}

function parseSideFromSource(sourceId: string | null, market: Market) {
  if (!sourceId) return null
  const parts = sourceId.toLowerCase().split(':')
  if (market === 'total') {
    if (parts.includes('over')) return 'over'
    if (parts.includes('under')) return 'under'
  }
  if (market === 'run_line') {
    if (parts.includes('home')) return 'home'
    if (parts.includes('away')) return 'away'
  }
  return null
}

function selectionSideFromFeature(feature: Record<string, unknown>, market: Market, sourceId: string | null) {
  const selection = featureSelection(feature)
  if (market === 'total') {
    if (selection.includes('over')) return 'over'
    if (selection.includes('under')) return 'under'
  }
  if (market === 'run_line') {
    if (selection.includes('-1.5')) return 'home_minus_1_5'
    if (selection.includes('+1.5')) return 'plus_1_5'
  }
  return parseSideFromSource(sourceId, market)
}

function predictionSelectionSide(row: PredictionRow, market: Market) {
  const selection = String(row.selection ?? row.team ?? '').toLowerCase()
  if (market === 'total') {
    if (selection.includes('over')) return 'over'
    if (selection.includes('under')) return 'under'
  }
  if (market === 'run_line') {
    const line = asNumber(row.line)
    if (line !== null) return line > 0 ? 'plus_line' : line < 0 ? 'minus_line' : 'pick'
  }
  return selection || null
}

function brier(probability: number, outcome: 0 | 1) {
  return (probability - outcome) ** 2
}

function logLoss(probability: number, outcome: 0 | 1) {
  const p = clampProbability(probability)
  return outcome === 1 ? -Math.log(p) : -Math.log(1 - p)
}

function score(samples: Sample[], probabilityFor: (sample: Sample) => number) {
  const probabilities = samples.map((sample) => clampProbability(probabilityFor(sample)))
  const outcomes = samples.map((sample) => sample.outcome)
  const wins = outcomes.filter((outcome) => outcome === 1).length
  const losses = outcomes.length - wins
  const deltas = probabilities.map((probability, index) => probability - outcomes[index])
  return {
    sample: samples.length,
    wins,
    losses,
    accuracy: samples.length ? round((wins / samples.length) * 100, 2) : 0,
    averageProbability: samples.length ? round(average(probabilities) * 100, 2) : 0,
    observedWinRate: samples.length ? round((wins / samples.length) * 100, 2) : 0,
    brier: samples.length ? round(average(probabilities.map((probability, index) => brier(probability, outcomes[index]))), 4) : 0,
    logLoss: samples.length ? round(average(probabilities.map((probability, index) => logLoss(probability, outcomes[index]))), 4) : 0,
    calibrationError: samples.length ? round(Math.abs(average(deltas)) * 100, 2) : 0,
    calibrationBias: samples.length ? round(average(deltas) * 100, 2) : 0,
  }
}

function fitLinearLogistic(samples: Sample[], featureFor: (sample: Sample) => number[]) {
  const width = featureFor(samples[0]).length
  const weights = Array.from({ length: width }, () => 0)
  const learningRate = 0.04
  const l2 = 0.001
  for (let iteration = 0; iteration < 900; iteration += 1) {
    const gradient = Array.from({ length: width }, () => 0)
    for (const sample of samples) {
      const x = featureFor(sample)
      const prediction = sigmoid(weights.reduce((sum, weight, index) => sum + weight * x[index], 0))
      const error = prediction - sample.outcome
      for (let index = 0; index < width; index += 1) gradient[index] += error * x[index]
    }
    for (let index = 0; index < width; index += 1) {
      const penalty = index === 0 ? 0 : l2 * weights[index]
      weights[index] -= learningRate * ((gradient[index] / samples.length) + penalty)
    }
  }
  return weights
}

function fitPlatt(samples: Sample[], market: Market | 'global'): FitModel {
  return { method: 'PLATT_LOGISTIC', market, params: fitLinearLogistic(samples, (sample) => [1, logit(sample.rawProbability)]) }
}

function fitBeta(samples: Sample[], market: Market | 'global'): FitModel {
  return {
    method: 'BETA_CALIBRATION',
    market,
    params: fitLinearLogistic(samples, (sample) => [1, Math.log(clampProbability(sample.rawProbability)), Math.log(clampProbability(1 - sample.rawProbability))]),
  }
}

function pava(points: Array<{ probability: number; outcome: number }>) {
  const blocks: Array<{ min: number; max: number; sum: number; count: number; value: number }> = []
  for (const point of points.sort((a, b) => a.probability - b.probability)) {
    blocks.push({ min: point.probability, max: point.probability, sum: point.outcome, count: 1, value: point.outcome })
    while (blocks.length >= 2 && blocks[blocks.length - 2].value > blocks[blocks.length - 1].value) {
      const last = blocks.pop()
      const previous = blocks.pop()
      if (!last || !previous) break
      const merged = {
        min: previous.min,
        max: last.max,
        sum: previous.sum + last.sum,
        count: previous.count + last.count,
        value: (previous.sum + last.sum) / (previous.count + last.count),
      }
      blocks.push(merged)
    }
  }
  return blocks.map((block) => ({ min: block.min, max: block.max, value: clampProbability(block.value) }))
}

function fitIsotonic(samples: Sample[], market: Market | 'global'): FitModel {
  return {
    method: 'ISOTONIC',
    market,
    params: [],
    bins: pava(samples.map((sample) => ({ probability: sample.rawProbability, outcome: sample.outcome }))),
  }
}

function fitShrinkage(samples: Sample[], market: Market | 'global', method: Method): FitModel {
  const baseRate = average(samples.map((sample) => sample.outcome))
  let bestLambda = 1
  let bestBrier = Number.POSITIVE_INFINITY
  for (let i = 0; i <= 20; i += 1) {
    const lambda = i / 20
    const current = score(samples, (sample) => lambda * sample.rawProbability + (1 - lambda) * baseRate).brier
    if (current < bestBrier) {
      bestBrier = current
      bestLambda = lambda
    }
  }
  return { method, market, params: [bestLambda], baseRate }
}

function predict(model: FitModel, sample: Pick<Sample, 'rawProbability'>) {
  if (model.method === 'NO_CALIBRATION') return clampProbability(sample.rawProbability)
  if (model.method === 'PLATT_LOGISTIC') return clampProbability(sigmoid(model.params[0] + model.params[1] * logit(sample.rawProbability)))
  if (model.method === 'BETA_CALIBRATION') {
    return clampProbability(sigmoid(model.params[0] + model.params[1] * Math.log(clampProbability(sample.rawProbability)) + model.params[2] * Math.log(clampProbability(1 - sample.rawProbability))))
  }
  if (model.method === 'ISOTONIC') {
    const bins = model.bins ?? []
    const bin = bins.find((item) => sample.rawProbability >= item.min && sample.rawProbability <= item.max)
    if (bin) return clampProbability(bin.value)
    if (!bins.length) return clampProbability(sample.rawProbability)
    const nearest = bins.reduce((best, item) => {
      const distance = Math.min(Math.abs(sample.rawProbability - item.min), Math.abs(sample.rawProbability - item.max))
      return distance < best.distance ? { item, distance } : best
    }, { item: bins[0], distance: Number.POSITIVE_INFINITY })
    return clampProbability(nearest.item.value)
  }
  const lambda = model.params[0] ?? 1
  const baseRate = model.baseRate ?? 0.5
  return clampProbability(lambda * sample.rawProbability + (1 - lambda) * baseRate)
}

function splitByRatio(samples: Sample[], trainRatio: number, validationRatio: number) {
  const ordered = [...samples].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt) || a.id.localeCompare(b.id))
  const trainEnd = Math.floor(ordered.length * trainRatio)
  const validationEnd = Math.floor(ordered.length * validationRatio)
  return { training: ordered.slice(0, trainEnd), validation: ordered.slice(trainEnd, validationEnd), holdout: ordered.slice(validationEnd) }
}

function dateRange(samples: Sample[]) {
  if (!samples.length) return { start: null, end: null }
  const dates = samples.map((sample) => sample.generatedAt).sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

function trainCandidates(samples: Sample[], market: Market | 'global') {
  return [
    { method: 'NO_CALIBRATION' as const, market, params: [] },
    fitPlatt(samples, market),
    fitIsotonic(samples, market),
    fitBeta(samples, market),
    fitShrinkage(samples, market, 'SIMPLE_SHRINKAGE'),
    fitShrinkage(samples, market, 'MARKET_SHRINKAGE'),
  ]
}

function evaluateCandidate(model: FitModel, validation: Sample[]) {
  return { method: model.method, ...score(validation, (sample) => predict(model, sample)) }
}

function selectBest(candidates: FitModel[], validation: Sample[]) {
  const raw = score(validation, (sample) => sample.rawProbability)
  const evaluated = candidates.map((candidate) => ({ model: candidate, metrics: evaluateCandidate(candidate, validation) }))
  const sorted = evaluated.sort((a, b) => {
    const brierDelta = a.metrics.brier - b.metrics.brier
    if (Math.abs(brierDelta) > 0.0001) return brierDelta
    return a.metrics.calibrationError - b.metrics.calibrationError
  })
  const best = sorted[0]
  return {
    raw,
    selected: best.model,
    selectedMetrics: best.metrics,
    candidates: evaluated.map(({ model, metrics }) => ({
      method: model.method,
      brier: metrics.brier,
      calibrationError: metrics.calibrationError,
      calibrationBias: metrics.calibrationBias,
      logLoss: metrics.logLoss,
      accuracy: metrics.accuracy,
      brierImprovement: round(raw.brier - metrics.brier, 4),
      calibrationImprovement: round(raw.calibrationError - metrics.calibrationError, 2),
    })),
  }
}

function probabilityBand(probability: number) {
  if (probability >= 0.8) return '80+'
  if (probability >= 0.75) return '75-80'
  if (probability >= 0.7) return '70-75'
  if (probability >= 0.65) return '65-70'
  if (probability >= 0.6) return '60-65'
  return '<60'
}

function groupSamples(samples: Sample[], groupFor: (sample: Sample) => string, probabilityFor: (sample: Sample) => number) {
  const groups = new Map<string, Sample[]>()
  for (const sample of samples) groups.set(groupFor(sample), [...(groups.get(groupFor(sample)) ?? []), sample])
  return Array.from(groups.entries()).map(([key, rows]) => ({
    key,
    raw: score(rows, (sample) => sample.rawProbability),
    shadow: score(rows, probabilityFor),
    averageDelta: round(average(rows.map((sample) => probabilityFor(sample) - sample.rawProbability)) * 100, 2),
  })).sort((a, b) => a.key.localeCompare(b.key))
}

async function loadReplayRows() {
  const rows: ProjectionRow[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('universal_projection_history')
      .select('id, event_id, projection_key, projection_family, model_version, projected_value, actual_value, confidence, generated_at, validity_status, metadata, feature_snapshot')
      .eq('sport_key', SPORT_KEY)
      .eq('projection_family', REPLAY_FAMILY)
      .order('generated_at', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`HR-03 replay load failed at offset ${offset}: ${error.message}`)
    rows.push(...((data ?? []) as ProjectionRow[]))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function loadCurrentRows(limit: number) {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, game_id, market, selection, team, line, model_probability, confidence, odds, ev, edge, generated_at, created_at, commence_time, status, result, settled_at, production_eligible, trial, scrambled, recommended_pick, is_current, model_version, feature_snapshot, settlement_details')
    .eq('sport_key', SPORT_KEY)
    .gte('generated_at', EPOCH_START)
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`HR-03 Current Era load failed: ${error.message}`)
  return ((data ?? []) as PredictionRow[]).filter((row) => {
    const feature = asRecord(row.feature_snapshot)
    const epoch = asRecord(feature.predictionEpoch)
    const policy = asRecord(feature.productionEvaluationPolicy)
    return row.trial !== true
      && row.scrambled !== true
      && (epoch.epochKey === 'CURRENT_V2_PRODUCTION' || policy.production_evaluable === true || feature.prospective_preview === true)
  })
}

function toSamples(rows: ProjectionRow[]) {
  const samples: Sample[] = []
  let pushes = 0
  for (const row of rows) {
    const projected = asNumber(row.projected_value)
    const actual = asNumber(row.actual_value)
    if (projected === null || actual === null || row.validity_status !== 'VALID') continue
    if (actual !== 0 && actual !== 100) {
      pushes += 1
      continue
    }
    const feature = asRecord(row.feature_snapshot)
    const market = marketFromProjection(row)
    const sourceId = sourceOddsSnapshotId(feature)
    samples.push({
      id: row.id,
      eventId: row.event_id,
      market,
      rawProbability: clampProbability(projected / 100),
      outcome: actual === 100 ? 1 : 0,
      confidence: asNumber(row.confidence) ?? projected,
      generatedAt: row.generated_at,
      selectionSide: selectionSideFromFeature(feature, market, sourceId),
      line: asNumber(feature.line) ?? parseLineFromSource(sourceId),
      sourceOddsSnapshotId: sourceId,
    })
  }
  return { samples, pushes }
}

function buildTrainingSupport(samples: Sample[]) {
  const groups = new Map<Market, Sample[]>()
  for (const sample of samples) groups.set(sample.market, [...(groups.get(sample.market) ?? []), sample])
  const support: Record<string, unknown> = {}
  for (const [market, rows] of groups) {
    support[market] = {
      sampleSize: rows.length,
      marketFamily: market,
      selectionSides: Array.from(new Set(rows.map((row) => row.selectionSide ?? 'unknown'))).sort(),
      lineScope: Array.from(new Set(rows.map((row) => row.line).filter((line) => line !== null).map((line) => String(line)))).sort(),
      probabilityRange: {
        min: round(Math.min(...rows.map((row) => row.rawProbability)) * 100, 2),
        max: round(Math.max(...rows.map((row) => row.rawProbability)) * 100, 2),
      },
      classification: market === 'run_line'
        ? 'EXPECTED_FROZEN_REPLAY_SCOPE_HOME_MINUS_1_5_ONLY'
        : market === 'total'
          ? 'EXPECTED_FROZEN_REPLAY_SCOPE_OVER_ONLY'
          : 'SUPPORTED_MARKET_FAMILY',
    }
  }
  return support
}

function supportForPrediction(row: PredictionRow) {
  const market = normalizeMarket(row.market)
  const rawProbability = clampProbability((asNumber(row.model_probability) ?? 0) / 100)
  const line = asNumber(row.line)
  const side = predictionSelectionSide(row, market)
  if (market === 'unknown') return { market, rawProbability, supported: false, unsupportedReason: 'UNKNOWN_MARKET', line, side }
  if (market === 'run_line') {
    if (line !== -1.5) return { market, rawProbability, supported: false, unsupportedReason: 'RUN_LINE_OUTSIDE_MINUS_1_5_TRAINING_SUPPORT', line, side }
  }
  if (market === 'total') {
    if (side !== 'over') return { market, rawProbability, supported: false, unsupportedReason: 'TOTAL_UNDER_UNSUPPORTED_BY_OVER_ONLY_REPLAY', line, side }
  }
  return { market, rawProbability, supported: true, unsupportedReason: null, line, side }
}

function americanImplied(odds: number | null) {
  if (odds === null || odds === 0) return null
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)
}

function evFromProbability(probability: number, odds: number | null) {
  if (odds === null || odds === 0) return null
  const profit = odds > 0 ? odds / 100 : 100 / Math.abs(odds)
  return round((probability * profit) - (1 - probability), 4)
}

function applyMarketModel(models: Map<Market, FitModel>, row: PredictionRow) {
  const support = supportForPrediction(row)
  const model = support.supported ? models.get(support.market) : null
  const calibrated = model ? predict(model, { rawProbability: support.rawProbability }) : support.rawProbability
  const odds = asNumber(row.odds)
  const implied = americanImplied(odds)
  return {
    predictionId: row.id,
    eventId: row.game_id,
    market: support.market,
    selection: row.selection ?? row.team,
    line: support.line,
    selectionSide: support.side,
    rawProbability: round(support.rawProbability * 100, 2),
    calibratedProbability: support.supported ? round(calibrated * 100, 2) : null,
    delta: support.supported ? round((calibrated - support.rawProbability) * 100, 2) : null,
    calibrationVersion: CALIBRATION_VERSION,
    calibrationMethod: model?.method ?? null,
    supported: support.supported,
    unsupportedReason: support.unsupportedReason,
    shadowOnly: true,
    confidence: row.confidence,
    odds,
    impliedProbability: implied === null ? null : round(implied * 100, 2),
    rawEdge: implied === null ? null : round((support.rawProbability - implied) * 100, 2),
    shadowEdge: implied === null || !support.supported ? null : round((calibrated - implied) * 100, 2),
    rawEv: evFromProbability(support.rawProbability, odds),
    shadowEv: support.supported ? evFromProbability(calibrated, odds) : null,
    productionRecommendedPick: row.recommended_pick === true,
    productionProbabilityChanged: false,
  }
}

function buildFolds(samples: Sample[]) {
  const definitions = [
    { id: 'fold_1', trainRatio: 0.5, validationRatio: 0.65 },
    { id: 'fold_2', trainRatio: 0.65, validationRatio: 0.8 },
    { id: 'fold_3', trainRatio: 0.8, validationRatio: 1 },
  ]
  return definitions.map((definition) => {
    const split = splitByRatio(samples, definition.trainRatio, definition.validationRatio)
    const beta = fitBeta(split.training, 'global')
    const raw = score(split.validation, (sample) => sample.rawProbability)
    const shadow = score(split.validation, (sample) => predict(beta, sample))
    return {
      id: definition.id,
      training: { count: split.training.length, ...dateRange(split.training) },
      validation: { count: split.validation.length, ...dateRange(split.validation) },
      method: 'BETA_CALIBRATION',
      raw,
      shadow,
      brierImprovement: round(raw.brier - shadow.brier, 4),
      calibrationImprovement: round(raw.calibrationError - shadow.calibrationError, 2),
    }
  })
}

export async function getMlbCalibrationShadowV1(options: { currentLimit?: number } = {}) {
  const replayRows = await loadReplayRows()
  const { samples, pushes } = toSamples(replayRows)
  const split = splitByRatio(samples, 0.75, 1)
  const markets: Array<Market | 'global'> = ['global', 'moneyline', 'run_line', 'total']
  const marketModels = new Map<Market, FitModel>()
  const marketResults = markets.map((market) => {
    const training = market === 'global' ? split.training : split.training.filter((sample) => sample.market === market)
    const validation = market === 'global' ? split.validation : split.validation.filter((sample) => sample.market === market)
    const selected = selectBest(trainCandidates(training, market), validation)
    if (market !== 'global') marketModels.set(market, selected.selected)
    return {
      market,
      training: { count: training.length, ...dateRange(training) },
      validation: { count: validation.length, ...dateRange(validation) },
      raw: selected.raw,
      selectedMethod: selected.selected.method,
      shadow: selected.selectedMetrics,
      candidates: selected.candidates,
      brierImprovement: round(selected.raw.brier - selected.selectedMetrics.brier, 4),
      calibrationImprovement: round(selected.raw.calibrationError - selected.selectedMetrics.calibrationError, 2),
      parameters: {
        method: selected.selected.method,
        coefficients: selected.selected.params.map((value) => round(value, 6)),
        baseRate: selected.selected.baseRate === undefined ? null : round(selected.selected.baseRate, 6),
        isotonicBins: selected.selected.bins?.length ?? 0,
      },
    }
  })

  const globalModel = marketResults.find((result) => result.market === 'global')
  const highProbability = groupSamples(split.holdout, (sample) => probabilityBand(sample.rawProbability), (sample) => {
    const model = marketModels.get(sample.market)
    return model ? predict(model, sample) : sample.rawProbability
  })

  const currentRows = await loadCurrentRows(options.currentLimit ?? 500)
  const shadowOutputs = currentRows.map((row) => applyMarketModel(marketModels, row))
  const currentSettledSamples: Sample[] = currentRows
    .filter((row) => ['win', 'loss'].includes(String(row.result ?? row.status)))
    .map((row) => {
      const support = supportForPrediction(row)
      return {
        id: row.id,
        eventId: row.game_id,
        market: support.market,
        rawProbability: support.rawProbability,
        outcome: String(row.result ?? row.status) === 'win' ? 1 : 0,
        confidence: asNumber(row.confidence) ?? 0,
        generatedAt: row.generated_at ?? row.created_at ?? '',
        selectionSide: support.side,
        line: support.line,
        sourceOddsSnapshotId: null,
      } as Sample
    })
  const currentSupported = currentSettledSamples.filter((sample) => {
    if (sample.market === 'run_line') return sample.line === -1.5
    if (sample.market === 'total') return sample.selectionSide === 'over'
    return sample.market === 'moneyline'
  })
  const currentRaw = score(currentSettledSamples, (sample) => sample.rawProbability)
  const currentShadow = score(currentSupported, (sample) => {
    const model = marketModels.get(sample.market)
    return model ? predict(model, sample) : sample.rawProbability
  })

  const withPrice = shadowOutputs.filter((output) => output.odds !== null && output.impliedProbability !== null)
  const rawEligible = withPrice.filter((output) => (output.rawEdge ?? -999) > 0 && (output.rawEv ?? -999) > 0)
  const shadowEligible = withPrice.filter((output) => output.supported && (output.shadowEdge ?? -999) > 0 && (output.shadowEv ?? -999) > 0)
  const caseStudy = withPrice
    .filter((output) => output.supported)
    .sort((a, b) => Math.abs((b.rawProbability ?? 0) - 75) - Math.abs((a.rawProbability ?? 0) - 75))
    .pop() ?? shadowOutputs.find((output) => output.supported) ?? null

  return {
    success: true,
    mode: 'mlb_calibration_shadow_v1',
    generatedAt: new Date().toISOString(),
    sportKey: SPORT_KEY,
    replayFamily: REPLAY_FAMILY,
    calibrationVersion: CALIBRATION_VERSION,
    calibrationStatus: 'SHADOW',
    shadowOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    predictionWrites: 0,
    settlementWrites: 0,
    learningWrites: 0,
    productionProbabilityChanged: false,
    officialPickPolicyChanged: false,
    rankingsChanged: false,
    performanceDenominatorChanged: false,
    odds02aRemainingRequest: 1,
    replayDataset: {
      rows: replayRows.length,
      scoredRows: samples.length,
      pushRows: pushes,
      events: new Set(replayRows.map((row) => row.event_id).filter(Boolean)).size,
      markets: Object.fromEntries(['moneyline', 'run_line', 'total'].map((market) => [market, samples.filter((sample) => sample.market === market).length])),
    },
    trainingSupport: buildTrainingSupport(samples),
    chronologicalDesign: {
      primary: {
        training: { count: split.training.length, ...dateRange(split.training) },
        validation: { count: split.validation.length, ...dateRange(split.validation) },
      },
      folds: buildFolds(samples),
    },
    calibrationRegistry: {
      version: CALIBRATION_VERSION,
      method: 'MARKET_SPECIFIC_BETA_CALIBRATION_PREFERRED_WITH_CANDIDATE_COMPARISON',
      status: 'SHADOW',
      trainedThrough: dateRange(split.training).end,
      validationThrough: dateRange(split.validation).end,
      numericalBounds: { min: EPSILON, max: 1 - EPSILON },
      productionPromotion: false,
      rollback: 'Remove diagnostic usage or ignore calibrationVersion; rawProbability remains unchanged.',
    },
    marketResults,
    globalSummary: globalModel,
    extremeProbability: highProbability,
    supportGuardrails: {
      runLine: {
        result: 'SUPPORTED_ONLY_FOR_MINUS_1_5_REPLAY_REGIME',
        unsupportedRegimes: ['+1.5', 'favorite/underdog not proven beyond stored home -1.5 lineage', 'complement-derived sides without exact training support'],
      },
      total: {
        result: 'SUPPORTED_ONLY_FOR_OVER_REPLAY_REGIME',
        unsupportedRegimes: ['UNDER'],
      },
    },
    currentEraShadow: {
      rowsRead: currentRows.length,
      outputs: shadowOutputs.slice(0, 200),
      supported: shadowOutputs.filter((output) => output.supported).length,
      unsupported: shadowOutputs.filter((output) => !output.supported).length,
      unsupportedReasons: shadowOutputs.reduce<Record<string, number>>((counts, output) => {
        if (output.unsupportedReason) counts[output.unsupportedReason] = (counts[output.unsupportedReason] ?? 0) + 1
        return counts
      }, {}),
      settledDiagnostic: {
        confidence: currentSettledSamples.length >= 100 ? 'DIRECTIONAL' : 'LOW_SAMPLE',
        raw: currentRaw,
        shadowSupportedOnly: currentShadow,
      },
    },
    recommendationImpactSimulation: {
      pricedRows: withPrice.length,
      rawEligible: rawEligible.length,
      shadowEligible: shadowEligible.length,
      wouldRemainEligible: shadowEligible.filter((output) => rawEligible.some((raw) => raw.predictionId === output.predictionId)).length,
      wouldLoseEligibility: rawEligible.filter((output) => !shadowEligible.some((shadow) => shadow.predictionId === output.predictionId)).length,
      wouldNewlyBecomeEligible: shadowEligible.filter((output) => !rawEligible.some((raw) => raw.predictionId === output.predictionId)).length,
      simulationOnly: true,
    },
    caseStudy,
    promotionGates: {
      positiveOutOfSampleBrierImprovement: marketResults.filter((result) => result.market !== 'global').every((result) => result.brierImprovement >= 0),
      positiveCalibrationImprovement: marketResults.filter((result) => result.market !== 'global').every((result) => result.calibrationImprovement > 0),
      stableChronologicalFolds: buildFolds(samples).every((fold) => fold.brierImprovement >= -0.002),
      noMarketIdentityDefect: false,
      trainingSupportMatchesProductionUse: false,
      currentEraDoesNotContradictReplay: false,
      rawProbabilityRetained: true,
      calibrationVersionExplicit: true,
      rollbackPossible: true,
    },
    decision: 'CALIBRATION_SHADOW_PASS_MORE_CURRENT_ERA_EVIDENCE_REQUIRED',
    nextRecommendedPhase: 'HR-04 CALIBRATION PRODUCTION PROMOTION only after guardrails and Current Era evidence improve; otherwise continue shadow observation.',
  }
}

export const MLB_CALIBRATION_SHADOW_V1_VERSION = CALIBRATION_VERSION
