import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02j-r2-manual-migration-apply-readback.json'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02J_R2_PREDICTION_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED')
check('alignment', artifact.flags?.MLB_02J_R2_MANUAL_READBACK_ALIGNMENT === 'PASS')
check('manual migration', artifact.flags?.MLB_02J_R2_MANUAL_MIGRATION_APPLIED === 'YES_USER_CONFIRMED')
check('migration file', artifact.migrationFileIntegrity?.exactPreparedMigration === true && artifact.migrationFileIntegrity?.unrelatedMutationCount === 0)
check('column nullable', artifact.userManualReadback?.column?.data_type === 'uuid' && artifact.userManualReadback?.column?.is_nullable === 'YES')
check('nullability flag', artifact.flags?.MLB_02J_R2_FEATURE_SNAPSHOT_NULLABILITY === 'PASS')
check('fk preserved', artifact.flags?.MLB_02J_R2_FEATURE_SNAPSHOT_FK_PRESERVED === 'PASS')
check('column state', artifact.flags?.MLB_02J_R2_FEATURE_SNAPSHOT_COLUMN_STATE === 'PASS')
check('native contract', artifact.flags?.MLB_02J_R2_NATIVE_NULL_SNAPSHOT_CONTRACT === 'PASS')
check('legacy compatibility', artifact.flags?.MLB_02J_R2_LEGACY_COMPATIBILITY === 'PASS')
check('frozen rebuild', artifact.flags?.MLB_02J_R2_FROZEN24_REBUILD === 'PASS' && artifact.frozen24?.rowCount === 24)
check('frozen as_of', artifact.frozen24?.asOf === '2026-09-05T01:51:21.667Z')
check('dry run', artifact.flags?.MLB_02J_R2_FROZEN24_POSTMIGRATION_DRY_RUN === 'PASS')
check('dry counts', artifact.frozen24?.postmigrationDryRun?.insertEligible === 24 && artifact.frozen24?.postmigrationDryRun?.reuseNoOp === 0 && artifact.frozen24?.postmigrationDryRun?.blockConflict === 0)
check('dry violations', artifact.frozen24?.postmigrationDryRun?.featureSnapshotNullabilityViolations === 0 && artifact.frozen24?.postmigrationDryRun?.fkViolations === 0 && artifact.frozen24?.postmigrationDryRun?.schemaViolations === 0)
check('identity', artifact.flags?.MLB_02J_R2_PREDICTION_IDENTITY_PRESERVED === 'PASS' && artifact.frozen24?.duplicateIdentities === 0)
check('idempotency', artifact.flags?.MLB_02J_R2_PREDICTION_IDEMPOTENCY_PROJECTED === 'PASS' && artifact.frozen24?.idempotencyProjection?.secondExecution?.reuseNoOp === 24)
check('zero predictions', artifact.flags?.MLB_02J_R2_PREDICTION_ZERO_STATE === 'PASS' && artifact.productionReadback?.counts?.predictions === 0 && artifact.productionReadback?.counts?.predictionResults === 0 && artifact.productionReadback?.counts?.marketValueRows === 0)
check('champion', artifact.flags?.MLB_02J_R2_CHAMPION_PRESERVED === 'PASS' && artifact.productionReadback?.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('foundation', artifact.flags?.MLB_02J_R2_DATA_FOUNDATION_PRESERVED === 'PASS' && artifact.productionReadback?.counts?.raw2025 === 712528 && artifact.productionReadback?.counts?.raw2026 === 622364)
check('manual ddl accounting', artifact.flags?.MLB_02J_R2_MANUAL_DDL_ACCOUNTING === 'PASS' && artifact.mutationAccounting?.userManualProductionDdl === 'YES_USER_CONFIRMED')
check('codex zero mutation', artifact.mutationAccounting?.codexProductionDdl === 0 && artifact.mutationAccounting?.codexProductionDml === 0)
check('no prediction/value writes', artifact.mutationAccounting?.predictionWrites === 0 && artifact.mutationAccounting?.predictionResultWrites === 0 && artifact.mutationAccounting?.marketValueWrites === 0)
check('provider calls', artifact.flags?.MLB_02J_R2_PROVIDER_CALLS === 0 && artifact.mutationAccounting?.providerCalls === 0)

if (errors.length) {
  console.error(JSON.stringify({
    validator: 'mlb-data-02j-r2-manual-migration-apply-readback-validate',
    status: 'FAIL',
    errors,
  }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02j-r2-manual-migration-apply-readback-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    insertEligible: artifact.frozen24.postmigrationDryRun.insertEligible,
    reuseNoOp: artifact.frozen24.postmigrationDryRun.reuseNoOp,
    blockConflict: artifact.frozen24.postmigrationDryRun.blockConflict,
  }, null, 2))
}
