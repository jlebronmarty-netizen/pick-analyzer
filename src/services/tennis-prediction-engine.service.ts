import {
  buildSportPrediction,
  getSharedSportPredictionEngineSdk,
  type SportEngineCompletionStatus,
  type SportEnginePrediction,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewTennisFeatureStoreSnapshot } from '@/services/tennis-feature-store-integration.service'

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const TENNIS_ENGINE_WARNINGS = [
  'Tennis Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Player form, surface, ranking and injury inputs are unavailable and not fabricated.',
  'Real-data validation and historical calibration are pending.',
]

function tennisFeaturePreview() {
  return previewTennisFeatureStoreSnapshot()
}

function withTennisWarnings(prediction: SportEnginePrediction) {
  return {
    ...prediction,
    warnings: [
      ...prediction.warnings,
      ...(tennisFeaturePreview().featureSet?.warnings ?? []),
      ...TENNIS_ENGINE_WARNINGS,
    ],
  }
}

export function generateTennisPredictionPreview() {
  const featurePreview = tennisFeaturePreview()
  const featureSnapshot = featurePreview.snapshot
  const base = {
    sportKey: 'tennis',
    leagueKey: null,
    eventId: 'tennis_prediction_fixture',
    selection: 'Fixture Player A',
    opponent: 'Fixture Player B',
    sportsbook: 'Fixture Book',
    bankroll: 1000,
    generatedAt: '2026-07-01T12:00:00.000Z',
    cutoffAt: '2026-07-01T12:00:00.000Z',
    eventStartTime: '2026-07-01T15:00:00.000Z',
    featureSnapshot,
  }

  const predictions = [
    buildSportPrediction({
      ...base,
      market: 'moneyline',
      americanOdds: -130,
      line: null,
      projection: {
        selectionScore: 2.05,
        opponentScore: 1.62,
        total: 3.67,
        margin: 0.43,
        uncertainty: 22,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'total',
      selection: 'Over',
      opponent: 'Under',
      americanOdds: -108,
      line: 22.5,
      projection: {
        selectionScore: 12.1,
        opponentScore: 11.2,
        total: 23.3,
        margin: 0.8,
        uncertainty: 24,
      },
    }),
  ].map(withTennisWarnings)

  return {
    success: true,
    mode: 'tennis_prediction_engine_preview_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_fixture_and_feature_store_contracts',
    },
    status: 'partial',
    completionLabels: COMPLETION_LABELS,
    summary: {
      predictionsGenerated: predictions.length,
      recommended: predictions.filter((prediction) => prediction.recommendation === 'recommended').length,
      markets: predictions.map((prediction) => prediction.market),
      averageFeatureQuality: featureSnapshot.featureQualityScore,
      averageDataSufficiency: featureSnapshot.dataSufficiencyScore,
      noLeakage: featureSnapshot.noLeakage,
      persisted: false,
      productionRecommendations: false,
    },
    compatibility: {
      usesSharedSportPredictionSdk: true,
      usesFeatureStoreSnapshot: true,
      usesRawProviderPayloads: false,
      requiresMigration: false,
      persistenceEnabled: false,
      settlementCompatible: predictions.every((prediction) => prediction.contracts.settlementCompatible),
    },
    missingSportSpecificDomains: featurePreview.warnings.filter((warning) =>
      warning.toLowerCase().includes('player') ||
      warning.toLowerCase().includes('surface') ||
      warning.toLowerCase().includes('ranking') ||
      warning.toLowerCase().includes('injury')
    ),
    predictions,
    warnings: [
      ...featurePreview.warnings,
      ...TENNIS_ENGINE_WARNINGS,
    ],
  }
}

export function getTennisPredictionEngineHealth() {
  const sdk = getSharedSportPredictionEngineSdk()
  const preview = generateTennisPredictionPreview()
  const supportedMarkets = new Set(
    sdk.markets
      .filter((market) => market.supported)
      .map((market) => String(market.market))
  )
  const unsupportedPreviewMarkets = preview.predictions.filter(
    (prediction) => !supportedMarkets.has(prediction.market)
  )

  return {
    success: true,
    mode: 'tennis_prediction_engine_health_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_contract_health',
    },
    status:
      preview.summary.noLeakage &&
      unsupportedPreviewMarkets.length === 0 &&
      preview.summary.averageDataSufficiency >= 35
        ? 'partial'
        : 'degraded',
    completionLabels: COMPLETION_LABELS,
    checks: {
      sharedSdkReady: sdk.status === 'ready',
      featureSnapshotNoLeakage: preview.summary.noLeakage,
      supportedMarkets: preview.summary.markets.length - unsupportedPreviewMarkets.length,
      unsupportedPreviewMarkets: unsupportedPreviewMarkets.length,
      persistenceEnabled: false,
      productionReady: false,
      realDataValidationPending: true,
      historicalCalibrationPending: true,
    },
    warnings: preview.warnings,
  }
}

export function runTennisPredictionEngineValidation() {
  const preview = generateTennisPredictionPreview()
  const health = getTennisPredictionEngineHealth()
  const checks = {
    generatedPreviewPredictions: preview.predictions.length === 2,
    zeroProviderCalls:
      preview.providerUsage.externalProviderCallsMade === 0 &&
      health.providerUsage.externalProviderCallsMade === 0,
    noLeakage: preview.summary.noLeakage,
    noPersistence: preview.compatibility.persistenceEnabled === false,
    noRawProviderPayloads: preview.compatibility.usesRawProviderPayloads === false,
    sdkCompatible: preview.compatibility.usesSharedSportPredictionSdk,
    settlementCompatible: preview.compatibility.settlementCompatible,
    realDataPending: health.checks.realDataValidationPending,
    historicalCalibrationPending: health.checks.historicalCalibrationPending,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'tennis_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_tennis_engine_validation',
    },
    completionLabels: COMPLETION_LABELS,
    summary: {
      checks: Object.keys(checks).length,
      passed: Object.values(checks).filter(Boolean).length,
      predictionsGenerated: preview.predictions.length,
      markets: preview.summary.markets,
      averageFeatureQuality: preview.summary.averageFeatureQuality,
      averageDataSufficiency: preview.summary.averageDataSufficiency,
      status: health.status,
    },
    checks,
    warnings: preview.warnings,
  }
}
