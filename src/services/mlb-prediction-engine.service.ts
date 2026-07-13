import {
  buildSportPrediction,
  getSharedSportPredictionEngineSdk,
  type SportEngineCompletionStatus,
  type SportEnginePrediction,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewMlbFeatureStoreSnapshot } from '@/services/mlb-feature-store-integration.service'

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const MLB_ENGINE_WARNINGS = [
  'MLB Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Probable pitcher, confirmed lineup, weather, park-factor and advanced-stat inputs are unavailable and not fabricated.',
  'Real-data validation and historical calibration are pending.',
]

function mlbFeaturePreview() {
  return previewMlbFeatureStoreSnapshot()
}

function withMlbWarnings(prediction: SportEnginePrediction) {
  return {
    ...prediction,
    warnings: [
      ...prediction.warnings,
      ...(mlbFeaturePreview().featureSet?.warnings ?? []),
      ...MLB_ENGINE_WARNINGS,
    ],
  }
}

export function generateMlbPredictionPreview() {
  const featurePreview = mlbFeaturePreview()
  const featureSnapshot = featurePreview.snapshot
  const base = {
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    eventId: 'mlb_prediction_fixture',
    selection: 'Fixture Home',
    opponent: 'Fixture Away',
    sportsbook: 'Fixture Book',
    bankroll: 1000,
    generatedAt: '2026-06-01T16:00:00.000Z',
    cutoffAt: '2026-06-01T16:00:00.000Z',
    eventStartTime: '2026-06-01T23:00:00.000Z',
    featureSnapshot,
  }

  const predictions = [
    buildSportPrediction({
      ...base,
      market: 'moneyline',
      americanOdds: -118,
      line: null,
      projection: {
        selectionScore: 4.7,
        opponentScore: 4.1,
        total: 8.8,
        margin: 0.6,
        uncertainty: 18,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'spread',
      americanOdds: -105,
      line: -1.5,
      projection: {
        selectionScore: 4.7,
        opponentScore: 4.1,
        total: 8.8,
        margin: 0.6,
        uncertainty: 20,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'total',
      selection: 'Over',
      opponent: 'Under',
      americanOdds: -110,
      line: 8.5,
      projection: {
        selectionScore: 4.7,
        opponentScore: 4.1,
        total: 8.8,
        margin: 0.3,
        uncertainty: 19,
      },
    }),
  ].map(withMlbWarnings)

  return {
    success: true,
    mode: 'mlb_prediction_engine_preview_v1',
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
      warning.toLowerCase().includes('pitcher') ||
      warning.toLowerCase().includes('lineup') ||
      warning.toLowerCase().includes('weather') ||
      warning.toLowerCase().includes('ballpark')
    ),
    predictions,
    warnings: [
      ...featurePreview.warnings,
      ...MLB_ENGINE_WARNINGS,
    ],
  }
}

export function getMlbPredictionEngineHealth() {
  const sdk = getSharedSportPredictionEngineSdk()
  const preview = generateMlbPredictionPreview()
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
    mode: 'mlb_prediction_engine_health_v1',
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

export function runMlbPredictionEngineValidation() {
  const preview = generateMlbPredictionPreview()
  const health = getMlbPredictionEngineHealth()
  const checks = {
    generatedPreviewPredictions: preview.predictions.length === 3,
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
    mode: 'mlb_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_mlb_engine_validation',
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
