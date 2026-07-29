import fs from 'node:fs'

const growth = JSON.parse(fs.readFileSync('docs/LEARNING_DATASET_GROWTH.json', 'utf8'))
const summary = JSON.parse(fs.readFileSync('docs/RECOVERY_SUMMARY.json', 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(growth.success === true, 'growth manifest must succeed')
assert(summary.success === true, 'summary manifest must succeed')
assert(growth.readOnly === true && summary.readOnly === true, 'recovery must be read-only')
assert(growth.providerCallsMade === 0 && summary.providerCallsMade === 0, 'provider calls must remain zero')
assert(growth.databaseMutations === 0 && summary.databaseMutations === 0, 'database mutations must remain zero')
assert(growth.productionMutations === 0 && summary.productionMutations === 0, 'production mutations must remain zero')
assert(growth.settlementWrites === 0, 'settlement writes must remain zero')
assert(growth.predictionWrites === 0, 'prediction writes must remain zero')
assert(growth.modelTrainingRuns === 0, 'model training must remain zero')
assert(growth.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(growth.epochMutations === 0, 'epochs must remain unchanged')
assert(growth.noTrainingExecuted === true, 'training must not execute')
assert(growth.before.trainingReadyRows === 354, 'baseline training-ready rows must remain 354')
assert(growth.after.trainingReadyRows >= growth.before.trainingReadyRows, 'training-ready rows cannot decrease')
assert(growth.after.recoveredRows === growth.after.trainingReadyRows - growth.before.trainingReadyRows, 'recovered rows must equal before/after delta')
assert(growth.qualityAudit.duplicateRecoveredIds === 0, 'recovered IDs must be unique')
assert(growth.qualityAudit.recoveredRowsMissingFeatureLinkage === 0, 'recovered rows must have feature linkage')
assert(growth.qualityAudit.recoveredRowsMissingResultLinkage === 0, 'recovered rows must have result linkage')
assert(growth.qualityAudit.recoveredRowsMissingModelLinkage === 0, 'recovered rows must have model linkage')
assert(growth.qualityAudit.recoveredRowsWithCutoffFailure === 0, 'recovered rows must be cutoff-safe')
assert(growth.qualityAudit.recoveredRowsWithLabelFailure === 0, 'recovered rows must have deterministic labels')
assert(growth.qualityAudit.orphanRecoveredRows === 0, 'recovered rows must not be orphaned')

for (const marker of [
  'HISTORICAL_EVIDENCE_RECOVERY_PASS',
  'TRAINING_DATASET_EXPANSION_PASS',
  'LEARNING_DATASET_GROWTH_PASS',
  'CANONICAL_RECOVERY_PASS',
  'NO_PROVIDER_CALL_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_EPOCH_ACTIVATION_PASS',
  'NO_PRODUCTION_PREDICTION_CHANGE_PASS',
  'NO_SETTLEMENT_CHANGE_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  assert(summary.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'historical_evidence_recovery_v1_validation',
  trainingReadyBefore: growth.before.trainingReadyRows,
  trainingReadyAfter: growth.after.trainingReadyRows,
  recoveredRows: growth.after.recoveredRows,
  remainingRecoverableRows: growth.after.remainingRecoverableRows,
  providerCallsMade: growth.providerCallsMade,
  databaseMutations: growth.databaseMutations,
  deterministicFingerprint: growth.deterministicFingerprint,
}, null, 2))
