import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback-audit.md', 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(artifact.certificationVerdict === 'MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_PRODUCTION_CERTIFIED', 'classification mismatch')
assert(artifact.repository.MLB_02P_R2C_MANUAL_ALIGNMENT === 'PASS', 'alignment failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.production.commit === '4c9442e8a3e894d7bd42681e96126f6d8c56e9e2', 'production commit mismatch')
assert(artifact.manualMigration.MLB_02P_R2C_MANUAL_MIGRATION_APPLIED === 'YES_USER_CONFIRMED', 'manual migration not confirmed')
assert(artifact.manualMigration.codexReappliedMigration === 'NO', 'migration was reapplied by Codex')
assert(artifact.schema.MLB_02P_R2C_TABLE_READBACK === 'PASS', 'table readback failed')
assert(artifact.schema.MLB_02P_R2C_COLUMN_CONTRACT === 'PASS', 'column contract failed')
assert(artifact.schema.MLB_02P_R2C_PREDICTION_FK === 'PASS', 'prediction fk failed')
assert(artifact.schema.MLB_02P_R2C_VALUE_FK === 'PASS', 'value fk failed')
assert(artifact.schema.MLB_02P_R2C_GAME_FK === 'PASS', 'game fk failed')
assert(artifact.schema.MLB_02P_R2C_IDENTITY_UNIQUENESS === 'PASS', 'identity unique failed')
assert(artifact.schema.MLB_02P_R2C_UPDATE_GUARD === 'PASS', 'update guard failed')
assert(artifact.schema.MLB_02P_R2C_DELETE_GUARD === 'PASS', 'delete guard failed')
assert(artifact.schema.MLB_02P_R2C_IMMUTABILITY === 'PASS', 'immutability failed')
assert(artifact.schema.MLB_02P_R2C_NUMERIC_STORAGE === 'PASS', 'numeric storage failed')
assert(artifact.schema.MLB_02P_R2C_AMERICAN_ODDS_STORAGE === 'PASS', 'american odds storage failed')
assert(artifact.schema.MLB_02P_R2C_CHECK_CONTRACT === 'PASS', 'check contract failed')
assert(artifact.schema.MLB_02P_R2C_RLS === 'PASS', 'rls failed')
assert(artifact.schema.MLB_02P_R2C_INDEX_CONTRACT === 'PASS', 'index contract failed')
assert(artifact.schema.MLB_02P_R2C_OFFICIAL_PICK_ZERO_BASELINE === 'PASS', 'zero baseline failed')
assert(artifact.frozenDryFit.MLB_02P_R2C_FROZEN_PICK_REBUILD === 'PASS', 'frozen rebuild failed')
assert(artifact.frozenDryFit.frozenPickCount === 5, 'frozen count mismatch')
assert(artifact.frozenDryFit.validRows === 5, 'valid dry-fit mismatch')
assert(artifact.frozenDryFit.invalidRows.length === 0, 'invalid dry-fit rows')
assert(artifact.frozenDryFit.duplicateOfficialPickIdentity === 0, 'duplicate identities')
assert(artifact.frozenDryFit.missingPredictionLinkages === 0, 'missing prediction links')
assert(artifact.frozenDryFit.missingValueLinkages === 0, 'missing value links')
assert(artifact.frozenDryFit.missingGameLinkages === 0, 'missing game links')
assert(artifact.frozenDryFit.MLB_02P_R2C_SOURCE_LINKAGE === 'PASS', 'source linkage failed')
assert(artifact.frozenDryFit.MLB_02P_R2C_LIVE_SCHEMA_DRY_FIT === 'PASS', 'live schema dry fit failed')
assert(artifact.frozenDryFit.MLB_02P_R2C_PAYLOAD_DRY_FIT === 'PASS', 'payload dry fit failed')
assert(artifact.prewrite.INSERT_ELIGIBLE + artifact.prewrite.REUSE_NO_OP === 5, 'prewrite coverage mismatch')
assert(artifact.prewrite.BLOCK_CONFLICT === 0, 'block conflict')
assert(artifact.prewrite.MLB_02P_R2C_PICK_PREWRITE_CLASSIFICATION === 'PASS', 'prewrite classification failed')
assert(artifact.prewrite.OFFICIAL_PICK_INSERT_CAP <= 5, 'dml cap exceeded')
assert(artifact.prewrite.MLB_02P_R2C_FUTURE_PICK_DML_CAP_READY === 'YES', 'future cap not ready')
assert(artifact.idempotency.MLB_02P_R2C_IDEMPOTENCY_PROJECTED === 'PASS', 'idempotency failed')
assert(artifact.boundaries.MLB_02P_R2C_OFFICIAL_PICK_DML === 0, 'official pick dml occurred')
assert(artifact.boundaries.MLB_02P_R2C_OTHER_PRODUCTION_DML === 0, 'other dml occurred')
assert(artifact.boundaries.MLB_02P_R2C_DDL_ACCOUNTING === 'PASS', 'ddl accounting failed')
assert(artifact.boundaries.codexProductionDdl === 0, 'codex ddl occurred')
assert(artifact.boundaries.MLB_02P_R2C_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(artifact.boundaries.MLB_02P_R2C_VALUE_BOARD_PUBLICATION === 'NO', 'value board published')
assert(artifact.readiness.MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY === 'YES', 'persistence not ready')
assert(audit.includes('Reapplied by Codex: NO'), 'audit missing no-reapply statement')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-r2c-manual-official-pick-schema-apply-readback-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  insertEligible: artifact.prewrite.INSERT_ELIGIBLE,
  persistenceReady: artifact.readiness.MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY,
}, null, 2))
