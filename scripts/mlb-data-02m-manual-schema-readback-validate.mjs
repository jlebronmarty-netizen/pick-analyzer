import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02m-market-schema-migration-manual-readback.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('known verdict', [
  'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED',
  'MLB_DATA_02M_MARKET_SCHEMA_MIGRATION_PRODUCTION_CERTIFIED_DML_READINESS_BLOCKED',
].includes(artifact.certificationVerdict))
check('alignment', artifact.repository?.MLB_02M_MANUAL_READBACK_ALIGNMENT === 'PASS')
check('manual migration', artifact.manualMigration?.MLB_02M_MANUAL_MIGRATION_APPLIED === 'YES_USER_CONFIRMED')
check('no reapply', artifact.manualMigration?.codexReappliedMigration === 'NO')
check('table', artifact.schemaReadback?.MLB_02M_MARKET_OBSERVATION_TABLE_READBACK === 'PASS')
check('columns', artifact.schemaReadback?.MLB_02M_MARKET_OBSERVATION_COLUMN_READBACK === 'PASS')
check('native fk', artifact.schemaReadback?.MLB_02M_NATIVE_GAME_FK_READBACK === 'PASS')
check('crosswalk fk', artifact.schemaReadback?.MLB_02M_MARKET_MAPPING_FK_READBACK === 'PASS')
check('unique identity', artifact.schemaReadback?.MLB_02M_MARKET_OBSERVATION_UNIQUENESS === 'PASS')
check('indexes', artifact.schemaReadback?.MLB_02M_MARKET_INDEX_READBACK === 'PASS')
check('pairing index', artifact.schemaReadback?.MLB_02M_TWO_SIDED_PAIR_STORAGE_SUPPORT === 'PASS')
check('rls', artifact.schemaReadback?.MLB_02M_MARKET_RLS_READBACK === 'PASS')
check('immutability', artifact.schemaReadback?.MLB_02M_MARKET_IMMUTABILITY_READBACK === 'PASS')
check('odds storage', artifact.schemaReadback?.MLB_02M_AMERICAN_ODDS_STORAGE === 'PASS')
check('provenance', artifact.schemaReadback?.MLB_02M_SOURCE_PROVENANCE_STORAGE === 'PASS')
check('layer separation', artifact.schemaReadback?.MLB_02M_MARKET_LAYER_SEPARATION === 'PASS')
check('unmatched exclusion', artifact.certifiedSample?.MLB_02M_UNMATCHED_EVENT_EXCLUSION === 'PASS')
check('predictions', artifact.preservation?.MLB_02M_PREDICTIONS_PRESERVED === 'PASS')
check('temporal/no-vig', artifact.preservation?.MLB_02M_TEMPORAL_JOIN_READINESS === 'PASS' && artifact.preservation?.MLB_02M_NOVIG_INPUT_STORAGE_READY === 'YES')
check('zero work', artifact.preservation?.MLB_02M_VALUE_WORK === 'NO' && artifact.preservation?.MLB_02M_MANUAL_READBACK_DML === 0)
check('ddl accounting', artifact.preservation?.MLB_02M_MANUAL_DDL_ACCOUNTING === 'PASS' && artifact.preservation?.codexProductionDdl === 0)
check('provider calls', artifact.preservation?.MLB_02M_PROVIDER_CALLS === 0)
check('dml readiness honest', artifact.certifiedSample?.exactCertifiedRowsReconstructable || artifact.postSchemaDryRun?.MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_DML_READY === 'NO')

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02m-manual-schema-readback-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02m-manual-schema-readback-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    dmlReady: artifact.postSchemaDryRun.MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_DML_READY,
    blocker: artifact.postSchemaDryRun.blocker,
  }, null, 2))
}
