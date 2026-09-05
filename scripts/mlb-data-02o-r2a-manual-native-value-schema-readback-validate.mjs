import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r2a-manual-native-value-schema-readback.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r2a-manual-native-value-schema-readback.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02O_R2A_NATIVE_VALUE_SCHEMA_PRODUCTION_CERTIFIED')
check('alignment', artifact.repository.MLB_02O_R2A_ALIGNMENT === 'PASS' && artifact.production.PRODUCTION_ALIGNMENT === 'PASS')
check('manual migration', artifact.manualMigration.MLB_02O_R2A_NATIVE_VALUE_MIGRATION_APPLIED === 'YES_USER_CONFIRMED' && artifact.manualMigration.codexReappliedMigration === false)
check('tables', artifact.schema.MLB_02O_R2A_NATIVE_VALUE_TABLE_READBACK === 'PASS' && artifact.legacy.MLB_02O_R2A_LEGACY_TABLE_PRESERVED === 'PASS' && artifact.legacy.MLB_02O_R2A_LEGACY_NATIVE_COEXISTENCE === 'PASS')
check('column contract', artifact.schema.MLB_02O_R2A_NATIVE_VALUE_COLUMN_CONTRACT === 'PASS_USER_SQL_EVIDENCE')
check('fks', Object.values(artifact.schema.fks).every((value) => value === 'PASS_USER_SQL_EVIDENCE'))
check('immutability', artifact.schema.MLB_02O_R2A_UPDATE_GUARD === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_DELETE_GUARD === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_IMMUTABILITY === 'PASS_USER_SQL_EVIDENCE')
check('numeric and checks', artifact.schema.MLB_02O_R2A_PROBABILITY_STORAGE === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_VALUE_NUMERIC_STORAGE === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_AMERICAN_ODDS_STORAGE === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_CHECK_CONTRACT === 'PASS_USER_SQL_EVIDENCE')
check('flags temporal rls indexes', artifact.schema.MLB_02O_R2A_ELIGIBILITY_FLAGS === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_RISK_FLAGS === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_TEMPORAL_FIELDS === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_RLS === 'PASS_USER_SQL_EVIDENCE' && artifact.schema.MLB_02O_R2A_INDEX_CONTRACT === 'PASS_USER_SQL_EVIDENCE')
check('02n rebuild', artifact.dryFit.MLB_02O_R2A_02N_PLAN_REBUILD === 'PASS' && artifact.dryFit.planRows === 386 && artifact.dryFit.eligibleGames === 21 && artifact.dryFit.bookLevelPairs === 193)
check('source linkage', artifact.dryFit.MLB_02O_R2A_SOURCE_LINKAGE_DRY_RUN === 'PASS' && artifact.dryFit.missingSourceLinkages === 0)
check('live dry fit', artifact.dryFit.MLB_02O_R2A_LIVE_SCHEMA_DRY_FIT === 'PASS' && artifact.dryFit.validRows === 386 && artifact.dryFit.invalidRows === 0 && artifact.dryFit.duplicateValueIdentities === 0)
check('math', artifact.dryFit.MLB_02O_R2A_MATH_PAYLOAD_DRY_FIT === 'PASS')
check('classification', artifact.prewriteClassification.MLB_02O_R2A_VALUE_PREWRITE_CLASSIFICATION === 'PASS' && artifact.prewriteClassification.INSERT_ELIGIBLE + artifact.prewriteClassification.REUSE_NO_OP === 386 && artifact.prewriteClassification.BLOCK_CONFLICT === 0)
check('future cap and idempotency', artifact.prewriteClassification.MLB_02O_R2A_FUTURE_VALUE_DML_CAP_READY === 'YES' && artifact.prewriteClassification.VALUE_INSERT_CAP <= 386 && artifact.prewriteClassification.MLB_02O_R2A_VALUE_IDEMPOTENCY_PROJECTED === 'PASS')
check('zero dml ddl providers', artifact.mutations.nativeValueDml === 0 && artifact.mutations.otherProductionDml === 0 && artifact.mutations.codexProductionDdl === 0 && artifact.mutations.providerCalls === 0)
check('readiness', artifact.readiness.MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_READY === 'YES' && artifact.readiness.MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY === 'NO' && artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'NO')
check('audit', audit.includes('MLB-DATA-02O-R2A Manual Native Value Schema Readback') && audit.includes('YES_USER_CONFIRMED'))
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([JSON.stringify(artifact), audit].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02o-r2a-manual-native-value-schema-readback-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02o-r2a-manual-native-value-schema-readback-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    insertEligible: artifact.prewriteClassification.INSERT_ELIGIBLE,
    reuseNoOp: artifact.prewriteClassification.REUSE_NO_OP,
    blockConflict: artifact.prewriteClassification.BLOCK_CONFLICT,
    r3Ready: artifact.readiness.MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_READY,
  }, null, 2))
}
