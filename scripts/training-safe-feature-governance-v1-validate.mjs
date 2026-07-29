import fs from 'node:fs'

const governanceText = fs.readFileSync('docs/TRAINING_SAFE_FEATURE_GOVERNANCE_V1.md', 'utf8')
const contractText = fs.readFileSync('docs/TRAINING_FEATURE_CONTRACT_V1.md', 'utf8')
const enforcementText = fs.readFileSync('docs/FEATURE_LEAKAGE_ENFORCEMENT_V1.md', 'utf8')
const manifest = JSON.parse(fs.readFileSync('docs/FIRST_MODEL_FEATURE_MANIFEST_V1.json', 'utf8'))
const aliasMap = JSON.parse(fs.readFileSync('docs/FEATURE_ALIAS_MAP_V1.json', 'utf8'))
const recertification = JSON.parse(fs.readFileSync('docs/TRAINING_DATASET_FEATURE_RECERTIFICATION_V1.json', 'utf8'))
const coverage = JSON.parse(fs.readFileSync('docs/FEATURE_COVERAGE.json', 'utf8'))

const { runTrainingFeatureGovernanceFixtures } = await import('../src/services/training-feature-governance-v1.service.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const fixtures = runTrainingFeatureGovernanceFixtures()

assert(governanceText.includes('No model training'), 'governance doc must include no-training guardrail')
assert(governanceText.includes('No production mutation'), 'governance doc must include no-production-mutation guardrail')
assert(governanceText.includes('Feature keys classified: 449'), 'governance doc must classify all 449 keys')
assert(contractText.includes('TRAINING_ALLOWED_IF_CUTOFF_FROZEN'), 'contract doc must describe cutoff-frozen eligibility')
assert(enforcementText.includes('Unknown fields default deny'), 'enforcement doc must default deny unknown fields')
assert(fixtures.success === true, 'governance fixtures must pass')
assert(fixtures.passed === fixtures.total, 'all leakage fixtures must pass')

assert(manifest.success === true, 'first model manifest must succeed')
assert(manifest.trainingExecuted === false, 'first model manifest must not train')
assert(manifest.providerCallsMade === 0, 'manifest provider calls must be zero')
assert(manifest.databaseMutations === 0, 'manifest database mutations must be zero')
assert(manifest.modelCandidate === 'mlb_regularized_logistic_regression_candidate_v1', 'first manifest must target MLB logistic regression')
assert(manifest.features.length > 0, 'first manifest must include allowed features')
assert(manifest.features.length <= manifest.maximumInitialFeatureCount, 'first manifest must respect maximum feature count')
assert(manifest.features.every((feature) => !/result|settle|profit|probability|confidence|edge|ev|trust|official/i.test(feature.sourceKey)), 'manifest must exclude prohibited output/label-like source keys')
assert(typeof manifest.fingerprint === 'string' && manifest.fingerprint.length === 64, 'manifest fingerprint required')

assert(aliasMap.success === true, 'alias map must succeed')
assert(aliasMap.providerCallsMade === 0, 'alias map provider calls must be zero')
assert(aliasMap.databaseMutations === 0, 'alias map mutations must be zero')
assert(aliasMap.aliasGroups.length >= 4, 'alias map must include canonical alias groups')
assert(aliasMap.aliasGroups.some((group) => group.groupKey === 'model_output_aliases'), 'model output aliases must be mapped')
assert(aliasMap.aliasGroups.some((group) => group.groupKey === 'settlement_label_aliases'), 'settlement label aliases must be mapped')

assert(recertification.success === true, 'recertification must succeed')
assert(recertification.readOnly === true, 'recertification must be read-only')
assert(recertification.providerCallsMade === 0, 'recert provider calls must remain zero')
assert(recertification.databaseMutations === 0, 'recert database mutations must remain zero')
assert(recertification.predictionWrites === 0, 'prediction writes must remain zero')
assert(recertification.settlementWrites === 0, 'settlement writes must remain zero')
assert(recertification.learningWrites === 0, 'learning writes must remain zero')
assert(recertification.modelTrainingRuns === 0, 'model training must remain zero')
assert(recertification.modelWeightMutations === 0, 'model weights must remain unchanged')
assert(recertification.epochMutations === 0, 'epochs must remain unchanged')
assert(recertification.beforeRows === 419, 'baseline must remain 419 rows')
assert(recertification.rowsStillEligible === 419, 'accepted baseline should remain 419 under field-exclusion contract')
assert(recertification.rowsBlockedByFeatureLeakage === 0, 'accepted baseline rows should not be blocked by leakage when prohibited fields are excluded')
assert(recertification.rowsBlockedByTemporalUncertainty === 0, 'accepted baseline cutoff failures must remain zero')
assert(recertification.rowsBlockedByMissingRequiredFeatures === 0, 'accepted baseline missing feature linkage must remain zero')
assert(recertification.distinctAllowedFeaturesUsed > 0, 'allowed features must be observed')
assert(recertification.unknownKeysObserved.length === 0, 'observed current keys must be classified')
assert(typeof recertification.normalizedDatasetFingerprint === 'string' && recertification.normalizedDatasetFingerprint.length === 64, 'recert fingerprint required')

assert(coverage.leakageSummary.critical === 29, 'critical leakage baseline must remain 29')
assert(coverage.leakageSummary.high === 7, 'high leakage baseline must remain 7')
assert(coverage.leakageSummary.cutoffFrozenCandidates === 35, 'cutoff-frozen baseline must remain 35')
assert(coverage.leakageSummary.safeCandidates === 378, 'candidate non-leakage baseline must remain 378')

for (const doc of [
  'docs/TRAINING_DATASET_SPEC_V1.md',
  'docs/FEATURE_LEAKAGE_AUDIT.md',
  'docs/TRAINING_CHECKLIST_V1.md',
]) {
  const text = fs.readFileSync(doc, 'utf8')
  assert(text.includes('Training-Safe Feature Governance V1'), `${doc} must reference the governance contract`)
}

console.log(JSON.stringify({
  success: true,
  mode: 'training_safe_feature_governance_v1_validation',
  featureKeysClassified: 449,
  firstModelFeatureCount: manifest.features.length,
  baselineRows: recertification.beforeRows,
  rowsStillEligible: recertification.rowsStillEligible,
  prohibitedKeysObserved: recertification.prohibitedKeysObserved.length,
  unknownKeysObserved: recertification.unknownKeysObserved.length,
  providerCallsMade: recertification.providerCallsMade,
  databaseMutations: recertification.databaseMutations,
  modelTrainingRuns: recertification.modelTrainingRuns,
  normalizedDatasetFingerprint: recertification.normalizedDatasetFingerprint,
}, null, 2))
