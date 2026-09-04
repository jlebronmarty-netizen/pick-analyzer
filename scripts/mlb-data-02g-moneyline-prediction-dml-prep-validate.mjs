import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02g-moneyline-prediction-dml-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags ?? {}
const safety = artifact.safety ?? {}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02G_MONEYLINE_PREDICTION_DML_PREP_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === 'fd0ec977c0a7505a9758295df179f55fe25925ac')
check('champion', flags.MLB_02G_CHAMPION_READBACK === 'PASS' && artifact.champion?.count === 1 && artifact.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('inference contract', flags.MLB_02G_INFERENCE_CONTRACT_READBACK === 'PASS' && artifact.inferenceContract?.fullReplayRows === 2249)
check('schema', flags.MLB_02G_PREDICTION_SCHEMA_INVENTORY_COMPLETE === 'YES' && artifact.schemaInventory?.pick2_game_predictions?.legacyEventCompatibility.includes('nullable'))
check('identity market record', flags.MLB_02G_GAMEPK_PREDICTION_IDENTITY === 'PASS' && flags.MLB_02G_MONEYLINE_MARKET_CONTRACT === 'PASS' && flags.MLB_02G_PREDICTION_RECORD_CONTRACT === 'READY')
check('probability storage', flags.MLB_02G_PROBABILITY_STORAGE_CONTRACT === 'PASS' && flags.MLB_02G_PROBABILITY_COMPLEMENT_STORAGE === 'PASS')
check('asof no overwrite', flags.MLB_02G_ASOF_SEMANTICS === 'READY' && flags.MLB_02G_MATERIAL_INPUT_CHANGE_CONTRACT === 'READY' && flags.MLB_02G_PREDICTION_NO_OVERWRITE === 'PASS')
check('deterministic identity', flags.MLB_02G_PREDICTION_DETERMINISTIC_IDENTITY === 'READY' && flags.MLB_02G_PREDICTION_REUSE_CONTRACT === 'PASS' && flags.MLB_02G_PREDICTION_CONFLICT_CONTRACT === 'PASS')
check('input digest', flags.MLB_02G_INFERENCE_INPUT_PAYLOAD_CONTRACT === 'READY' && flags.MLB_02G_INFERENCE_INPUT_DIGEST_CONTRACT === 'PASS')
check('readiness confidence', flags.MLB_02G_STARTER_PERSISTENCE_POLICY === 'READY' && flags.MLB_02G_DATA_COMPLETENESS_CONTRACT === 'READY' && flags.MLB_02G_PROBABILITY_CONFIDENCE_SEPARATION === 'PASS' && flags.MLB_02G_CONFIDENCE_PERSISTENCE_POLICY === 'READY')
check('dry sample', flags.MLB_02G_PERSISTENCE_ROW_DRY_RUN === 'PASS' && artifact.dryRun?.sample?.rows >= 24 && artifact.dryRun.sample.audit.blockConflicts === 0)
check('full identity', flags.MLB_02G_FULL_IDENTITY_DRY_RUN === 'PASS' && artifact.dryRun?.fullIdentityAudit?.rows === 2249 && artifact.dryRun.fullIdentityAudit.duplicateIdentities === 0 && artifact.dryRun.fullIdentityAudit.blockConflicts === 0)
check('zero baseline/backfill', flags.MLB_02G_PRODUCTION_PREDICTION_ZERO_BASELINE === 'PASS' && flags.MLB_02G_HISTORICAL_PREDICTION_BACKFILL_AUTHORIZED === 'NO')
check('caps', flags.MLB_02G_SINGLE_GAME_DML_CAP_READY === 'YES' && flags.MLB_02G_SLATE_DML_CAP_CONTRACT === 'PASS' && flags.MLB_02G_REPLAY_NOT_PRODUCTION_BACKFILL === 'PASS')
check('prewrite/idempotency', flags.MLB_02G_PREWRITE_CLASSIFICATION_CONTRACT === 'PASS' && flags.MLB_02G_PARTIAL_FAILURE_CONTRACT === 'READY' && flags.MLB_02G_PREDICTION_IDEMPOTENCY_PROJECTED === 'PASS')
check('result/market', flags.MLB_02G_RESULT_LINKAGE_CONTRACT === 'READY' && flags.MLB_02G_PREDICTION_RESULT_SEPARATION === 'PASS' && flags.MLB_02G_ODDS_PERSISTENCE_SEPARATION === 'PASS' && flags.MLB_02G_FUTURE_VALUE_JOIN_CONTRACT === 'READY' && flags.MLB_02G_OFFICIAL_PICK_SEPARATION === 'PASS')
check('runner', flags.MLB_02G_PREDICTION_DML_RUNNER_PREP === 'PASS' && flags.MLB_02G_PREDICTION_DML_EXECUTION_FAIL_CLOSED === 'PASS')
check('live state', flags.MLB_02G_2026_LIVE_PREDICTION_STATE === 'NOT_READY' && flags.MLB_02G_LIVE_DATA_DEPENDENCY_DOCUMENTED === 'YES')
check('preservation', flags.MLB_02G_CHAMPION_UNCHANGED === 'PASS' && flags.MLB_02G_FEATURE_FOUNDATION_UNCHANGED === 'PASS' && flags.MLB_02G_RAW_NATIVE_UNCHANGED === 'PASS')
check('safety', safety.predictionWrites === 0 && safety.predictionResultWrites === 0 && safety.marketValueWrites === 0 && safety.modelWrites === 0 && safety.championChanges === 0 && safety.productionDml === 0 && safety.productionDdl === 0 && safety.providerCalls === 0 && safety.import2026 === 'NO' && safety.automation === 'OFF' && safety.cronChanges === 0 && flags.PREDICTION_WORK_PERFORMED === 'NO')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02g-moneyline-prediction-dml-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02g-moneyline-prediction-dml-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    dryRows: artifact.dryRun.sample.rows,
    fullIdentityRows: artifact.dryRun.fullIdentityAudit.rows,
    predictionWrites: artifact.safety.predictionWrites,
  }, null, 2))
}
