import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02j-r1-prediction-feature-snapshot-contract-repair.json', 'utf8'))
const migration = fs.readFileSync('supabase/migrations/202609050001_pick2_game_predictions_nullable_feature_snapshot_id_r1.sql', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02J_R1_PREDICTION_FEATURE_SNAPSHOT_CONTRACT_REPAIR_CERTIFIED')
check('schema audit', artifact.predictionSchemaAudit?.MLB_02J_R1_PREDICTION_SCHEMA_AUDIT_COMPLETE === 'YES')
check('feature snapshot column', artifact.featureSnapshotColumnAudit?.MLB_02J_R1_FEATURE_SNAPSHOT_COLUMN_AUDIT === 'PASS')
check('snapshot schema', artifact.snapshotSchemaAudit?.MLB_02J_R1_SNAPSHOT_SCHEMA_AUDIT_COMPLETE === 'YES')
check('snapshot unit', artifact.snapshotSchemaAudit?.MLB_02J_R1_SNAPSHOT_SEMANTIC_UNIT === 'DOMAIN_ENTITY_ASOF_FEATURE_SNAPSHOT')
check('single snapshot coverage resolved', ['PASS', 'FAIL'].includes(artifact.snapshotCoverage?.MLB_02J_R1_SINGLE_SNAPSHOT_76_FEATURE_COVERAGE))
check('single snapshot coverage fail', artifact.snapshotCoverage?.MLB_02J_R1_SINGLE_SNAPSHOT_76_FEATURE_COVERAGE === 'FAIL')
check('frozen mapping', artifact.snapshotCoverage?.MLB_02J_R1_FROZEN24_SNAPSHOT_MAPPING_COMPLETE === 'YES')
check('arbitrary guard', artifact.snapshotCoverage?.MLB_02J_R1_ARBITRARY_SNAPSHOT_LINK_GUARD === 'PASS')
check('native contract', artifact.nativePredictionInputContract?.MLB_02J_R1_NATIVE_PREDICTION_INPUT_CONTRACT === 'PASS')
check('input digest sufficiency', artifact.nativePredictionInputContract?.MLB_02J_R1_INPUT_DIGEST_PROVENANCE_SUFFICIENT === 'YES')
check('option a', artifact.optionAudits?.optionA?.MLB_02J_R1_OPTION_A_NULLABLE_AUDIT === 'SAFE')
check('option b', artifact.optionAudits?.optionB?.MLB_02J_R1_OPTION_B_AGGREGATE_SNAPSHOT_AUDIT === 'REQUIRES_SCHEMA_EXTENSION')
check('option c', artifact.optionAudits?.optionC?.MLB_02J_R1_OPTION_C_EXISTING_SNAPSHOT_AUDIT === 'NOT_AVAILABLE')
check('selected repair', artifact.selectedRepair?.MLB_02J_R1_SELECTED_REPAIR === 'OPTION_A')
check('legacy compatibility', artifact.selectedRepair?.MLB_02J_R1_LEGACY_COMPATIBILITY === 'PASS')
check('result linkage', artifact.selectedRepair?.MLB_02J_R1_RESULT_LINKAGE_PRESERVED === 'PASS')
check('consumer audit', artifact.selectedRepair?.MLB_02J_R1_CONSUMER_AUDIT_COMPLETE === 'YES')
check('migration required', artifact.selectedRepair?.MLB_02J_R1_SCHEMA_MIGRATION_REQUIRED === 'YES')
check('migration safety artifact', artifact.migration?.MLB_02J_R1_MIGRATION_SAFETY === 'PASS' && artifact.migration?.productionApplied === false)
check('migration SQL exact', /alter\s+table\s+public\.pick2_game_predictions\s+alter\s+column\s+feature_snapshot_id\s+drop\s+not\s+null/i.test(migration))
check('migration no destructive broad sql', !/drop\s+table|drop\s+column|\bdelete\s+from\b|\bupdate\s+public\.|\binsert\s+into\b|drop\s+constraint|drop\s+index/i.test(migration))
check('application repair', artifact.selectedRepair?.MLB_02J_R1_APPLICATION_CONTRACT_REPAIR === 'READY')
check('frozen rebuild', artifact.frozen24RecoveryDryRun?.MLB_02J_R1_FROZEN24_REBUILD === 'PASS')
check('postrepair dry run', artifact.frozen24RecoveryDryRun?.MLB_02J_R1_FROZEN24_POSTREPAIR_DRY_RUN === 'PASS')
check('projected counts', artifact.frozen24RecoveryDryRun?.postRepairInsertEligible === 24 && artifact.frozen24RecoveryDryRun?.postRepairReuseNoOp === 0 && artifact.frozen24RecoveryDryRun?.postRepairBlockConflict === 0)
check('idempotency', artifact.frozen24RecoveryDryRun?.MLB_02J_R1_POSTREPAIR_IDEMPOTENCY_PROJECTED === 'PASS')
check('provenance', artifact.provenanceAndImmutability?.MLB_02J_R1_PREDICTION_PROVENANCE === 'PASS')
check('immutability', artifact.provenanceAndImmutability?.MLB_02J_R1_PREDICTION_IMMUTABILITY === 'PASS')
check('zero dml', artifact.preservation?.MLB_02J_R1_PRODUCTION_DML === 0)
check('zero ddl', artifact.preservation?.MLB_02J_R1_PRODUCTION_DDL === 0)
check('provider zero', artifact.preservation?.providerCalls === 0)
check('champion preserved', artifact.preservation?.MLB_02J_R1_CHAMPION_PRESERVED === 'PASS')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02j-r1-prediction-feature-snapshot-contract-repair-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02j-r1-prediction-feature-snapshot-contract-repair-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    selectedRepair: artifact.selectedRepair.value,
    migrationPath: artifact.migration.path,
    projectedInsertEligible: artifact.frozen24RecoveryDryRun.postRepairInsertEligible,
    productionDml: artifact.preservation.productionDml,
    productionDdl: artifact.preservation.productionDdl,
  }, null, 2))
}
