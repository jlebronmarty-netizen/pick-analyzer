import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02d-moneyline-model-promotion-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02D_MONEYLINE_MODEL_PROMOTION_PREP_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '5c9bfde15e49321118fa95c23fbc66a0d7912593')
check('artifact present digest', flags.MLB_02D_MODEL_ARTIFACT_PRESENT === 'YES' && flags.MLB_02D_MODEL_ARTIFACT_DIGEST === 'PASS' && artifact.model?.artifactDigest === '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616')
check('dataset identity', flags.MLB_02D_MODEL_DATASET_IDENTITY === 'PASS' && artifact.model?.datasetDigest === '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209' && artifact.model?.featureSetVersion === 'MLB_ML_FEATURE_SET_V1')
check('reproducibility', flags.MLB_02D_MODEL_REPRODUCIBILITY === 'PASS' && artifact.model?.featureCount === 76 && artifact.model?.hyperparameters?.seed === 20260904)
check('metrics', flags.MLB_02D_METRIC_READBACK === 'PASS' && artifact.performance?.test?.logLoss === 0.683101 && artifact.performance?.test?.brier === 0.245035)
check('baseline improvement', flags.MLB_02D_PRIMARY_BASELINE_IMPROVEMENT === 'PASS' && artifact.performance?.baselineImprovement?.result === 'PASS')
check('calibration', flags.MLB_02D_CALIBRATION_READINESS === 'PASS' && artifact.performance?.calibrationState === 'CALIBRATION_ACCEPTABLE')
check('walk forward', flags.MLB_02D_WALK_FORWARD_READINESS === 'PASS' && artifact.performance?.walkForward?.MLB_02C_WALK_FORWARD_VALIDATION === 'PASS')
check('eligibility', flags.MLB_02D_PROMOTION_ELIGIBILITY === 'ELIGIBLE')
check('schema inventory', flags.MLB_02D_MODEL_SCHEMA_INVENTORY_COMPLETE === 'YES' && artifact.productionSchema?.inventory?.pick2_model_versions?.columns?.includes('artifact_digest'))
check('zero baseline', flags.MLB_02D_PRODUCTION_MODEL_ZERO_BASELINE === 'PASS' && Object.values(artifact.productionSchema?.zeroBaseline ?? {}).every((count) => count === 0))
check('persistence plans', flags.MLB_02D_FEATURE_SET_PERSISTENCE_PLAN === 'READY' && flags.MLB_02D_MODEL_VERSION_PERSISTENCE_PLAN === 'READY' && flags.MLB_02D_TRAINING_RUN_PERSISTENCE_PLAN === 'READY' && flags.MLB_02D_VALIDATION_RUN_PERSISTENCE_PLAN === 'READY')
check('champion contract', flags.MLB_02D_CHAMPION_IDENTITY_CONTRACT === 'READY' && flags.MLB_02D_SINGLE_CHAMPION_CONTRACT === 'PASS' && flags.MLB_02D_CHAMPION_IMMUTABILITY_CONTRACT === 'PASS' && flags.MLB_02D_CHAMPION_ROLLBACK_CONTRACT === 'READY')
check('prediction/value boundaries', flags.MLB_02D_PROMOTION_PREDICTION_SEPARATION === 'PASS' && flags.MLB_02D_PROBABILITY_CHAMPION_VALUE_SEPARATION === 'PASS')
check('dml caps', flags.MLB_02D_PROMOTION_DML_CAPS_READY === 'YES' && artifact.dryRun?.dmlCaps?.maximumFuturePromotionWrites === 6 && artifact.dryRun?.dmlCaps?.predictionRows === 0)
check('idempotency conflict', flags.MLB_02D_PROMOTION_IDEMPOTENCY_CONTRACT === 'PASS' && flags.MLB_02D_PROMOTION_CONFLICT_CONTRACT === 'PASS' && artifact.dryRun?.conflicts === 0)
check('dry run fail closed', flags.MLB_02D_PROMOTION_DRY_RUN === 'PASS' && flags.MLB_02D_PROMOTION_EXECUTION_FAIL_CLOSED === 'PASS')
check('no champion promotion', flags.MLB_02D_CHAMPION_PROMOTION_PERFORMED === 'NO')
check('safety', artifact.safety?.productionModelWrites === 0 && artifact.safety?.productionPredictionWrites === 0 && artifact.safety?.productionDml === 0 && artifact.safety?.productionDdl === 0 && artifact.safety?.providerCalls === 0 && artifact.safety?.import2026 === 'NO' && artifact.safety?.automation === 'OFF' && artifact.safety?.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02d-moneyline-promotion-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02d-moneyline-promotion-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    promotionEligibility: artifact.eligibility.MLB_02D_PROMOTION_ELIGIBILITY,
  }, null, 2))
}
