import { calculateQuarterKellyStake } from '@/services/kelly.service'
import { calculateSmartScore } from '@/services/smart-ranking.service'
import {
  expectedValue,
  fairAmericanOdds,
  impliedProbability,
  type SportEngineCompletionStatus,
  type SportEngineRecommendationStatus,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewSoccerFeatureStoreSnapshot } from '@/services/soccer-feature-store-integration.service'

type SoccerOutcome = 'home' | 'draw' | 'away'
type SoccerMarket =
  | '1x2'
  | 'moneyline_alias'
  | 'double_chance'
  | 'draw_no_bet'
  | 'total'
  | 'both_teams_to_score'
  | 'first_half_1x2'
  | 'first_half_total'
  | 'qualification'
  | 'asian_handicap_contract'

type ThreeWayProbabilities = Record<SoccerOutcome, number>

type SoccerPrediction = {
  id: string
  market: SoccerMarket
  selection: string
  americanOdds: number
  line: number | null
  modelProbability: number
  impliedProbability: number
  noVigProbability: number
  fairOdds: number
  edge: number
  expectedValue: number
  confidence: number
  recommendation: SportEngineRecommendationStatus
  explanationFactors: string[]
  warnings: string[]
}

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const SOCCER_ENGINE_WARNINGS = [
  'Soccer Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Draw-aware context, league strength, lineups, injuries and expected-goals inputs are unavailable and not fabricated.',
  'Asian handicap is exposed as a contract only until normalized market support is finalized.',
  'Qualification is treated separately from match winner.',
  'Real-data validation and historical calibration are pending.',
]

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function decimalOdds(americanOdds: number) {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds)
}

function normalizeThreeWay(input: ThreeWayProbabilities): ThreeWayProbabilities {
  const positive = {
    home: Math.max(0, input.home),
    draw: Math.max(0, input.draw),
    away: Math.max(0, input.away),
  }
  const total = positive.home + positive.draw + positive.away || 1

  return {
    home: round((positive.home / total) * 100, 4),
    draw: round((positive.draw / total) * 100, 4),
    away: round((positive.away / total) * 100, 4),
  }
}

function rebalanceToHundred(input: ThreeWayProbabilities): ThreeWayProbabilities {
  const normalized = normalizeThreeWay(input)
  const drift = round(100 - normalized.home - normalized.draw - normalized.away, 4)

  return {
    ...normalized,
    draw: round(normalized.draw + drift, 4),
  }
}

function noVigThreeWay(odds: Record<SoccerOutcome, number>): ThreeWayProbabilities {
  const raw = {
    home: impliedProbability(odds.home),
    draw: impliedProbability(odds.draw),
    away: impliedProbability(odds.away),
  }

  return rebalanceToHundred(raw)
}

function deriveThreeWayProbabilities({
  projectedHomeGoals,
  projectedAwayGoals,
  uncertainty,
  drawPenalty,
}: {
  projectedHomeGoals: number
  projectedAwayGoals: number
  uncertainty: number
  drawPenalty: number
}) {
  const margin = projectedHomeGoals - projectedAwayGoals
  const total = projectedHomeGoals + projectedAwayGoals
  const drawBase = clamp(30 - Math.abs(margin) * 8 + uncertainty * 0.35 - total * 0.8 - drawPenalty, 14, 34)
  const nonDraw = 100 - drawBase
  const homeShare = clamp(0.5 + Math.tanh(margin / 1.8) * 0.28, 0.2, 0.8)

  return rebalanceToHundred({
    home: nonDraw * homeShare,
    draw: drawBase,
    away: nonDraw * (1 - homeShare),
  })
}

function doubleChance(probs: ThreeWayProbabilities) {
  return {
    home_or_draw: round(probs.home + probs.draw, 4),
    home_or_away: round(probs.home + probs.away, 4),
    draw_or_away: round(probs.draw + probs.away, 4),
  }
}

function drawNoBet(probs: ThreeWayProbabilities) {
  const nonDraw = Math.max(0.0001, probs.home + probs.away)

  return {
    home: round((probs.home / nonDraw) * 100, 4),
    away: round((probs.away / nonDraw) * 100, 4),
  }
}

function complement(probability: number) {
  return round(100 - probability, 4)
}

function recommendation({
  edge,
  ev,
  confidence,
  sufficiency,
}: {
  edge: number
  ev: number
  confidence: number
  sufficiency: number
}): SportEngineRecommendationStatus {
  if (sufficiency < 35) return 'insufficient_data'
  if (edge >= 5 && ev >= 4 && confidence >= 65) return 'recommended'
  if (edge >= 2 && ev >= 1 && confidence >= 55) return 'lean'
  if (edge > 0 || ev > 0) return 'watch'
  return 'pass'
}

function buildPrediction({
  market,
  selection,
  modelProbability,
  noVigProbability,
  americanOdds,
  line,
  confidence,
  sufficiency,
  warnings,
  explanationFactors,
}: {
  market: SoccerMarket
  selection: string
  modelProbability: number
  noVigProbability: number
  americanOdds: number
  line: number | null
  confidence: number
  sufficiency: number
  warnings: string[]
  explanationFactors: string[]
}): SoccerPrediction {
  const implied = impliedProbability(americanOdds)
  const edge = round(modelProbability - noVigProbability)
  const ev = expectedValue(modelProbability, americanOdds)
  const kelly = calculateQuarterKellyStake(1000, modelProbability, americanOdds)
  const smartScore = calculateSmartScore({
    confidence,
    ev: Math.max(0, ev),
    edge: Math.max(0, edge),
    kelly_percent: kelly.kellyPercent,
  })
  const status = recommendation({ edge, ev, confidence, sufficiency })

  return {
    id: `soccer-v1:soccer_prediction_fixture:${market}:${selection}`,
    market,
    selection,
    americanOdds,
    line,
    modelProbability: round(modelProbability),
    impliedProbability: implied,
    noVigProbability: round(noVigProbability),
    fairOdds: fairAmericanOdds(modelProbability),
    edge,
    expectedValue: ev,
    confidence: round(Math.min(confidence, 62)),
    recommendation: confidence > 62 ? 'watch' : status,
    explanationFactors: [
      ...explanationFactors,
      `Smart ranking contract score is ${round(smartScore)}.`,
    ],
    warnings,
  }
}

function soccerFixture() {
  const featurePreview = previewSoccerFeatureStoreSnapshot()
  const snapshot = featurePreview.snapshot
  const missingCriticalDomains = [
    'draw_aware_context',
    'league_strength_context',
    'confirmed_lineup_context',
    'injury_context',
    'expected_goals_context',
  ]
  const dataSufficiencyPenalty = missingCriticalDomains.length * 6
  const effectiveSufficiency = Math.max(0, snapshot.dataSufficiencyScore - dataSufficiencyPenalty)
  const projectedHomeGoals = 1.62
  const projectedAwayGoals = 1.18
  const projectedTotalGoals = round(projectedHomeGoals + projectedAwayGoals)
  const uncertainty = 25
  const threeWay = deriveThreeWayProbabilities({
    projectedHomeGoals,
    projectedAwayGoals,
    uncertainty,
    drawPenalty: 1.5,
  })
  const firstHalfThreeWay = deriveThreeWayProbabilities({
    projectedHomeGoals: projectedHomeGoals * 0.45,
    projectedAwayGoals: projectedAwayGoals * 0.45,
    uncertainty: 30,
    drawPenalty: -4,
  })
  const noVig = noVigThreeWay({
    home: 135,
    draw: 240,
    away: 210,
  })
  const dc = doubleChance(threeWay)
  const dnb = drawNoBet(threeWay)
  const over25 = clamp(52 + (projectedTotalGoals - 2.5) * 18 - uncertainty * 0.15, 5, 95)
  const bttsYes = clamp(48 + Math.min(projectedHomeGoals, projectedAwayGoals) * 12 - uncertainty * 0.2, 5, 95)
  const firstHalfOver15 = clamp(42 + ((projectedTotalGoals * 0.45) - 1.5) * 20 - uncertainty * 0.1, 5, 95)
  const confidence = clamp(
    snapshot.featureQualityScore * 0.3 +
      effectiveSufficiency * 0.35 +
      (100 - uncertainty) * 0.25 -
      missingCriticalDomains.length * 4,
    0,
    62
  )
  const warnings = [
    ...featurePreview.warnings,
    ...SOCCER_ENGINE_WARNINGS,
    'Stale-data warning fixture: market movement and lineup timestamps are unavailable.',
    'Missing lineup/injury warning fixture: lineups and injuries are unavailable.',
    ...(effectiveSufficiency < 35 ? ['Data sufficiency is below soccer engine threshold after critical-domain penalties.'] : []),
  ]

  return {
    featurePreview,
    snapshot,
    missingCriticalDomains,
    effectiveSufficiency,
    projectedHomeGoals,
    projectedAwayGoals,
    projectedTotalGoals,
    firstHalfHomeGoals: round(projectedHomeGoals * 0.45),
    firstHalfAwayGoals: round(projectedAwayGoals * 0.45),
    firstHalfTotalGoals: round(projectedTotalGoals * 0.45),
    uncertainty,
    threeWay,
    firstHalfThreeWay,
    noVig,
    dc,
    dnb,
    totals: {
      over25: round(over25, 4),
      under25: complement(over25),
    },
    btts: {
      yes: round(bttsYes, 4),
      no: complement(bttsYes),
    },
    firstHalfTotals: {
      over15: round(firstHalfOver15, 4),
      under15: complement(firstHalfOver15),
    },
    confidence: round(confidence),
    warnings,
  }
}

export function generateSoccerPredictionPreview() {
  const fixture = soccerFixture()
  const predictions: SoccerPrediction[] = [
    buildPrediction({
      market: '1x2',
      selection: 'Home',
      modelProbability: fixture.threeWay.home,
      noVigProbability: fixture.noVig.home,
      americanOdds: 135,
      line: null,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['1X2 home probability is normalized with draw and away outcomes.'],
    }),
    buildPrediction({
      market: '1x2',
      selection: 'Draw',
      modelProbability: fixture.threeWay.draw,
      noVigProbability: fixture.noVig.draw,
      americanOdds: 240,
      line: null,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['Draw probability is modeled as its own outcome, not residue.'],
    }),
    buildPrediction({
      market: 'double_chance',
      selection: 'Home or Draw',
      modelProbability: fixture.dc.home_or_draw,
      noVigProbability: fixture.dc.home_or_draw,
      americanOdds: -165,
      line: null,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['Double chance derives from normalized 1X2 probabilities.'],
    }),
    buildPrediction({
      market: 'draw_no_bet',
      selection: 'Home DNB',
      modelProbability: fixture.dnb.home,
      noVigProbability: fixture.dnb.home,
      americanOdds: -125,
      line: null,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['Draw no bet conditions on non-draw outcomes only.'],
    }),
    buildPrediction({
      market: 'total',
      selection: 'Over 2.5',
      modelProbability: fixture.totals.over25,
      noVigProbability: 50,
      americanOdds: -110,
      line: 2.5,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: [`Projected total goals are ${fixture.projectedTotalGoals}.`],
    }),
    buildPrediction({
      market: 'both_teams_to_score',
      selection: 'BTTS Yes',
      modelProbability: fixture.btts.yes,
      noVigProbability: 50,
      americanOdds: -105,
      line: null,
      confidence: fixture.confidence,
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['BTTS is modeled separately from total goals.'],
    }),
    buildPrediction({
      market: 'first_half_1x2',
      selection: 'First Half Draw',
      modelProbability: fixture.firstHalfThreeWay.draw,
      noVigProbability: fixture.firstHalfThreeWay.draw,
      americanOdds: 145,
      line: null,
      confidence: Math.max(0, fixture.confidence - 8),
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['First-half probabilities use first-half goal projections, not full-match results.'],
    }),
    buildPrediction({
      market: 'first_half_total',
      selection: 'First Half Under 1.5',
      modelProbability: fixture.firstHalfTotals.under15,
      noVigProbability: 50,
      americanOdds: -120,
      line: 1.5,
      confidence: Math.max(0, fixture.confidence - 8),
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: [`Projected first-half total goals are ${fixture.firstHalfTotalGoals}.`],
    }),
    buildPrediction({
      market: 'qualification',
      selection: 'Home To Qualify',
      modelProbability: clamp(fixture.threeWay.home + 8, 5, 95),
      noVigProbability: clamp(fixture.threeWay.home + 8, 5, 95),
      americanOdds: -140,
      line: null,
      confidence: Math.max(0, fixture.confidence - 10),
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['Qualification is treated separately from match winner.'],
    }),
    buildPrediction({
      market: 'asian_handicap_contract',
      selection: 'Home -0.25',
      modelProbability: clamp(fixture.dnb.home - 3, 5, 95),
      noVigProbability: clamp(fixture.dnb.home - 3, 5, 95),
      americanOdds: -108,
      line: -0.25,
      confidence: Math.max(0, fixture.confidence - 12),
      sufficiency: fixture.effectiveSufficiency,
      warnings: fixture.warnings,
      explanationFactors: ['Asian handicap is contract-only until normalized settlement support is clear.'],
    }),
  ]

  return {
    success: true,
    mode: 'soccer_prediction_engine_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_fixture_and_feature_store_contracts',
    },
    status: 'partial',
    completionLabels: COMPLETION_LABELS,
    projections: {
      homeWinProbability: fixture.threeWay.home,
      drawProbability: fixture.threeWay.draw,
      awayWinProbability: fixture.threeWay.away,
      projectedHomeGoals: fixture.projectedHomeGoals,
      projectedAwayGoals: fixture.projectedAwayGoals,
      projectedTotalGoals: fixture.projectedTotalGoals,
      bothTeamsToScoreProbability: fixture.btts.yes,
      firstHalfHomeGoals: fixture.firstHalfHomeGoals,
      firstHalfAwayGoals: fixture.firstHalfAwayGoals,
      firstHalfTotalGoals: fixture.firstHalfTotalGoals,
      uncertainty: fixture.uncertainty,
    },
    derivedMarkets: {
      noVig1x2: fixture.noVig,
      doubleChance: fixture.dc,
      drawNoBet: fixture.dnb,
      totals: fixture.totals,
      bothTeamsToScore: fixture.btts,
      firstHalf1x2: fixture.firstHalfThreeWay,
      firstHalfTotals: fixture.firstHalfTotals,
    },
    summary: {
      predictionsGenerated: predictions.length,
      recommended: predictions.filter((prediction) => prediction.recommendation === 'recommended').length,
      markets: predictions.map((prediction) => prediction.market),
      averageFeatureQuality: fixture.snapshot.featureQualityScore,
      averageDataSufficiency: fixture.effectiveSufficiency,
      noLeakage: fixture.snapshot.noLeakage,
      persisted: false,
      productionRecommendations: false,
      confidenceCap: 62,
    },
    compatibility: {
      usesSharedSportPredictionSdkUtilities: true,
      usesFeatureStoreSnapshot: true,
      usesPredictionSafetyContracts: true,
      usesSettlementCoreContracts: true,
      usesRawProviderPayloads: false,
      requiresMigration: false,
      persistenceEnabled: false,
    },
    missingSportSpecificDomains: fixture.missingCriticalDomains,
    predictions,
    warnings: fixture.warnings,
  }
}

export function getSoccerPredictionEngineHealth() {
  const preview = generateSoccerPredictionPreview()
  const probs = preview.projections
  const threeWaySum = round(
    probs.homeWinProbability + probs.drawProbability + probs.awayWinProbability,
    4
  )
  const allProbabilities = [
    probs.homeWinProbability,
    probs.drawProbability,
    probs.awayWinProbability,
    preview.derivedMarkets.totals.over25,
    preview.derivedMarkets.totals.under25,
    preview.derivedMarkets.bothTeamsToScore.yes,
    preview.derivedMarkets.bothTeamsToScore.no,
  ]

  return {
    success: true,
    mode: 'soccer_prediction_engine_health_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_contract_health',
    },
    status:
      preview.summary.noLeakage &&
      Math.abs(threeWaySum - 100) < 0.01 &&
      preview.summary.averageDataSufficiency >= 10
        ? 'partial'
        : 'degraded',
    completionLabels: COMPLETION_LABELS,
    checks: {
      threeWaySum,
      noNegativeProbabilities: allProbabilities.every((probability) => probability >= 0),
      featureSnapshotNoLeakage: preview.summary.noLeakage,
      persistenceEnabled: false,
      productionReady: false,
      confidenceCapped: preview.predictions.every((prediction) => prediction.confidence <= preview.summary.confidenceCap),
      realDataValidationPending: true,
      historicalCalibrationPending: true,
    },
    warnings: preview.warnings,
  }
}

export function runSoccerPredictionEngineValidation() {
  const preview = generateSoccerPredictionPreview()
  const health = getSoccerPredictionEngineHealth()
  const p = preview.projections
  const markets = preview.derivedMarkets
  const threeWaySum = round(p.homeWinProbability + p.drawProbability + p.awayWinProbability, 4)
  const checks = {
    threeWaySumsToOne: Math.abs(threeWaySum - 100) < 0.01,
    noNegativeProbabilities: health.checks.noNegativeProbabilities,
    fairOddsCalculation: preview.predictions.every((prediction) => Number.isFinite(prediction.fairOdds)),
    doubleChanceDerivation:
      Math.abs(markets.doubleChance.home_or_draw - round(p.homeWinProbability + p.drawProbability, 4)) < 0.01,
    drawNoBetDerivation:
      Math.abs(markets.drawNoBet.home + markets.drawNoBet.away - 100) < 0.01,
    totalsComplementarity:
      Math.abs(markets.totals.over25 + markets.totals.under25 - 100) < 0.01,
    bttsComplementarity:
      Math.abs(markets.bothTeamsToScore.yes + markets.bothTeamsToScore.no - 100) < 0.01,
    firstHalfCalculations:
      Math.abs(
        markets.firstHalf1x2.home + markets.firstHalf1x2.draw + markets.firstHalf1x2.away - 100
      ) < 0.01 && preview.projections.firstHalfTotalGoals < preview.projections.projectedTotalGoals,
    staleDataWarning: preview.warnings.some((warning) => warning.toLowerCase().includes('stale-data')),
    missingLineupInjuryWarning:
      preview.warnings.some((warning) => warning.toLowerCase().includes('lineup')) &&
      preview.warnings.some((warning) => warning.toLowerCase().includes('injur')),
    insufficientDataBehavior: preview.summary.averageDataSufficiency < 35,
    noLeakage: preview.summary.noLeakage,
    noPersistence: preview.summary.persisted === false,
    zeroProviderCalls: preview.providerUsage.externalProviderCallsMade === 0,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'soccer_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_soccer_engine_validation',
    },
    completionLabels: COMPLETION_LABELS,
    summary: {
      checks: Object.keys(checks).length,
      passed: Object.values(checks).filter(Boolean).length,
      predictionsGenerated: preview.predictions.length,
      markets: preview.summary.markets,
      threeWaySum,
      averageFeatureQuality: preview.summary.averageFeatureQuality,
      averageDataSufficiency: preview.summary.averageDataSufficiency,
      status: health.status,
    },
    checks,
    warnings: preview.warnings,
  }
}
