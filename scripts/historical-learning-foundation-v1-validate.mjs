import fs from 'node:fs'

const evidence = JSON.parse(fs.readFileSync('docs/HISTORICAL_LEARNING_READINESS_V1.json', 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(evidence.success === true, 'historical learning evidence must be successful')
assert(evidence.mode === 'historical_learning_foundation_v1', 'unexpected mode')
assert(evidence.readOnly === true, 'foundation must be read-only')
assert(evidence.providerCallsMade === 0, 'provider calls must remain zero')
assert(evidence.databaseMutations === 0, 'database mutations must remain zero')
assert(evidence.settlementWrites === 0, 'settlement writes must remain zero')
assert(evidence.predictionWrites === 0, 'prediction writes must remain zero')
assert(evidence.learningWeightMutations === 0, 'learning weight mutations must remain zero')
assert(evidence.epochMutations === 0, 'epoch mutations must remain zero')
assert(evidence.noTrainingExecuted === true, 'model training must not execute')
assert(evidence.inventory.totalPredictionsScanned >= 1, 'predictions must be scanned')
assert(evidence.inventory.productionTrainingReady === 354, 'current canonical production training-ready count should be 354')
assert(evidence.inventory.rejectedRows + evidence.inventory.productionTrainingReady === evidence.inventory.totalPredictionsScanned, 'accepted + rejected must equal scanned')
assert(evidence.noTrainingProof.modelWeightHistoryBefore === evidence.noTrainingProof.modelWeightHistoryAfter, 'model weight history count must remain unchanged')
assert(evidence.noTrainingProof.probabilityOutputsChanged === false, 'probabilities must remain unchanged')
assert(evidence.noTrainingProof.confidenceOutputsChanged === false, 'confidence must remain unchanged')
assert(evidence.noTrainingProof.officialPickPolicyChanged === false, 'official pick policy must remain unchanged')
assert(typeof evidence.deterministicFingerprint === 'string' && evidence.deterministicFingerprint.length === 64, 'deterministic fingerprint required')
assert(Array.isArray(evidence.trainingQueueReadiness), 'training queue readiness matrix required')
assert(evidence.sampleRows.length <= 50, 'sample rows must be bounded')

for (const row of evidence.sampleRows) {
  assert(!row.featureSnapshotPayload, 'sample rows must not export large feature payloads')
}

console.log(JSON.stringify({
  success: true,
  totalPredictionsScanned: evidence.inventory.totalPredictionsScanned,
  productionTrainingReady: evidence.inventory.productionTrainingReady,
  rejectedRows: evidence.inventory.rejectedRows,
  deterministicFingerprint: evidence.deterministicFingerprint,
  providerCallsMade: evidence.providerCallsMade,
  databaseMutations: evidence.databaseMutations,
  modelWeightHistoryBefore: evidence.noTrainingProof.modelWeightHistoryBefore,
  modelWeightHistoryAfter: evidence.noTrainingProof.modelWeightHistoryAfter,
}, null, 2))
