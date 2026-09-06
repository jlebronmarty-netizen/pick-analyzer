import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2a-official-pick-table-schema-readback.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-r2a-official-pick-table-schema-readback-audit.md', 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert([
  'MLB_DATA_02P_R2A_OFFICIAL_PICK_TABLE_ABSENCE_CERTIFIED',
  'MLB_DATA_02P_R2A_OFFICIAL_PICK_SCHEMA_CACHE_DEFECT_CERTIFIED',
  'MLB_DATA_02P_R2A_OFFICIAL_PICK_TABLE_NAME_MISMATCH_CERTIFIED',
  'MLB_DATA_02P_R2A_OFFICIAL_PICK_SCHEMA_DIAGNOSIS_BLOCKED',
].includes(artifact.certificationVerdict), 'invalid classification')
assert(artifact.repository.MLB_02P_R2A_ALIGNMENT === 'PASS', 'alignment failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.production.commit === '728ed2a1771f522ffab1b29363f40ab31b4bfb29', 'production commit mismatch')
assert(artifact.repoSchema.intendedTableName === 'public.pick2_mlb_official_picks', 'intended table mismatch')
assert(['FOUND', 'NOT_FOUND'].includes(artifact.repoSchema.MLB_02P_R2A_REPO_TABLE_DEFINITION), 'repo definition invalid')
assert(artifact.repoSchema.MLB_02P_R2A_TABLE_NAME_CONTRACT === 'PASS', 'table name contract failed')
assert(['PGRST205_SCHEMA_CACHE_MISS', 'REST_VISIBLE'].includes(artifact.rest.intended.state), 'expected intended REST result')
assert(['PGRST205_SCHEMA_CACHE_MISS', 'REST_VISIBLE'].includes(artifact.rest.MLB_02P_R2A_REST_VISIBILITY), 'rest visibility mismatch')
assert(artifact.diagnosis.MLB_02P_R2A_OFFICIAL_PICK_MIGRATION_STATE === 'NO_NATIVE_OFFICIAL_PICK_TABLE_MIGRATION_FOUND', 'migration state mismatch')
assert(artifact.contracts.MLB_02P_R2A_REQUIRED_SCHEMA_CONTRACT === 'READY', 'schema contract not ready')
assert(artifact.contracts.MLB_02P_R2A_REQUIRED_FK_CONTRACT === 'READY', 'fk contract not ready')
assert(artifact.contracts.MLB_02P_R2A_REQUIRED_IMMUTABILITY_CONTRACT === 'READY', 'immutability contract not ready')
assert(artifact.frozenSet.count === 5, 'frozen set count mismatch')
assert(artifact.frozenSet.MLB_02P_R2A_FROZEN_PICK_SET_PRESERVED === 'PASS', 'frozen set not preserved')
assert(artifact.frozenSet.MLB_02P_R2A_POLICY_PRESERVED === 'PASS', 'policy not preserved')
assert(artifact.boundaries.MLB_02P_R2A_OFFICIAL_PICK_DML === 0, 'official pick dml occurred')
assert(artifact.boundaries.MLB_02P_R2A_PRODUCTION_MUTATIONS === 0, 'production mutation occurred')
assert(artifact.boundaries.MLB_02P_R2A_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(['USEFUL_FOR_FUTURE_R2', 'REDUNDANT', 'PARTIAL'].includes(artifact.untrackedHelpers.MLB_02P_R2A_UNTRACKED_HELPER_STATE), 'helper state invalid')
assert(audit.includes('Official Pick DML: 0'), 'audit missing zero dml')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-r2a-official-pick-table-schema-readback-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  rootCause: artifact.diagnosis.MLB_02P_R2A_ROOT_CAUSE,
}, null, 2))
