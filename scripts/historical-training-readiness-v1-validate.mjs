import fs from 'node:fs'

const manifest = JSON.parse(fs.readFileSync('docs/TRAINING_READINESS_V1.json', 'utf8'))
const requiredDocs = [
  'docs/TRAINING_PIPELINE_ARCHITECTURE_V1.md',
  'docs/MODEL_GOVERNANCE_V1.md',
  'docs/TRAINING_READINESS_V1.md',
  'docs/MODEL_PROMOTION_POLICY_V1.md',
  'docs/TRAINING_DATASET_SPEC_V1.md',
  'docs/TRAINING_CHECKLIST_V1.md',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(manifest.success === true, 'manifest must be successful')
assert(manifest.readOnly === true, 'manifest must be read-only')
assert(manifest.noTrainingExecuted === true, 'training must not execute')
assert(manifest.providerCallsMade === 0, 'provider calls must remain zero')
assert(manifest.databaseMutations === 0, 'database mutations must remain zero')
assert(manifest.settlementWrites === 0, 'settlement writes must remain zero')
assert(manifest.predictionWrites === 0, 'prediction writes must remain zero')
assert(manifest.learningWrites === 0, 'learning writes must remain zero')
assert(manifest.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(manifest.epochMutations === 0, 'epochs must remain unchanged')
assert(manifest.baseline.productionTrainingReadyRows === 354, 'production training-ready baseline must remain 354')
assert(manifest.baseline.learningQueueRows === 386, 'learning queue baseline must remain 386')
assert(manifest.baseline.learningAcceptedRows === 354, 'learning accepted baseline must remain 354')
assert(manifest.baseline.modelWeightHistoryRows === 41, 'model weight history baseline must remain 41')
assert(manifest.baseline.trainingEverExecuted === false, 'training must never be marked executed')
assert(manifest.baseline.epochPromotionEverExecuted === false, 'epoch promotion must remain false')
assert(manifest.datasetQuality.sampleCountStatus === 'INSUFFICIENT_FOR_MODEL_TRAINING', 'current sample should remain insufficient for training')
assert(manifest.sportReadiness.some((row) => row.label === 'MLB' && row.acceptedTrainingRows === 354), 'MLB readiness row required')
assert(manifest.sportReadiness.some((row) => row.label === 'NFL' && row.readiness === 'EVIDENCE_PRESENT_NOT_TRAINING_READY'), 'NFL preview readiness row required')
assert(manifest.sportReadiness.some((row) => row.label === 'NHL' && row.readiness === 'EVIDENCE_PRESENT_NOT_TRAINING_READY'), 'NHL preview readiness row required')
assert(manifest.sportReadiness.some((row) => row.label === 'Tennis' && row.readiness === 'NO_TRAINING_EVIDENCE'), 'Tennis blocked row required')
assert(manifest.sportReadiness.some((row) => row.label === 'UFC' && row.readiness === 'NO_TRAINING_EVIDENCE'), 'UFC blocked row required')
assert(manifest.governance.automaticTraining === 'disabled', 'automatic training must be disabled')
assert(manifest.shadowStrategy.automaticPromotionAllowed === false, 'automatic promotion must be disabled')
assert(typeof manifest.deterministicFingerprint === 'string' && manifest.deterministicFingerprint.length === 64, 'deterministic fingerprint required')

for (const doc of requiredDocs) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('No model training'), `${doc} must include no-training guardrail`)
  assert(text.includes('No production prediction changes'), `${doc} must include prediction-change guardrail`)
}

const expectedMarkers = [
  'TRAINING_PIPELINE_ARCHITECTURE_PASS',
  'TRAINING_DATASET_READINESS_PASS',
  'MODEL_GOVERNANCE_PASS',
  'MODEL_PROMOTION_POLICY_PASS',
  'SHADOW_MODEL_ARCHITECTURE_PASS',
  'TRAINING_VALIDATION_ARCHITECTURE_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_EPOCH_ACTIVATION_PASS',
  'NO_PRODUCTION_PREDICTION_CHANGE_PASS',
  'NO_SETTLEMENT_CHANGE_PASS',
]

for (const marker of expectedMarkers) {
  assert(manifest.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'historical_training_readiness_v1_validation',
  productionTrainingReadyRows: manifest.baseline.productionTrainingReadyRows,
  learningQueueRows: manifest.baseline.learningQueueRows,
  modelWeightHistoryRows: manifest.baseline.modelWeightHistoryRows,
  providerCallsMade: manifest.providerCallsMade,
  databaseMutations: manifest.databaseMutations,
  modelWeightMutations: manifest.modelWeightMutations,
  epochMutations: manifest.epochMutations,
  deterministicFingerprint: manifest.deterministicFingerprint,
}, null, 2))
