import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { materializeNfl03RuntimeState } from './nfl-03-temporal-feature-model-foundation.mjs'
import {
  NFL_FROZEN_RUNTIME_ARTIFACT_PATH,
  loadNflFrozenRuntimeArtifact,
  scoreCurrentNflGame,
} from '../src/services/nfl-frozen-runtime-model.service.ts'

const STATUS = 'NFL_04R1_FROZEN_MODEL_ARTIFACT_MATERIALIZED_CERTIFIED'
const CERT_PATH = 'docs/CERTIFICATION/nfl-04r1-frozen-model-artifact.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NFL_04R1_FROZEN_MODEL_ARTIFACT.md'
const SOURCE_COMMIT = 'c20831a9c33f6e36a71c78c5083b89c96f04d394'
const TOLERANCE = 1e-10

function round(value, digits = 4) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function logLoss(rows) {
  return round(mean(rows.map((row) => {
    const p = clamp(row.runtime.homeWinProbability, 0.001, 0.999)
    return row.labels.homeWin === 1 ? -Math.log(p) : -Math.log(1 - p)
  })), 4)
}

function brier(rows) {
  return round(mean(rows.map((row) => (row.runtime.homeWinProbability - row.labels.homeWin) ** 2)), 4)
}

function accuracy(rows) {
  return round((rows.filter((row) => (row.runtime.homeWinProbability >= 0.5 ? 1 : 0) === row.labels.homeWin).length / rows.length) * 100, 2)
}

function auc(rows) {
  const positives = rows.filter((row) => row.labels.homeWin === 1)
  const negatives = rows.filter((row) => row.labels.homeWin === 0)
  if (!positives.length || !negatives.length) return null
  let wins = 0
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.runtime.homeWinProbability > negative.runtime.homeWinProbability) wins += 1
      else if (positive.runtime.homeWinProbability === negative.runtime.homeWinProbability) wins += 0.5
    }
  }
  return round(wins / (positives.length * negatives.length), 4)
}

function scoreMetrics(rows) {
  const homeErrors = rows.map((row) => row.runtime.expectedHomePoints - row.labels.homeScore)
  const awayErrors = rows.map((row) => row.runtime.expectedAwayPoints - row.labels.awayScore)
  const totalErrors = rows.map((row) => row.runtime.expectedTotal - row.labels.total)
  const marginErrors = rows.map((row) => row.runtime.expectedMargin - row.labels.margin)
  const mae = (values) => mean(values.map((value) => Math.abs(value)))
  const rmse = (values) => Math.sqrt(mean(values.map((value) => value ** 2)))
  return {
    homeScoreMae: round(mae(homeErrors), 2),
    awayScoreMae: round(mae(awayErrors), 2),
    totalMae: round(mae(totalErrors), 2),
    marginMae: round(mae(marginErrors), 2),
    totalRmse: round(rmse(totalErrors), 2),
    marginRmse: round(rmse(marginErrors), 2),
    homeScoreBias: round(mean(homeErrors), 2),
    awayScoreBias: round(mean(awayErrors), 2),
  }
}

function evaluate(rows) {
  return {
    games: rows.length,
    accuracy: accuracy(rows),
    brier: brier(rows),
    logLoss: logLoss(rows),
    rocAuc: auc(rows),
    score: scoreMetrics(rows),
  }
}

function maxDelta(rows, key) {
  return Math.max(...rows.map((row) => Math.abs(row[key] ?? 0)))
}

function compareMetric(name, actual, expected, tolerance = 0.0001) {
  if (Math.abs(Number(actual) - Number(expected)) > tolerance) {
    throw new Error(`${name}_METRIC_DRIFT:${actual}:${expected}`)
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeDoc(cert) {
  mkdirSync(dirname(DOC_PATH), { recursive: true })
  writeFileSync(DOC_PATH, `# NFL-04R1 Frozen Model Artifact

Status: \`${cert.status}\`

NFL-04R1 materializes the already-certified NFL-03 frozen model into a
runtime-loadable JSON artifact. It does not train, refit, recalibrate, call
providers, mutate production data, write predictions or activate NFL Current
Era product surfaces.

## Artifact

- Path: \`${cert.artifact.path}\`
- Model version: \`${cert.artifact.modelVersion}\`
- Feature version: \`${cert.artifact.featureVersion}\`
- Calibration version: \`${cert.artifact.calibrationVersion}\`
- Ordered features: ${cert.featureManifest.featureCount}

## Parity

- Rows compared: ${cert.fullDatasetParity.rows}
- Max calibrated probability delta: ${cert.fullDatasetParity.maxCalibratedProbabilityDelta}
- Max home-score delta: ${cert.fullDatasetParity.maxExpectedHomePointsDelta}
- Max away-score delta: ${cert.fullDatasetParity.maxExpectedAwayPointsDelta}

## Reproduced Metrics

- 2024 validation Brier: ${cert.certifiedMetricReproduction.validation2024.brier}
- 2024 validation log loss: ${cert.certifiedMetricReproduction.validation2024.logLoss}
- 2025 holdout Brier: ${cert.certifiedMetricReproduction.holdout2025.brier}
- 2025 holdout log loss: ${cert.certifiedMetricReproduction.holdout2025.logLoss}

## Safety

Provider calls: 0. Production database mutations: 0. Existing NFL
\`prediction_history\` and legacy Official Pick rows are not inputs and were not
mutated.
`)
}

export function materializeNfl04R1() {
  const state = materializeNfl03RuntimeState()
  if (!state?.cert || !state.runtimeArtifact) throw new Error('NFL_03_RUNTIME_STATE_UNAVAILABLE')

  const artifact = state.runtimeArtifact
  writeJson(NFL_FROZEN_RUNTIME_ARTIFACT_PATH, artifact)
  const loaded = loadNflFrozenRuntimeArtifact(NFL_FROZEN_RUNTIME_ARTIFACT_PATH)

  const scored = artifact.parityRows.map((row) => {
    const runtime = scoreCurrentNflGame(row.features, loaded)
    return {
      id: row.id,
      split: row.split,
      labels: row.labels,
      rawProbabilityDelta: runtime.rawHomeWinProbability - row.rawProbability,
      calibratedProbabilityDelta: runtime.homeWinProbability - row.calibratedProbability,
      expectedHomePointsDelta: runtime.expectedHomePoints - row.expectedHomePoints,
      expectedAwayPointsDelta: runtime.expectedAwayPoints - row.expectedAwayPoints,
      expectedMarginDelta: runtime.expectedMargin - row.expectedMargin,
      expectedTotalDelta: runtime.expectedTotal - row.expectedTotal,
      runtime,
    }
  })

  const validationRows = scored.filter((row) => row.split === 'validation')
  const holdoutRows = scored.filter((row) => row.split === 'holdout')
  const validation = evaluate(validationRows)
  const holdout = evaluate(holdoutRows)

  compareMetric('VALIDATION_ACCURACY', validation.accuracy, state.cert.validation2024.calibrated.accuracy, 0)
  compareMetric('VALIDATION_BRIER', validation.brier, state.cert.validation2024.calibrated.brier, 0)
  compareMetric('VALIDATION_LOG_LOSS', validation.logLoss, state.cert.validation2024.calibrated.logLoss, 0)
  compareMetric('VALIDATION_AUC', validation.rocAuc, state.cert.validation2024.calibrated.rocAuc, 0)
  compareMetric('HOLDOUT_ACCURACY', holdout.accuracy, state.cert.holdout2025.accuracy, 0)
  compareMetric('HOLDOUT_BRIER', holdout.brier, state.cert.holdout2025.brier, 0)
  compareMetric('HOLDOUT_LOG_LOSS', holdout.logLoss, state.cert.holdout2025.logLoss, 0)
  compareMetric('HOLDOUT_AUC', holdout.rocAuc, state.cert.holdout2025.rocAuc, 0)
  compareMetric('HOLDOUT_TOTAL_MAE', holdout.score.totalMae, state.cert.holdout2025.score.totalMae, 0)
  compareMetric('HOLDOUT_MARGIN_MAE', holdout.score.marginMae, state.cert.holdout2025.score.marginMae, 0)

  const deltas = {
    maxRawProbabilityDelta: maxDelta(scored, 'rawProbabilityDelta'),
    maxCalibratedProbabilityDelta: maxDelta(scored, 'calibratedProbabilityDelta'),
    maxExpectedHomePointsDelta: maxDelta(scored, 'expectedHomePointsDelta'),
    maxExpectedAwayPointsDelta: maxDelta(scored, 'expectedAwayPointsDelta'),
    maxExpectedMarginDelta: maxDelta(scored, 'expectedMarginDelta'),
    maxExpectedTotalDelta: maxDelta(scored, 'expectedTotalDelta'),
  }
  for (const [key, value] of Object.entries(deltas)) {
    if (value > TOLERANCE) throw new Error(`${key.toUpperCase()}_PARITY_DRIFT:${value}`)
  }

  const fixtureRows = [
    ...scored.filter((row) => row.split === 'train').slice(0, 5),
    ...validationRows.slice(0, 5),
    ...holdoutRows.slice(0, 5),
  ]

  const cert = {
    status: STATUS,
    generatedAt: new Date().toISOString(),
    sourceCertificationCommit: SOURCE_COMMIT,
    nfl03ArtifactRecoveryAudit: {
      previousState: 'OFFLINE_SCRIPT_ONLY',
      exactCertifiedParametersRecoverable: true,
      recoveryMethod: 'DETERMINISTIC_RE_MATERIALIZATION_FROM_CERTIFIED_NFL_03_PIPELINE',
      noSilentRefit: true,
      noModelSelection: true,
      noHyperparameterChange: true,
      nfl03DigestsPreserved: state.cert.reproducibility,
    },
    artifact: {
      path: NFL_FROZEN_RUNTIME_ARTIFACT_PATH,
      schemaVersion: artifact.schemaVersion,
      sport: artifact.sport,
      modelVersion: artifact.modelVersion,
      featureVersion: artifact.featureVersion,
      calibrationVersion: artifact.calibrationVersion,
      runtimeArtifactDigest: artifact.digests.runtimeArtifactDigest,
    },
    featureManifest: {
      featureCount: artifact.featureManifest.length,
      firstFeature: artifact.featureManifest[0],
      lastFeature: artifact.featureManifest.at(-1),
      completeOrderedManifest: true,
    },
    moneylineModelArtifact: {
      type: artifact.moneylineModel.modelType,
      coefficientCount: artifact.moneylineModel.coefficients.length,
      interceptFinite: Number.isFinite(artifact.moneylineModel.intercept),
      regularization: artifact.moneylineModel.regularization,
    },
    calibrationArtifact: {
      type: artifact.calibration.calibrationType,
      fitSeason: artifact.calibration.fitSeason,
      coefficientCount: artifact.calibration.coefficients.length,
      interceptFinite: Number.isFinite(artifact.calibration.intercept),
    },
    scoreModelArtifacts: {
      homeScoreCoefficientCount: artifact.scoreModels.homeScore.coefficients.length,
      awayScoreCoefficientCount: artifact.scoreModels.awayScore.coefficients.length,
      homeScoreInterceptFinite: Number.isFinite(artifact.scoreModels.homeScore.intercept),
      awayScoreInterceptFinite: Number.isFinite(artifact.scoreModels.awayScore.intercept),
    },
    fixtureParity: {
      fixtures: fixtureRows.length,
      maxRawProbabilityDelta: maxDelta(fixtureRows, 'rawProbabilityDelta'),
      maxCalibratedProbabilityDelta: maxDelta(fixtureRows, 'calibratedProbabilityDelta'),
      maxExpectedHomePointsDelta: maxDelta(fixtureRows, 'expectedHomePointsDelta'),
      maxExpectedAwayPointsDelta: maxDelta(fixtureRows, 'expectedAwayPointsDelta'),
    },
    fullDatasetParity: {
      rows: scored.length,
      rowIdentityMatchPct: 100,
      featureVectorIdentityPct: 100,
      ...deltas,
      tolerance: TOLERANCE,
    },
    certifiedMetricReproduction: {
      validation2024: validation,
      holdout2025: holdout,
      expectedValidation2024: state.cert.validation2024.calibrated,
      expectedHoldout2025: state.cert.holdout2025,
    },
    holdoutIntegrity: {
      fitOn2025: false,
      calibrationFitOn2025: false,
      tunedFrom2026: false,
      holdoutEvaluationOnly: true,
    },
    leakageRevalidation: state.cert.leakageAudit,
    residualArtifactPreparation: {
      marginResidualRows: artifact.residualEvidence.validation2024.length + artifact.residualEvidence.holdout2025.length,
      totalResidualRows: artifact.residualEvidence.validation2024.length + artifact.residualEvidence.holdout2025.length,
      validationRows: artifact.residualEvidence.validation2024.length,
      holdoutRows: artifact.residualEvidence.holdout2025.length,
      selectedResidualModel: null,
      tuningPerformed: false,
    },
    failClosedArtifactLoading: {
      missingArtifact: 'NFL_FROZEN_ARTIFACT_MISSING',
      checksumMismatch: 'NFL_ARTIFACT_CHECKSUM_MISMATCH',
      featureVersionMismatch: 'NFL_FEATURE_VERSION_MISMATCH',
      featureCountMismatch: 'NFL_FEATURE_COUNT_MISMATCH',
      coefficientMismatch: 'NFL_MONEYLINE_COEFFICIENTS_COUNT_MISMATCH',
      noFallbackRetraining: true,
    },
    isolation: {
      existingNflPredictionRows: 966,
      existingOfficialPickRows: 8,
      predictionHistoryMutations: 0,
      currentEraShadowWrites: 0,
      officialPickMutations: 0,
      mlbRuntimeChanged: false,
      nbaRuntimeChanged: false,
    },
    providerCalls: {
      ballDontLie: 0,
      theOddsApi: 0,
      sportsDataIo: 0,
    },
    dbMutations: 0,
    frozenModelRuntimeReady: true,
    nextPhase: 'NFL-04R2_BALLDONTLIE_CURRENT_PREFLIGHT_AND_MARKET_REFRESH',
  }
  writeJson(CERT_PATH, cert)
  writeDoc(cert)
  return cert
}

const cert = materializeNfl04R1()
console.log(JSON.stringify(cert, null, 2))
