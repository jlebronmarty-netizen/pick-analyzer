import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json', 'utf8'))
const modelArtifact = JSON.parse(fs.readFileSync('artifacts/mlb/mlb-02c-moneyline-baseline-model.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02C_MONEYLINE_MODEL_TRAINING_EXECUTION_CERTIFIED')
check('production alignment', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === 'c15cb8929d5fe26930513119bf3868b0fe5971f8')
check('dataset digest', flags.MLB_02C_DATASET_DIGEST === 'PASS' && artifact.dataset?.rows === 2249 && artifact.dataset?.digest === '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209')
check('split', flags.MLB_02C_SPLIT_REPRODUCTION === 'PASS' && artifact.split?.train?.rows === 1574 && artifact.split?.validation?.rows === 337 && artifact.split?.test?.rows === 338)
check('leakage', flags.MLB_02C_TRAINING_LEAKAGE_GUARD === 'PASS' && artifact.leakage?.identifierLeakage === 0 && artifact.leakage?.outcomeDerivedInputFields === 0 && artifact.leakage?.futureLeakage === 0)
check('preprocessing', flags.MLB_02C_PREPROCESSING_ISOLATION === 'PASS' && artifact.leakage?.MLB_02C_MISSINGNESS_HANDLING === 'PASS')
check('trivial baseline', flags.MLB_02C_TRIVIAL_BASELINE === 'PASS' && artifact.modelResults?.trivialBaseline?.validation?.rows === 337)
check('standard logistic', flags.MLB_02C_LOGISTIC_BASELINE_TRAINED === 'YES' && artifact.modelResults?.standardLogistic?.validation?.logLoss > 0)
check('regularized logistic', flags.MLB_02C_REGULARIZED_LOGISTIC_TRAINED === 'YES' && artifact.modelResults?.regularizedLogistic?.candidates?.length === 4)
check('selection', flags.MLB_02C_REGULARIZED_LOGISTIC_SELECTION === 'PASS' && artifact.modelResults?.finalHoldoutCandidate)
check('holdout', flags.MLB_02C_TEST_HOLDOUT_ISOLATION === 'PASS' && artifact.modelResults?.testMetrics?.rows === 338)
check('reliability', flags.MLB_02C_RELIABILITY_ANALYSIS === 'PASS' && artifact.diagnostics?.reliability?.test?.length > 0)
check('feature signal', flags.MLB_02C_FEATURE_SIGNAL_AUDIT === 'PASS' && artifact.diagnostics?.featureSignalAudit?.strongestPositive?.length === 10)
check('probability sanity', flags.MLB_02C_PROBABILITY_SANITY === 'PASS' && artifact.diagnostics?.probabilitySanity?.nan === 0 && artifact.diagnostics?.probabilitySanity?.inf === 0)
check('walk forward', flags.MLB_02C_WALK_FORWARD_VALIDATION === 'PASS' && artifact.diagnostics?.walkForward?.folds >= 3)
check('artifact', flags.MLB_02C_MODEL_ARTIFACT_READY === 'YES' && flags.MLB_02C_MODEL_ARTIFACT_DIGEST_READY === 'YES' && modelArtifact.metadata?.productionPersistence === false)
check('no champion promotion', flags.MLB_02C_CHAMPION_PROMOTION_PERFORMED === 'NO')
check('boundary', flags.MLB_02C_NO_UNSUPPORTED_VALUE_CLAIMS === 'PASS' && flags.MLB_02C_OUTCOME_MODEL_BOUNDARY === 'PASS')
check('prediction/model persistence', flags.PREDICTION_WORK_PERFORMED === 'NO' && flags.PRODUCTION_MODEL_PERSISTENCE_PERFORMED === 'NO')
check('safety', artifact.safety?.providerCalls === 0 && artifact.safety?.productionDml === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.featureDml === 0 && artifact.safety?.rawWrites === 0 && artifact.safety?.import2026 === 'NO' && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02c-moneyline-model-training-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02c-moneyline-model-training-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    championEligibility: artifact.assessment.MLB_02C_CHAMPION_ELIGIBILITY,
    modelArtifactDigest: artifact.artifact.digest,
  }, null, 2))
}
