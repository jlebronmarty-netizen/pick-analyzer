import fs from 'node:fs'

const coverage = JSON.parse(fs.readFileSync('docs/DATA_COVERAGE_FORECAST.json', 'utf8'))
const forecast = JSON.parse(fs.readFileSync('docs/TRAINING_FORECAST.json', 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(coverage.success === true, 'coverage forecast must succeed')
assert(forecast.success === true, 'training forecast must succeed')
assert(coverage.readOnly === true && forecast.readOnly === true, 'forecasts must be read-only')
assert(coverage.providerCallsMade === 0 && forecast.providerCallsMade === 0, 'provider calls must remain zero')
assert(coverage.databaseMutations === 0 && forecast.databaseMutations === 0, 'database mutations must remain zero')
assert(coverage.productionMutations === 0 && forecast.productionMutations === 0, 'production mutations must remain zero')
assert(coverage.noTrainingExecuted === true && forecast.noTrainingExecuted === true, 'training must not execute')
assert(coverage.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(coverage.epochMutations === 0, 'epochs must remain unchanged')
assert(coverage.currentSamples === 354, 'current samples must remain 354')
assert(coverage.recoverableSamples === 596, 'recoverable samples must be 596')
assert(coverage.partiallyRecoverableSamples === 1636, 'partial recoverable samples must be 1636')
assert(coverage.permanentlyRejectedSamples === 9, 'permanent rejects must be 9')
assert(coverage.unknownSamples === 0, 'unknown recoverability must be 0')
assert(coverage.exactCategoryCounts.trainingReady === 354, 'training-ready category mismatch')
assert(coverage.exactCategoryCounts.missingCanonicalResult === 1530, 'missing result category mismatch')
assert(coverage.exactCategoryCounts.missingFeatureSnapshot === 904, 'missing feature category mismatch')
assert(coverage.exactCategoryCounts.missingModelVersion === 904, 'missing model version category mismatch')
assert(coverage.exactCategoryCounts.unsupportedMarket === 0, 'unsupported market category mismatch')
assert(coverage.exactCategoryCounts.duplicate === 0, 'duplicate category mismatch')
assert(coverage.marketReadiness.some((row) => row.label === 'Moneyline' && row.acceptedRows === 118), 'moneyline accepted count required')
assert(coverage.marketReadiness.some((row) => row.label === 'Spread/Runline' && row.acceptedRows === 118), 'spread/runline accepted count required')
assert(coverage.marketReadiness.some((row) => row.label === 'Totals' && row.acceptedRows === 118), 'total accepted count required')
assert(coverage.sportReadiness.some((row) => row.label === 'MLB' && row.acceptedTrainingRows === 354), 'MLB sport readiness required')
assert(coverage.roadmap.length === 5, 'five-stage roadmap required')
assert(forecast.forecast.remainingToTarget === 646, 'remaining target must be 646')

for (const marker of [
  'HISTORICAL_EVIDENCE_EXPANSION_PASS',
  'TRAINING_EXPANSION_ROADMAP_PASS',
  'SPORT_READINESS_FORECAST_PASS',
  'MARKET_READINESS_FORECAST_PASS',
  'TRAINING_FORECAST_PASS',
  'NO_PROVIDER_CALL_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_EPOCH_ACTIVATION_PASS',
  'NO_PRODUCTION_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  assert(forecast.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'historical_evidence_expansion_v1_validation',
  currentSamples: coverage.currentSamples,
  recoverableSamples: coverage.recoverableSamples,
  partiallyRecoverableSamples: coverage.partiallyRecoverableSamples,
  permanentlyRejectedSamples: coverage.permanentlyRejectedSamples,
  providerCallsMade: coverage.providerCallsMade,
  databaseMutations: coverage.databaseMutations,
  deterministicFingerprint: coverage.deterministicFingerprint,
}, null, 2))
