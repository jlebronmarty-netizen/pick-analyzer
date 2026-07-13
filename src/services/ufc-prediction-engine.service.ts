import {
  buildSportPrediction,
  getSharedSportPredictionEngineSdk,
  type SportEngineCompletionStatus,
  type SportEnginePrediction,
} from '@/services/sport-prediction-engine-sdk.service'
import { previewUfcFeatureStoreSnapshot } from '@/services/ufc-feature-store-integration.service'

const COMPLETION_LABELS: SportEngineCompletionStatus[] = [
  'ARCHITECTURE_COMPLETE',
  'DETERMINISTIC_VALIDATION_COMPLETE',
  'REAL_DATA_VALIDATION_PENDING',
  'HISTORICAL_CALIBRATION_PENDING',
]

const UFC_ENGINE_WARNINGS = [
  'UFC Prediction Engine V1 is architecture-only and deterministic-fixture validated.',
  'Predictions are not persisted and are not production betting recommendations.',
  'Fighter form, camp, injury, method and weigh-in inputs are unavailable and not fabricated.',
  'Method markets are contract-only until combat-specific settlement rules are implemented.',
  'Real-data validation and historical calibration are pending.',
]

function ufcFeaturePreview() {
  return previewUfcFeatureStoreSnapshot()
}

function withUfcWarnings(prediction: SportEnginePrediction) {
  return {
    ...prediction,
    warnings: [
      ...prediction.warnings,
      ...(ufcFeaturePreview().featureSet?.warnings ?? []),
      ...UFC_ENGINE_WARNINGS,
    ],
  }
}

export function generateUfcPredictionPreview() {
  const featurePreview = ufcFeaturePreview()
  const featureSnapshot = featurePreview.snapshot
  const base = {
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    eventId: 'ufc_prediction_fixture',
    selection: 'Fixture Fighter A',
    opponent: 'Fixture Fighter B',
    sportsbook: 'Fixture Book',
    bankroll: 1000,
    generatedAt: '2026-08-01T12:00:00.000Z',
    cutoffAt: '2026-08-01T12:00:00.000Z',
    eventStartTime: '2026-08-02T02:00:00.000Z',
    featureSnapshot,
  }

  const predictions = [
    buildSportPrediction({
      ...base,
      market: 'moneyline',
      americanOdds: -120,
      line: null,
      projection: {
        selectionScore: 1.0,
        opponentScore: 0.72,
        total: 1.72,
        margin: 0.28,
        uncertainty: 24,
      },
    }),
    buildSportPrediction({
      ...base,
      market: 'method_contract',
      selection: 'Fixture Fighter A by decision',
      opponent: 'Any other result',
      americanOdds: +240,
      line: null,
      projection: {
        selectionScore: 0.36,
        opponentScore: 0.64,
        total: 1,
        margin: -0.28,
        uncertainty: 30,
      },
    }),
  ].map(withUfcWarnings)

  const methodContracts = predictions.filter(
    (prediction) => prediction.market === 'method_contract'
  )

  return {
    success: true,
    mode: 'ufc_prediction_engine_preview_v1',
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
      contractOnlyMarkets: methodContracts.length,
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
      settlementCompatible: predictions
        .filter((prediction) => prediction.market !== 'method_contract')
        .every((prediction) => prediction.contracts.settlementCompatible),
      methodContractsSettlementCompatible: false,
    },
    missingSportSpecificDomains: featurePreview.warnings.filter((warning) =>
      warning.toLowerCase().includes('fighter') ||
      warning.toLowerCase().includes('camp') ||
      warning.toLowerCase().includes('injury') ||
      warning.toLowerCase().includes('method') ||
      warning.toLowerCase().includes('weigh')
    ),
    predictions,
    warnings: [
      ...featurePreview.warnings,
      ...UFC_ENGINE_WARNINGS,
    ],
  }
}

export function getUfcPredictionEngineHealth() {
  const sdk = getSharedSportPredictionEngineSdk()
  const preview = generateUfcPredictionPreview()
  const supportedMarkets = new Set(
    sdk.markets
      .filter((market) => market.supported)
      .map((market) => String(market.market))
  )
  const unsupportedPreviewMarkets = preview.predictions.filter(
    (prediction) =>
      !supportedMarkets.has(prediction.market) &&
      prediction.market !== 'method_contract'
  )

  return {
    success: true,
    mode: 'ufc_prediction_engine_health_v1',
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
      methodContractsExplicit: preview.summary.contractOnlyMarkets > 0,
      persistenceEnabled: false,
      productionReady: false,
      realDataValidationPending: true,
      historicalCalibrationPending: true,
    },
    warnings: preview.warnings,
  }
}

export function runUfcPredictionEngineValidation() {
  const preview = generateUfcPredictionPreview()
  const health = getUfcPredictionEngineHealth()
  const methodContracts = preview.predictions.filter(
    (prediction) => prediction.market === 'method_contract'
  )
  const checks = {
    generatedPreviewPredictions: preview.predictions.length === 2,
    zeroProviderCalls:
      preview.providerUsage.externalProviderCallsMade === 0 &&
      health.providerUsage.externalProviderCallsMade === 0,
    noLeakage: preview.summary.noLeakage,
    noPersistence: preview.compatibility.persistenceEnabled === false,
    noRawProviderPayloads: preview.compatibility.usesRawProviderPayloads === false,
    sdkCompatible: preview.compatibility.usesSharedSportPredictionSdk,
    moneylineSettlementCompatible: preview.compatibility.settlementCompatible,
    methodContractsExplicitlyNotSettlementCompatible:
      methodContracts.length === 1 &&
      methodContracts.every((prediction) => !prediction.contracts.settlementCompatible),
    realDataPending: health.checks.realDataValidationPending,
    historicalCalibrationPending: health.checks.historicalCalibrationPending,
  }

  return {
    success: Object.values(checks).every(Boolean),
    mode: 'ufc_prediction_engine_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_ufc_engine_validation',
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
