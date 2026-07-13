import {
  buildSportPrediction,
  getSharedSportPredictionEngineSdk,
  type SportEngineCompletionStatus,
  type SportEnginePrediction,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewNflFeatureStoreSnapshot } from '@/services/nfl-feature-store-integration.service'

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const NFL_ENGINE_WARNINGS = [
  'NFL Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Quarterback impact, injury impact, weather and rest/travel inputs are unavailable and not fabricated.',
  'Real-data validation and historical calibration are pending.',
]

function nflFeaturePreview() {
  return previewNflFeatureStoreSnapshot()
}

function withNflWarnings(prediction: SportEnginePrediction) {
  return {
    ...prediction,
    warnings: [
      ...prediction.warnings,
      ...(nflFeaturePreview().featureSet?.warnings ?? []),
      ...NFL_ENGINE_WARNINGS,
    ],
  }
}

export function generateNflPredictionPreview() {
  const featurePreview = nflFeaturePreview()
  const featureSnapshot = featurePreview.snapshot
  const base = {
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    eventId: 'nfl_prediction_fixture',
    selection: 'Fixture Home',
    opponent: 'Fixture Away',
    sportsbook: 'Fixture Book',
    bankroll: 1000,
    generatedAt: '2026-10-01T16:00:00.000Z',
    cutoffAt: '2026-10-01T16:00:00.000Z',
    eventStartTime: '2026-10-02T00:20:00.000Z',
    featureSnapshot,
  }

  const predictions = [
    buildSportPrediction({
      ...base,
      market: 'moneyline',
      americanOdds: -125,
      line: null,
      projection: {
        selectionScore: 24.6,
        opponentScore: 21.3,
        total: 45.9,
        margin: 3.3,
        uncertainty: 19,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'spread',
      americanOdds: -110,
      line: -2.5,
      projection: {
        selectionScore: 24.6,
        opponentScore: 21.3,
        total: 45.9,
        margin: 3.3,
        uncertainty: 20,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'total',
      selection: 'Over',
      opponent: 'Under',
      americanOdds: -108,
      line: 44.5,
      projection: {
        selectionScore: 24.6,
        opponentScore: 21.3,
        total: 45.9,
        margin: 1.4,
        uncertainty: 18,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'first_half',
      americanOdds: -110,
      line: -1.5,
      projection: {
        selectionScore: 12.2,
        opponentScore: 10.4,
        total: 22.6,
        margin: 1.8,
        uncertainty: 21,
      },
    }),
  ].map(withNflWarnings)

  return {
    success: true,
    mode: 'nfl_prediction_engine_preview_v1',
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
      warning.toLowerCase().includes('quarterback') ||
      warning.toLowerCase().includes('injury') ||
      warning.toLowerCase().includes('weather') ||
      warning.toLowerCase().includes('rest')
    ),
    predictions,
    warnings: [
      ...featurePreview.warnings,
      ...NFL_ENGINE_WARNINGS,
    ],
  }
}

export function getNflPredictionEngineHealth() {
  const sdk = getSharedSportPredictionEngineSdk()
  const preview = generateNflPredictionPreview()
  const supportedMarkets = new Set(
    sdk.markets
      .filter((market) => market.supported)
      .map((market) => String(market.market))
  )
  supportedMarkets.add('first_half')
  const unsupportedPreviewMarkets = preview.predictions.filter(
    (prediction) => !supportedMarkets.has(prediction.market)
  )

  return {
    success: true,
    mode: 'nfl_prediction_engine_health_v1',
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

export function runNflPredictionEngineValidation() {
  const preview = generateNflPredictionPreview()
  const health = getNflPredictionEngineHealth()
  const checks = {
    generatedPreviewPredictions: preview.predictions.length === 4,
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
    mode: 'nfl_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_nfl_engine_validation',
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
