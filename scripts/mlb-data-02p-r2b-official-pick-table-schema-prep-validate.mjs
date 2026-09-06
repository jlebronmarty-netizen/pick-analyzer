import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2b-official-pick-table-schema-prep.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2b-official-pick-table-schema-prep-audit.md', 'utf8')
const migration = fs.readFileSync('supabase/migrations/202609050004_pick2_mlb_official_picks_v1.sql', 'utf8')
const typeContract = fs.readFileSync('src/types/pick2-official-picks.ts', 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(artifact.certificationVerdict === 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP_CERTIFIED', 'classification mismatch')
assert(artifact.publication.state === 'PASS', 'publication state failed')
assert(artifact.production.MLB_02P_R2B_PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.diagnosis.acceptedRootCause === 'TABLE_NOT_CREATED', 'root cause mismatch')
assert(artifact.table.name === 'public.pick2_mlb_official_picks', 'table name mismatch')
assert(artifact.table.MLB_02P_R2B_FIELD_CONTRACT === 'PASS', 'field contract failed')
assert(artifact.fks.MLB_02P_R2B_PREDICTION_FK === 'PASS', 'prediction fk failed')
assert(artifact.fks.MLB_02P_R2B_VALUE_FK === 'PASS', 'value fk failed')
assert(artifact.fks.MLB_02P_R2B_GAME_FK === 'PASS', 'game fk failed')
assert(artifact.identity.MLB_02P_R2B_IDENTITY_CONTRACT === 'PASS', 'identity contract failed')
assert(artifact.identity.MLB_02P_R2B_IDENTITY_UNIQUE === 'PASS', 'unique identity failed')
assert(artifact.immutability.MLB_02P_R2B_IMMUTABILITY_CONTRACT === 'PASS', 'immutability failed')
assert(artifact.immutability.MLB_02P_R2B_MUTATION_GUARDS === 'PASS', 'mutation guards failed')
assert(artifact.checks.MLB_02P_R2B_CHECK_CONTRACT === 'PASS', 'check contract failed')
assert(artifact.policy.MLB_02P_R2B_POLICY_PROVENANCE === 'PASS', 'policy provenance failed')
assert(artifact.policy.MLB_02P_R2B_POLICY_EVIDENCE_STORAGE === 'PASS', 'policy evidence storage failed')
assert(artifact.rls.MLB_02P_R2B_RLS_CONTRACT === 'PASS', 'rls failed')
assert(artifact.indexes.MLB_02P_R2B_INDEX_PLAN === 'PASS', 'index plan failed')
assert(artifact.migration.path === 'supabase/migrations/202609050004_pick2_mlb_official_picks_v1.sql', 'migration path mismatch')
assert(artifact.migration.MLB_02P_R2B_MIGRATION_SAFETY === 'PASS', 'migration safety failed')
assert(artifact.application.MLB_02P_R2B_APPLICATION_TYPE === 'READY', 'application type not ready')
assert(artifact.application.MLB_02P_R2B_INSERT_CLASSIFIER === 'READY', 'classifier not ready')
assert(artifact.application.MLB_02P_R2B_READBACK_CONTRACT === 'READY', 'readback contract not ready')
assert(artifact.frozenDryFit.MLB_02P_R2B_FROZEN_PICK_REBUILD === 'PASS', 'frozen rebuild failed')
assert(artifact.frozenDryFit.sourceFrozenRows === 5, 'frozen row count mismatch')
assert(artifact.frozenDryFit.validRows === 5, 'valid dry fit mismatch')
assert(artifact.frozenDryFit.invalidRows.length === 0, 'invalid dry fit rows')
assert(artifact.frozenDryFit.duplicateOfficialPickIdentity === 0, 'duplicate identities')
assert(artifact.frozenDryFit.missingPredictionLinkages === 0, 'missing prediction linkages')
assert(artifact.frozenDryFit.missingValueLinkages === 0, 'missing value linkages')
assert(artifact.frozenDryFit.missingGameLinkages === 0, 'missing game linkages')
assert(artifact.frozenDryFit.MLB_02P_R2B_PAYLOAD_DRY_FIT === 'PASS', 'payload dry fit failed')
assert(artifact.idempotency.MLB_02P_R2B_IDEMPOTENCY_PROJECTED === 'PASS', 'idempotency failed')
assert(artifact.valueBoard.MLB_02P_R2B_VALUE_BOARD_COMPATIBILITY === 'PASS', 'value board compatibility failed')
assert(artifact.boundaries.officialPickDml === 0, 'official pick dml occurred')
assert(artifact.boundaries.otherProductionDml === 0, 'other dml occurred')
assert(artifact.boundaries.productionDdl === 0, 'ddl occurred')
assert(artifact.boundaries.providerCalls === 0, 'provider calls occurred')
assert(artifact.readiness.MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_MIGRATION_APPLY_READY === 'YES', 'r2c not ready')
assert(artifact.readiness.MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY === 'NO', 'persistence should not be ready before migration apply')
assert(migration.includes('create table if not exists public.pick2_mlb_official_picks'), 'migration missing table')
assert(migration.includes('decision_at timestamptz not null'), 'migration missing not-null decision_at')
assert(!/\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\s+from\b|\binsert\s+into\b/i.test(migration), 'migration contains forbidden broad DDL/DML')
assert(typeContract.includes('Pick2MlbOfficialPickClassification'), 'type classifier missing')
assert(audit.includes('Applied: NO'), 'audit must state migration not applied')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit + migration + typeContract), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-r2b-official-pick-table-schema-prep-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  migrationPath: artifact.migration.path,
  validRows: artifact.frozenDryFit.validRows,
  r2cReady: artifact.readiness.MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_MIGRATION_APPLY_READY,
}, null, 2))
