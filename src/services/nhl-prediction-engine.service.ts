import {
  buildSportPrediction,
  getSharedSportPredictionEngineSdk,
  type SportEngineCompletionStatus,
  type SportEnginePrediction,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewNhlFeatureStoreSnapshot } from '@/services/nhl-feature-store-integration.service'

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const NHL_ENGINE_WARNINGS = [
  'NHL Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Starting goalie, goalie form, injury impact, special-teams and rest/travel inputs are unavailable and not fabricated.',
  'Real-data validation and historical calibration are pending.',
]

function nhlFeaturePreview() {
  return previewNhlFeatureStoreSnapshot()
}

function withNhlWarnings(prediction: SportEnginePrediction) {
  return {
    ...prediction,
    warnings: [
      ...prediction.warnings,
      ...(nhlFeaturePreview().featureSet?.warnings ?? []),
      ...NHL_ENGINE_WARNINGS,
    ],
  }
}

export function generateNhlPredictionPreview() {
  const featurePreview = nhlFeaturePreview()
  const featureSnapshot = featurePreview.snapshot
  const base = {
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    eventId: 'nhl_prediction_fixture',
    selection: 'Fixture Home',
    opponent: 'Fixture Away',
    sportsbook: 'Fixture Book',
    bankroll: 1000,
    generatedAt: '2026-02-01T17:00:00.000Z',
    cutoffAt: '2026-02-01T17:00:00.000Z',
    eventStartTime: '2026-02-02T00:00:00.000Z',
    featureSnapshot,
  }

  const predictions = [
    buildSportPrediction({
      ...base,
      market: 'moneyline',
      americanOdds: -115,
      line: null,
      projection: {
        selectionScore: 3.4,
        opponentScore: 2.9,
        total: 6.3,
        margin: 0.5,
        uncertainty: 20,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'spread',
      americanOdds: +145,
      line: -1.5,
      projection: {
        selectionScore: 3.4,
        opponentScore: 2.9,
        total: 6.3,
        margin: 0.5,
        uncertainty: 23,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'total',
      selection: 'Over',
      opponent: 'Under',
      americanOdds: -110,
      line: 6,
      projection: {
        selectionScore: 3.4,
        opponentScore: 2.9,
        total: 6.3,
        margin: 0.3,
        uncertainty: 21,
      },
    }),
  ].map(withNhlWarnings)

  return {
    success: true,
    mode: 'nhl_prediction_engine_preview_v1',
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
      warning.toLowerCase().includes('goalie') ||
      warning.toLowerCase().includes('injury') ||
      warning.toLowerCase().includes('rest') ||
      warning.toLowerCase().includes('special-teams') ||
      warning.toLowerCase().includes('special teams')
    ),
    predictions,
    warnings: [
      ...featurePreview.warnings,
      ...NHL_ENGINE_WARNINGS,
    ],
  }
}

export function getNhlPredictionEngineHealth() {
  const sdk = getSharedSportPredictionEngineSdk()
  const preview = generateNhlPredictionPreview()
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
    mode: 'nhl_prediction_engine_health_v1',
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

export function runNhlPredictionEngineValidation() {
  const preview = generateNhlPredictionPreview()
  const health = getNhlPredictionEngineHealth()
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
    mode: 'nhl_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_nhl_engine_validation',
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
