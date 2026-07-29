import fs from 'node:fs'

const coverage = JSON.parse(fs.readFileSync('docs/FEATURE_COVERAGE.json', 'utf8'))
const requiredDocs = [
  'docs/FEATURE_INTELLIGENCE_V1.md',
  'docs/FEATURE_SIGNAL_MATRIX.md',
  'docs/FEATURE_LEAKAGE_AUDIT.md',
  'docs/FEATURE_PRIORITY_MATRIX.md',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(coverage.success === true, 'coverage manifest must succeed')
assert(coverage.mode === 'feature_intelligence_signal_quality_leakage_audit_v1', 'unexpected coverage mode')
assert(coverage.readOnly === true, 'audit must be read-only')
assert(coverage.providerCallsMade === 0, 'provider calls must remain zero')
assert(coverage.databaseMutations === 0, 'database mutations must remain zero')
assert(coverage.productionMutations === 0, 'production mutations must remain zero')
assert(coverage.modelTrainingRuns === 0, 'model training must remain zero')
assert(coverage.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(coverage.predictionEngineChanges === 0, 'prediction engine must remain unchanged')
assert(coverage.officialPickPolicyChanges === 0, 'Official Pick policy must remain unchanged')
assert(coverage.snapshotsRead > 0, 'feature snapshots must be read')
assert(coverage.featureKeysObserved >= 300, 'expected broad feature key inventory')
assert(Array.isArray(coverage.coverage), 'coverage entries must be present')
assert(coverage.coverage.length === coverage.featureKeysObserved, 'coverage count must match feature key count')
assert(coverage.leakageSummary.critical > 0, 'critical leakage candidates must be identified')
assert(coverage.leakageSummary.excludedFromTraining > 0, 'training exclusions must be identified')
assert(coverage.redundancyGroups.some((group) => group.featureCount > 0), 'redundancy groups must be populated')
assert(coverage.recommendedFeatureSets.firstLogisticFeatureSet.model === 'Regularized Logistic Regression', 'first model feature set must target logistic regression')
assert(coverage.recommendedFeatureSets.secondGradientBoostingFeatureSet.model.includes('Gradient Boosting'), 'second model feature set must target gradient boosting')
assert(coverage.recommendedFeatureSets.futureEnsembleFeatureSet.model.includes('ensemble'), 'future feature set must target ensemble')
assert(typeof coverage.deterministicFingerprint === 'string' && coverage.deterministicFingerprint.length === 64, 'fingerprint must be stable sha256')

for (const doc of requiredDocs) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('No model training'), `${doc} must include no-training guardrail`)
  assert(text.includes('No production mutation'), `${doc} must include no-production-mutation guardrail`)
}

for (const marker of [
  'FEATURE_INTELLIGENCE_PASS',
  'FEATURE_SIGNAL_MATRIX_PASS',
  'FEATURE_LEAKAGE_AUDIT_PASS',
  'FEATURE_PRIORITY_MATRIX_PASS',
  'FIRST_MODEL_FEATURE_SET_PASS',
  'NO_MODEL_TRAINING_PASS',
  'NO_MODEL_WEIGHT_MUTATION_PASS',
  'NO_PROVIDER_CALL_PASS',
  'NO_PRODUCTION_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  assert(coverage.certificationMarkers.includes(marker), `missing marker ${marker}`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'feature_intelligence_signal_quality_leakage_audit_v1_validation',
  snapshotsRead: coverage.snapshotsRead,
  featureKeysObserved: coverage.featureKeysObserved,
  excludedFromTraining: coverage.leakageSummary.excludedFromTraining,
  cutoffFrozenCandidates: coverage.leakageSummary.cutoffFrozenCandidates,
  providerCallsMade: coverage.providerCallsMade,
  databaseMutations: coverage.databaseMutations,
  deterministicFingerprint: coverage.deterministicFingerprint,
}, null, 2))
