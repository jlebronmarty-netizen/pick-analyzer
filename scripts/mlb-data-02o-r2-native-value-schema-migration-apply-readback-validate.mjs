import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02o-r2-native-value-schema-migration-apply-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-r2-native-value-schema-migration-apply-readback.md'
const migrationPath = 'supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('blocked verdict', artifact.certificationVerdict === 'MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READBACK_BLOCKED')
check('blocked reason', ['APPROVED_PRODUCTION_SQL_APPLY_CHANNEL_UNAVAILABLE', 'CATALOG_SCHEMA_READBACK_CHANNEL_UNAVAILABLE'].includes(artifact.blocker))
check('repository alignment', artifact.repository.branch === 'main' && artifact.repository.localHead === '46f5c70666e8f05c89203c6da417bd88aea7d05b' && artifact.repository.originMain === artifact.repository.localHead)
check('production alignment', artifact.production.PRODUCTION_ALIGNMENT === 'PASS' && artifact.production.commit === artifact.repository.localHead)
check('r1 scope', artifact.repository.MLB_02O_R2_R1_COMMIT_SCOPE_CERTIFIED === 'YES')
check('migration integrity', artifact.migration.MLB_02O_R2_MIGRATION_FILE_INTEGRITY === 'PASS')
check('migration not applied by Codex', artifact.migration.state.startsWith('NOT_APPLIED') && artifact.mutations.productionDdl === 0)
check('no dml', artifact.mutations.nativeValueDml === 0 && artifact.mutations.otherProductionDml === 0)
check('no providers', artifact.mutations.providerCalls === 0)
check('no official/value board', artifact.mutations.officialPicks === 0 && artifact.mutations.valueBoard === 'NO')
check('native prestate', ['NOT_PRESENT', 'REST_VISIBLE_CATALOG_READBACK_REQUIRED'].includes(artifact.nativeValueTable.prestate))
check('postmigration not fully certified', ['NOT_RUN_MIGRATION_NOT_APPLIED', 'REST_PROJECTION_PASS_CATALOG_TYPES_NOT_VERIFIED'].includes(artifact.postMigrationReadback.columnContract))
check('r3 not ready', artifact.readiness.MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_READY === 'NO')
check('02p/02q not ready', artifact.readiness.MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY === 'NO' && artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'NO')
check('migration additive target', migration.includes('create table if not exists public.pick2_mlb_market_value_evaluations'))
check('legacy untouched in migration', !/alter\s+table\s+public\.pick2_market_value_evaluations|drop\s+table\s+public\.pick2_market_value_evaluations/i.test(migration))
check('no dml in migration', !/insert\s+into|update\s+public\.|delete\s+from|truncate/i.test(migration))
check('audit', audit.includes('MLB-DATA-02O-R2 Native Value Schema Migration Apply Readback') && audit.includes(artifact.blocker))
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([JSON.stringify(artifact), audit].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02o-r2-native-value-schema-migration-apply-readback-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02o-r2-native-value-schema-migration-apply-readback-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    migrationState: artifact.migration.state,
    blocker: artifact.blocker,
  }, null, 2))
}
