import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '8f3c419ddc55ee218aea5dfacda4b0bec274381b')
check('champion', artifact.champion?.MLB_02I_CHAMPION_READBACK === 'PASS' && artifact.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('model artifact', artifact.modelArtifact?.MLB_02I_MODEL_ARTIFACT_INTEGRITY === 'PASS' && artifact.modelArtifact?.featureCount === 76)
check('preprocessing', artifact.modelArtifact?.MLB_02I_PREPROCESSING_INTEGRITY === 'PASS')
check('current inventory', artifact.currentGameInventory?.MLB_02I_CURRENT_GAME_INVENTORY === 'PASS' && artifact.currentGameInventory?.total >= artifact.currentGameInventory?.readyProbableWithFlag)
check('status guard', artifact.currentGameInventory?.MLB_02I_GAME_STATUS_GUARD === 'PASS')
check('starter guard', artifact.currentGameInventory?.MLB_02I_STARTER_READINESS_GUARD === 'PASS')
check('feature vector', artifact.featureAudit?.MLB_02I_CURRENT_FEATURE_VECTOR_BUILD === 'PASS' && artifact.featureAudit?.featureCount === 76)
check('feature parity', artifact.featureAudit?.MLB_02I_FEATURE_SEMANTIC_PARITY === 'PASS' && artifact.featureAudit?.MLB_02I_FEATURE_FRESHNESS === 'PASS')
check('leakage', artifact.featureAudit?.MLB_02I_LIVE_ASOF_LEAKAGE === 'PASS' && artifact.featureAudit?.asOfLeakageViolations === 0)
check('dry inference', artifact.dryInference?.MLB_02I_CURRENT_DRY_INFERENCE === 'PASS' && artifact.dryInference?.rows?.length === artifact.dryInference?.cap && artifact.dryInference?.cap > 0)
check('probability sanity', artifact.dryInference?.MLB_02I_PROBABILITY_SANITY === 'PASS' && Object.values(artifact.dryInference?.probabilitySanity ?? {}).every((value) => value === 0))
check('reproducibility', artifact.dryInference?.MLB_02I_INFERENCE_REPRODUCIBILITY === 'PASS' && artifact.dryInference?.reproducibilityFailures === 0)
check('input digest', artifact.dryInference?.MLB_02I_INPUT_DIGEST === 'PASS')
check('dry records', artifact.dryInference?.MLB_02I_DRY_PREDICTION_RECORD_BUILD === 'PASS' && artifact.dryInference?.MLB_02I_DRY_PREDICTION_IDENTITY === 'PASS')
check('prewrite', artifact.prewriteClassification?.MLB_02I_PREDICTION_PREWRITE_DRY_CLASSIFICATION === 'PASS' && artifact.prewriteClassification?.blockConflict === 0)
check('future cap', artifact.prewriteClassification?.MLB_02I_FUTURE_PREDICTION_DML_CAP_READY === 'YES' && artifact.prewriteClassification?.insertEligible > 0)
check('foundation', artifact.foundation?.MLB_02I_2026_FOUNDATION_PRESERVED === 'PASS' && artifact.foundation?.MLB_02I_2025_FOUNDATION_PRESERVED === 'PASS')
check('zero odds/value', artifact.safety?.MLB_02I_ODDS_PROVIDER_CALLS === 0 && artifact.safety?.MLB_02I_VALUE_WORK === 'NO' && artifact.safety?.MLB_02I_OFFICIAL_PICK_WORK === 'NO')
check('zero writes', artifact.safety?.MLB_02I_PREDICTION_DML === 0 && artifact.safety?.MLB_02I_OTHER_PRODUCTION_MUTATIONS === 0)
check('automation', artifact.safety?.MLB_02I_AUTOMATION_STATE === 'OFF' && artifact.safety?.cronChanges === 0)
check('audit artifact', fs.existsSync('docs/CERTIFICATION/mlb-data-02i-current-moneyline-probability-audit.md'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02i-current-moneyline-dry-inference-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02i-current-moneyline-dry-inference-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    dryInferenceCount: artifact.dryInference.cap,
    insertEligible: artifact.prewriteClassification.insertEligible,
    blockConflict: artifact.prewriteClassification.blockConflict,
  }, null, 2))
}
