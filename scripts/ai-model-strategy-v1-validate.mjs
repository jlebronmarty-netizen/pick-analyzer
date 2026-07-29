import fs from 'node:fs'

const strategy = JSON.parse(fs.readFileSync('docs/AI_MODEL_STRATEGY_V1.json', 'utf8'))
const requiredDocs = [
  'docs/AI_MODEL_STRATEGY_V1.md',
  'docs/MODEL_SELECTION_ANALYSIS.md',
  'docs/FEATURE_ANALYSIS_V1.md',
  'docs/MODEL_EVOLUTION_ROADMAP.md',
  'docs/TRAINING_PRIORITY_MATRIX.md',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(strategy.success === true, 'strategy manifest must succeed')
assert(strategy.readOnly === true, 'strategy must be read-only')
assert(strategy.providerCallsMade === 0, 'provider calls must remain zero')
assert(strategy.databaseMutations === 0, 'database mutations must remain zero')
assert(strategy.productionMutations === 0, 'production mutations must remain zero')
assert(strategy.modelTrainingRuns === 0, 'model training must remain zero')
assert(strategy.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(strategy.epochMutations === 0, 'epochs must remain unchanged')
assert(strategy.baseline.currentTrainingReadyRows === 419, 'current training-ready rows must be 419')
assert(strategy.baseline.roadmapTargetRows === 1000, 'target rows must be 1000')
assert(strategy.featureAnalysis.linkedFeatureSnapshotIds > 0, 'feature snapshots must be inspected')
assert(strategy.featureAnalysis.uniqueFeatureKeysObserved > 0, 'feature keys must be observed')
assert(strategy.datasetAnalysis.usableSportsNow.length === 0, 'no sport should be training-usable now')
assert(strategy.datasetAnalysis.usableMarketsNow.length === 0, 'no market should be training-usable now')
assert(strategy.modelAnalysis.recommendedArchitecture.includes('MLB-first regularized'), 'recommended architecture must be MLB-first regularized')
assert(strategy.expectedImprovement.length === 6, 'sample curve must include six checkpoints')
assert(strategy.evolutionRoadmap.length >= 6, 'evolution roadmap must include future stages')

for (const doc of requiredDocs) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('No model training'), `${doc} must include no-training guardrail`)
  assert(text.includes('No production mutation'), `${doc} must include no-production-mutation guardrail`)
}

for (const marker of [
  'AI_MODEL_STRATEGY_PASS',
  'MODEL_SELECTION_ANALYSIS_PASS',
  'FEATURE_ANALYSIS_PASS',
  'MODEL_EVOLUTION_ROADMAP_PASS',
  'TRAINING_PRIORITY_MATRIX_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_EPOCH_ACTIVATION_PASS',
  'NO_PRODUCTION_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  assert(strategy.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'ai_model_strategy_v1_validation',
  currentTrainingReadyRows: strategy.baseline.currentTrainingReadyRows,
  linkedFeatureSnapshotIds: strategy.featureAnalysis.linkedFeatureSnapshotIds,
  uniqueFeatureKeysObserved: strategy.featureAnalysis.uniqueFeatureKeysObserved,
  providerCallsMade: strategy.providerCallsMade,
  databaseMutations: strategy.databaseMutations,
  deterministicFingerprint: strategy.deterministicFingerprint,
}, null, 2))
