import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1-feature-persistence-key-repair.json', 'utf8'))
const checks = []
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' })
}

const flags = artifact.flags
check('blocked verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR_BLOCKED')
check('baseline pass', flags.MLB_DATA_01D_R1_BASELINE === 'PASS')
check('partial state certified', flags.MLB_DATA_01D_R1_PARTIAL_STATE_CERTIFIED === 'YES')
check('constraint inventory', flags.MLB_DATA_01D_R1_UNIQUE_CONSTRAINT_INVENTORY_COMPLETE === 'YES')
check('legacy defect proven', flags.MLB_DATA_01D_R1_LEGACY_KEY_DEFECT_PROVEN === 'YES')
check('snapshot state', flags.MLB_DATA_01D_R1_EXISTING_SNAPSHOT_STATE === 'PASS')
check('snapshot reuse policy', flags.MLB_DATA_01D_R1_SNAPSHOT_RECOVERY_POLICY_READY === 'YES')
check('repair required', flags.DAILY_FEATURE_CONSTRAINT_REPAIR_REQUIRED === 'YES')
check('migration blocked', flags.MLB_DATA_01D_R1_MIGRATION_READY === 'NO')
check('schema apply unauthorized', flags.MLB_DATA_01D_R1_SCHEMA_APPLY_AUTHORIZED === 'NO')
check('dml resume unauthorized', flags.MLB_DATA_01D_R1_DML_RESUME_AUTHORIZED === 'NO')
check('provider calls zero', artifact.safety.providerCalls === 0)
check('schema mutations zero', artifact.safety.productionSchemaMutations === 0)
check('dml mutations zero in R1', artifact.safety.productionDmlMutations === 0)

const failures = checks.filter((check) => check.status !== 'PASS')
if (failures.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1-feature-persistence-key-repair-validate', status: 'FAIL', failures }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({
  validator: 'mlb-data-01d-r1-feature-persistence-key-repair-validate',
  status: 'PASS',
  verdict: artifact.certificationVerdict,
  blocker: artifact.blocker,
}, null, 2))
