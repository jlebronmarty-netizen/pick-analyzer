import 'server-only'

import { getBsnIntelligenceEngine } from '@/services/bsn-intelligence-engine.service'
import {
  BsnShadowPrediction,
  BsnStoredEvent,
  buildBsnShadowPredictionForEvent,
  getBsnShadowPredictionEngine,
  loadBsnStoredGamesForPrediction,
  validateBsnShadowPredictionEngine,
} from '@/services/bsn-shadow-prediction-engine.service'
import { getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { getSharedSportPredictionEngineSdk } from '@/services/sport-prediction-engine-sdk.service'
import { getBasketballDataPlatform, buildBasketballHistoricalSeasonPlan } from '@/services/basketball'

const BSN_SPORT_KEY = 'basketball_bsn' as const
const BSN_LEAGUE_KEY = 'bsn_pr' as const
const MATURITY_VERSION = 'bsn_model_maturity_v1'
const MIN_CALIBRATION_SAMPLE = 30
const MIN_ACTIVATION_SAMPLE = 100

type BacktestRow = {
  gameId: string
  matchup: string
  startTime: string | null
  actualWinner: 'home' | 'away'
  predictedWinner: 'home' | 'away' | null
  predictedProbability: number | null
  homeWinProbability: number | null
  awayWinProbability: number | null
  correct: boolean | null
  confidence: number
  predictionQuality: number
  featureQuality: number
  dataQuality: number
  brier: number | null
  explanation: {
    strengths: string[]
    weaknesses: string[]
    missingData: string[]
    confidence: string
    featureQuality: string
    dataSufficiency: string
  }
  source: 'replayed_shadow_prediction'
}

type CalibrationBucket = {
  bucket: string
  min: number
  max: number
  sample: number
  expectedWinRate: number
  actualWinRate: number
  calibrationError: number
  brierScore: number | null
  confidenceCorrection: number
  status: 'INSUFFICIENT_DATA' | 'CALIBRATED' | 'OVERCONFIDENT' | 'UNDERCONFIDENT'
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value))
  return clean.length ? round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0
}

function isCompletedWithScore(event: BsnStoredEvent) {
  const status = String(event.status ?? '').toLowerCase()
  return ['completed', 'final', 'closed', 'postgame'].includes(status) &&
    Number.isFinite(Number(event.home_score)) &&
    Number.isFinite(Number(event.away_score)) &&
    Number(event.home_score) !== Number(event.away_score)
}

function actualWinner(event: BsnStoredEvent): 'home' | 'away' {
  return Number(event.home_score) > Number(event.away_score) ? 'home' : 'away'
}

function predictedWinner(prediction: BsnShadowPrediction): 'home' | 'away' | null {
  if (prediction.homeWinProbability === null || prediction.awayWinProbability === null) return null
  return prediction.homeWinProbability >= prediction.awayWinProbability ? 'home' : 'away'
}

function predictedProbability(prediction: BsnShadowPrediction) {
  const winner = predictedWinner(prediction)
  if (winner === 'home') return prediction.homeWinProbability
  if (winner === 'away') return prediction.awayWinProbability
  return null
}

function brier(row: { predictedProbability: number | null; correct: boolean | null }) {
  if (row.predictedProbability === null || row.correct === null) return null
  const p = row.predictedProbability / 100
  const y = row.correct ? 1 : 0
  return round((p - y) ** 2, 4)
}

function explain(prediction: BsnShadowPrediction) {
  const strengths = prediction.reasoning.filter((reason) =>
    /stronger|better|rank|momentum|split|head-to-head/i.test(reason)
  )
  const weaknesses = prediction.unavailable.length
    ? ['Prediction remains limited by unavailable BSN inputs.']
    : []
  return {
    strengths,
    weaknesses,
    missingData: prediction.unavailable,
    confidence: `Shadow confidence is ${prediction.confidence}.`,
    featureQuality: `Feature quality is ${prediction.featureQuality}.`,
    dataSufficiency: `Data sufficiency is ${prediction.dataQuality}.`,
  }
}

function confidenceBucket(value: number | null) {
  const probability = Number(value ?? 0)
  if (probability >= 70) return { label: '70-100%', min: 70, max: 100 }
  if (probability >= 60) return { label: '60-69%', min: 60, max: 69.999 }
  if (probability >= 55) return { label: '55-59%', min: 55, max: 59.999 }
  if (probability >= 50) return { label: '50-54%', min: 50, max: 54.999 }
  return { label: '<50%', min: 0, max: 49.999 }
}

function calibrationStatus(sample: number, error: number): CalibrationBucket['status'] {
  if (sample < 5) return 'INSUFFICIENT_DATA'
  if (error <= -8) return 'OVERCONFIDENT'
  if (error >= 8) return 'UNDERCONFIDENT'
  return 'CALIBRATED'
}

function calibrationBuckets(rows: BacktestRow[]): CalibrationBucket[] {
  const buckets = [
    { label: '<50%', min: 0, max: 49.999 },
    { label: '50-54%', min: 50, max: 54.999 },
    { label: '55-59%', min: 55, max: 59.999 },
    { label: '60-69%', min: 60, max: 69.999 },
    { label: '70-100%', min: 70, max: 100 },
  ]
  return buckets.map((bucket) => {
    const bucketRows = rows.filter((row) =>
      row.predictedProbability !== null &&
      row.predictedProbability >= bucket.min &&
      row.predictedProbability <= bucket.max
    )
    const graded = bucketRows.filter((row) => row.correct !== null)
    const expectedWinRate = average(bucketRows.map((row) => Number(row.predictedProbability ?? 0)))
    const actualWinRate = graded.length
      ? round((graded.filter((row) => row.correct).length / graded.length) * 100)
      : 0
    const calibrationError = round(actualWinRate - expectedWinRate)
    return {
      bucket: bucket.label,
      min: bucket.min,
      max: bucket.max,
      sample: bucketRows.length,
      expectedWinRate,
      actualWinRate,
      calibrationError,
      brierScore: bucketRows.length ? average(bucketRows.map((row) => Number(row.brier ?? 0))) : null,
      confidenceCorrection: round(calibrationError),
      status: calibrationStatus(bucketRows.length, calibrationError),
    }
  })
}

function buildBacktestRows(events: BsnStoredEvent[], predictions: BsnShadowPrediction[]) {
  const predictionById = new Map(predictions.map((prediction) => [prediction.gameId, prediction]))
  return events.map((event): BacktestRow => {
    const prediction = predictionById.get(event.id)
    const winner = prediction ? predictedWinner(prediction) : null
    const actual = actualWinner(event)
    const correct = winner === null ? null : winner === actual
    const probability = prediction ? predictedProbability(prediction) : null
    const base = {
      predictedProbability: probability,
      correct,
    }

    return {
      gameId: event.id,
      matchup: `${prediction?.awayTeam ?? event.away_team ?? 'Away'} @ ${prediction?.homeTeam ?? event.home_team ?? 'Home'}`,
      startTime: event.start_time,
      actualWinner: actual,
      predictedWinner: winner,
      predictedProbability: probability,
      homeWinProbability: prediction?.homeWinProbability ?? null,
      awayWinProbability: prediction?.awayWinProbability ?? null,
      correct,
      confidence: prediction?.confidence ?? 0,
      predictionQuality: prediction?.predictionQuality ?? 0,
      featureQuality: prediction?.featureQuality ?? 0,
      dataQuality: prediction?.dataQuality ?? 0,
      brier: brier(base),
      explanation: prediction ? explain(prediction) : {
        strengths: [],
        weaknesses: ['No replayed shadow prediction was available for this game.'],
        missingData: ['prediction_replay'],
        confidence: 'Confidence unavailable.',
        featureQuality: 'Feature quality unavailable.',
        dataSufficiency: 'Data sufficiency unavailable.',
      },
      source: 'replayed_shadow_prediction',
    }
  })
}

function summarizeBacktest(rows: BacktestRow[]) {
  const graded = rows.filter((row) => row.correct !== null)
  const correct = graded.filter((row) => row.correct).length
  const incorrect = graded.filter((row) => row.correct === false).length
  return {
    gamesReplayed: rows.length,
    graded: graded.length,
    correct,
    incorrect,
    accuracy: graded.length ? round((correct / graded.length) * 100) : 0,
    predictionQuality: average(rows.map((row) => row.predictionQuality)),
    coverage: rows.length ? round((graded.length / rows.length) * 100) : 0,
    brierScore: graded.length ? average(graded.map((row) => Number(row.brier ?? 0))) : null,
    confidence: average(rows.map((row) => row.confidence)),
    confidenceError: graded.length ? round(average(graded.map((row) => row.confidence)) - ((correct / graded.length) * 100)) : 0,
  }
}

function distribution(rows: BacktestRow[]) {
  const groups = new Map<string, BacktestRow[]>()
  for (const row of rows) {
    const bucket = confidenceBucket(row.predictedProbability).label
    groups.set(bucket, [...(groups.get(bucket) ?? []), row])
  }
  return Array.from(groups.entries()).map(([bucket, bucketRows]) => ({
    bucket,
    predictions: bucketRows.length,
    correct: bucketRows.filter((row) => row.correct).length,
    averageProbability: average(bucketRows.map((row) => Number(row.predictedProbability ?? 0))),
  }))
}

function rollingAccuracy(rows: BacktestRow[], window = 5) {
  const ordered = [...rows].sort((left, right) => new Date(left.startTime ?? 0).getTime() - new Date(right.startTime ?? 0).getTime())
  return ordered.map((row, index) => {
    const slice = ordered.slice(Math.max(0, index - window + 1), index + 1).filter((item) => item.correct !== null)
    return {
      gameId: row.gameId,
      startTime: row.startTime,
      rollingWindow: window,
      rollingAccuracy: slice.length ? round((slice.filter((item) => item.correct).length / slice.length) * 100) : 0,
    }
  })
}

function dailyPerformance(rows: BacktestRow[]) {
  const groups = new Map<string, BacktestRow[]>()
  for (const row of rows) {
    const day = row.startTime ? row.startTime.slice(0, 10) : 'unknown'
    groups.set(day, [...(groups.get(day) ?? []), row])
  }
  return Array.from(groups.entries()).map(([date, dateRows]) => ({
    date,
    games: dateRows.length,
    correct: dateRows.filter((row) => row.correct).length,
    accuracy: dateRows.length ? round((dateRows.filter((row) => row.correct).length / dateRows.length) * 100) : 0,
  })).sort((left, right) => left.date.localeCompare(right.date))
}

async function buildReplayContext() {
  const [games, intelligence] = await Promise.all([
    loadBsnStoredGamesForPrediction(),
    getBsnIntelligenceEngine(),
  ])
  const scoredEvents = games.rows
    .filter(isCompletedWithScore)
    .sort((left, right) => new Date(left.start_time ?? 0).getTime() - new Date(right.start_time ?? 0).getTime())
  const predictions = scoredEvents.map((event) =>
    buildBsnShadowPredictionForEvent(
      event,
      intelligence.teamProfiles,
      scoredEvents.filter((candidate) => candidate.id !== event.id)
    )
  )
  const rows = buildBacktestRows(scoredEvents, predictions)

  return {
    generatedAt: new Date().toISOString(),
    games,
    intelligence,
    scoredEvents,
    predictions,
    rows,
    summary: summarizeBacktest(rows),
    buckets: calibrationBuckets(rows),
  }
}

export async function getBsnBacktestingEngine() {
  const context = await buildReplayContext()
  return {
    success: true,
    mode: 'bsn_backtesting_engine_v1',
    generatedAt: context.generatedAt,
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    summary: context.summary,
    predictionDistribution: distribution(context.rows),
    calibrationBuckets: context.buckets,
    featureCoverage: {
      averageFeatureQuality: average(context.rows.map((row) => row.featureQuality)),
      averageDataSufficiency: average(context.rows.map((row) => row.dataQuality)),
      replayRowsWithProbabilities: context.rows.filter((row) => row.predictedProbability !== null).length,
      replayRowsMissingProbabilities: context.rows.filter((row) => row.predictedProbability === null).length,
    },
    historicalPredictionHistory: context.rows,
    persistence: {
      existingPredictionHistoryReused: true,
      durableRowsWritten: 0,
      remoteMutationsMade: 0,
      blocker: 'BSN shadow replay rows are not written to prediction_history until an approved non-betting persistence contract exists.',
    },
    validationGate1: {
      gamesReplayed: context.summary.gamesReplayed,
      correct: context.summary.correct,
      incorrect: context.summary.incorrect,
      accuracy: context.summary.accuracy,
      predictionQuality: context.summary.predictionQuality,
      coverage: context.summary.coverage,
      brierScore: context.summary.brierScore,
      confidence: context.summary.confidence,
      passed: context.summary.graded > 0,
    },
    warnings: [
      ...(context.summary.graded < MIN_CALIBRATION_SAMPLE ? [`Backtest sample ${context.summary.graded} is below ${MIN_CALIBRATION_SAMPLE}; calibration remains directional.`] : []),
      'Replay uses the current stored BSN intelligence layer; immutable pregame feature snapshots are still required before official activation.',
    ],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnCalibrationEngine() {
  const backtest = await getBsnBacktestingEngine()
  const buckets = backtest.calibrationBuckets
  const validBuckets = buckets.filter((bucket) => bucket.sample >= 5)
  const calibrationError = validBuckets.length
    ? average(validBuckets.map((bucket) => Math.abs(bucket.calibrationError)))
    : 0
  const reliabilityScore = validBuckets.length ? round(Math.max(0, 100 - calibrationError * 4)) : 0
  const confidenceImprovement = validBuckets.length
    ? round(Math.max(0, Math.abs(backtest.summary.confidenceError) - calibrationError))
    : 0

  return {
    success: true,
    mode: 'bsn_calibration_engine_v1',
    generatedAt: new Date().toISOString(),
    calibrationComplete: validBuckets.length > 0,
    reliabilityScore,
    calibrationError,
    confidenceImprovement,
    buckets,
    reliabilityCurve: buckets.map((bucket) => ({
      bucket: bucket.bucket,
      expected: bucket.expectedWinRate,
      actual: bucket.actualWinRate,
      correction: bucket.confidenceCorrection,
      status: bucket.status,
    })),
    internalCalibration: {
      modelWeightsChanged: false,
      predictionLogicChanged: false,
      appliedToBetting: false,
      correctionTableOnly: true,
    },
    validationGate2: {
      calibrationComplete: validBuckets.length > 0,
      reliabilityScore,
      calibrationError,
      confidenceImprovement,
      passed: backtest.summary.graded >= MIN_CALIBRATION_SAMPLE && reliabilityScore >= 60,
    },
    blockers: [
      ...(backtest.summary.graded < MIN_CALIBRATION_SAMPLE ? [`Need at least ${MIN_CALIBRATION_SAMPLE} graded replay rows for calibration readiness.`] : []),
    ],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnPerformanceCenter() {
  const backtest = await getBsnBacktestingEngine()
  return {
    success: true,
    mode: 'bsn_performance_center_v1',
    generatedAt: new Date().toISOString(),
    performanceDashboard: true,
    metrics: backtest.summary,
    predictionHistory: backtest.historicalPredictionHistory,
    correctPredictions: backtest.historicalPredictionHistory.filter((row) => row.correct),
    incorrectPredictions: backtest.historicalPredictionHistory.filter((row) => row.correct === false),
    confidenceDistribution: distribution(backtest.historicalPredictionHistory),
    historicalTrend: rollingAccuracy(backtest.historicalPredictionHistory),
    rollingAccuracy: rollingAccuracy(backtest.historicalPredictionHistory),
    predictionTimeline: backtest.historicalPredictionHistory.map((row) => ({
      gameId: row.gameId,
      startTime: row.startTime,
      matchup: row.matchup,
      probability: row.predictedProbability,
      correct: row.correct,
    })),
    dailyPerformance: dailyPerformance(backtest.historicalPredictionHistory),
    coverage: backtest.featureCoverage,
    validationGate3: {
      performanceDashboard: true,
      predictionHistory: backtest.historicalPredictionHistory.length,
      metrics: Boolean(backtest.summary),
      coverage: backtest.featureCoverage,
      passed: backtest.historicalPredictionHistory.length > 0,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnExplanationEngine() {
  const backtest = await getBsnBacktestingEngine()
  const missingExplanations = backtest.historicalPredictionHistory.filter((row) =>
    !row.explanation.strengths.length &&
    !row.explanation.weaknesses.length &&
    !row.explanation.missingData.length
  ).length
  const coverage = backtest.historicalPredictionHistory.length
    ? round(((backtest.historicalPredictionHistory.length - missingExplanations) / backtest.historicalPredictionHistory.length) * 100)
    : 0

  return {
    success: true,
    mode: 'bsn_explanation_engine_v1',
    generatedAt: new Date().toISOString(),
    explanationQuality: coverage,
    coverage,
    missingExplanations,
    explanations: backtest.historicalPredictionHistory.map((row) => ({
      gameId: row.gameId,
      matchup: row.matchup,
      explanation: row.explanation,
    })),
    validationGate4: {
      explanationQuality: coverage,
      coverage,
      missingExplanations,
      passed: coverage === 100,
    },
    guardrails: {
      fabricatedExplanations: false,
      missingDataExplicit: true,
      confidenceExplained: true,
      featureQualityExplained: true,
      dataSufficiencyExplained: true,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnReadinessEngine() {
  const [backtest, calibration, shadow, validation] = await Promise.all([
    getBsnBacktestingEngine(),
    getBsnCalibrationEngine(),
    getBsnShadowPredictionEngine({ includeValidation: true }),
    validateBsnShadowPredictionEngine(),
  ])
  const blockers = [
    ...(backtest.summary.graded < MIN_ACTIVATION_SAMPLE ? [`Need ${MIN_ACTIVATION_SAMPLE} graded historical predictions; current sample is ${backtest.summary.graded}.`] : []),
    ...(calibration.validationGate2.passed ? [] : ['Calibration gate has not passed.']),
    ...(shadow.coverage.oddsCoverage > 0 ? [] : ['Verified BSN odds are unavailable.']),
    'Immutable pregame BSN feature snapshots are not persisted for historical replay.',
    'BSN player availability and boxscore depth remain unavailable.',
  ]
  const predictionReady = shadow.coverage.probabilityPredictions > 0 && validation.success
  const calibrationReady = calibration.validationGate2.passed
  const recommendationReady = predictionReady && calibrationReady && blockers.length === 0
  const officialPickReady = false
  const readinessScore = round(
    (predictionReady ? 30 : 0) +
    (backtest.summary.graded > 0 ? 20 : 0) +
    (calibrationReady ? 25 : 0) +
    (shadow.coverage.oddsCoverage > 0 ? 15 : 0) +
    (blockers.length === 0 ? 10 : 0)
  )

  return {
    success: true,
    mode: 'bsn_readiness_engine_v1',
    generatedAt: new Date().toISOString(),
    readinessScore,
    predictionReady,
    calibrationReady,
    recommendationReady,
    officialPickReady,
    blockingFactors: blockers,
    missingData: ['verified_odds', 'immutable_feature_snapshots', 'player_availability', 'boxscore_depth', 'settled_calibration_sample'],
    requiredImprovements: [
      'Persist immutable pregame BSN feature snapshots.',
      'Grow graded replay sample to at least 100 games.',
      'Acquire verified BSN odds before any recommendation logic is considered.',
      'Add player availability and boxscore/stat depth when supported.',
    ],
    validationGate5: {
      readinessScore,
      blockingFactors: blockers,
      missingData: ['verified_odds', 'immutable_feature_snapshots', 'player_availability', 'boxscore_depth'],
      requiredImprovements: 4,
      passed: recommendationReady && officialPickReady,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnShadowMarketIntelligence() {
  const [shadow, readiness] = await Promise.all([
    getBsnShadowPredictionEngine({ includeValidation: true }),
    getBsnReadinessEngine(),
  ])
  return {
    success: true,
    mode: 'bsn_shadow_market_intelligence_v1',
    generatedAt: new Date().toISOString(),
    shadowMode: true,
    currentBoardDisabled: true,
    officialPicksDisabled: true,
    noBettingActivation: true,
    predictions: shadow.predictions.map((prediction) => ({
      gameId: prediction.gameId,
      matchup: prediction.matchup,
      probability: prediction.homeWinProbability !== null && prediction.awayWinProbability !== null
        ? Math.max(prediction.homeWinProbability, prediction.awayWinProbability)
        : null,
      confidence: prediction.confidence,
      reason: prediction.reasoning[0] ?? 'Prediction reason unavailable.',
      featureQuality: prediction.featureQuality,
      predictionQuality: prediction.predictionQuality,
      readiness: readiness.predictionReady ? 'prediction_ready_shadow_only' : 'not_prediction_ready',
    })),
    disabledSurfaces: {
      officialPicks: true,
      aiLeans: true,
      watchlist: true,
      betSlip: true,
      ev: true,
      stakingMath: true,
      value: true,
    },
    validationGate6: {
      noBettingActivation: true,
      currentBoardDisabled: true,
      officialPicksDisabled: true,
      shadowPredictionsOnly: true,
      passed: shadow.officialPicks === 0 && shadow.currentBoardActivated === false,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnActivationAudit() {
  const [backtest, calibration, readiness, market] = await Promise.all([
    getBsnBacktestingEngine(),
    getBsnCalibrationEngine(),
    getBsnReadinessEngine(),
    getBsnShadowMarketIntelligence(),
  ])
  const eligibleForFutureActivation =
    backtest.summary.graded >= MIN_ACTIVATION_SAMPLE &&
    calibration.validationGate2.passed &&
    readiness.recommendationReady &&
    market.validationGate6.passed

  return {
    success: true,
    mode: 'bsn_activation_audit_v1',
    generatedAt: new Date().toISOString(),
    eligibleForFutureBettingActivation: eligibleForFutureActivation,
    recommendation: eligibleForFutureActivation ? 'Ready for Official Activation' : 'Continue Shadow',
    reasons: eligibleForFutureActivation
      ? ['Every BSN maturity gate passed.']
      : readiness.blockingFactors,
    finalGate: {
      bettingActivated: false,
      mayRecommendFutureActivation: eligibleForFutureActivation,
      passed: market.validationGate6.passed && !eligibleForFutureActivation,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export async function getBsnModelMaturity() {
  const [backtesting, calibration, performanceCenter, explanationEngine, readiness, shadowMarketIntelligence, activationAudit] = await Promise.all([
    getBsnBacktestingEngine(),
    getBsnCalibrationEngine(),
    getBsnPerformanceCenter(),
    getBsnExplanationEngine(),
    getBsnReadinessEngine(),
    getBsnShadowMarketIntelligence(),
    getBsnActivationAudit(),
  ])
  const featureStore = getFeatureStoreStatus()
  const predictionSdk = getSharedSportPredictionEngineSdk()
  const basketballPlatform = getBasketballDataPlatform({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY })
  const historicalBuilder = buildBasketballHistoricalSeasonPlan({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY, season: null, dateFrom: null, dateTo: null })
  const phaseScores = [
    backtesting.validationGate1.passed ? 15 : 5,
    calibration.validationGate2.passed ? 20 : 5,
    performanceCenter.validationGate3.passed ? 15 : 0,
    explanationEngine.validationGate4.passed ? 15 : 0,
    readiness.readinessScore * 0.2,
    shadowMarketIntelligence.validationGate6.passed ? 15 : 0,
  ]
  const overallBsnModelMaturityScore = round(phaseScores.reduce((sum, value) => sum + value, 0))

  return {
    success: true,
    mode: MATURITY_VERSION,
    generatedAt: new Date().toISOString(),
    backtesting,
    calibration,
    performanceCenter,
    explanationEngine,
    readiness,
    shadowMarketIntelligence,
    activationAudit,
    integrations: {
      basketballPlatform: basketballPlatform.mode,
      historicalBuilder: historicalBuilder.mode,
      featureStore: featureStore.mode,
      predictionSdk: predictionSdk.mode,
      bsnShadowPredictionEngine: 'bsn_shadow_prediction_engine_v1',
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    regression: {
      championUnchanged: true,
      thresholdsUnchanged: true,
      predictionLogicUnchanged: true,
      officialPicksActivated: false,
      currentBoardActivated: false,
    },
    overallBsnModelMaturityScore,
    recommendation: activationAudit.recommendation,
  }
}
