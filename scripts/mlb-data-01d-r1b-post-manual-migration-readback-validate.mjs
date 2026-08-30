import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1b-post-manual-migration-readback.json', 'utf8'))
const checks = []
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' })
}

const flags = artifact.flags
check('alignment', flags.R1B_POSTAPPLY_ALIGNMENT === 'PASS')
check('manual migration recorded', flags.R1B_NATIVE_UNIQUENESS_MIGRATION_APPLIED === 'YES_USER_CONFIRMED')
check('snapshots preserved', flags.R1B_EXISTING_SNAPSHOTS_PRESERVED === 'YES')
check('daily zero', flags.R1B_DAILY_FEATURE_ZERO_STATE === 'PASS')
check('raw native preserved', flags.R1B_RAW_NATIVE_STATE_PRESERVED === 'PASS')
check('raw count', artifact.partialState.pick2_raw_mlb_statcast_pitches === 712528)
check('pitcher native parity', artifact.partialState.pick2_raw_mlb_statcast_pitches_mlbam_pitcher === 712528)
check('batter native parity', artifact.partialState.pick2_raw_mlb_statcast_pitches_mlbam_batter === 712528)
check('2026 isolation', artifact.partialState.pick2_raw_mlb_statcast_pitches_2026 === 0)
check(
  'recovery dry run or explicit partial projection',
  flags.R1B_POSTMIGRATION_RECOVERY_DRY_RUN === 'PASS'
    || (
      artifact.certificationVerdict === 'MLB_DATA_01D_R1B_FEATURE_NATIVE_UNIQUENESS_MIGRATION_READBACK_PARTIAL'
      && flags.R1B_POSTMIGRATION_RECOVERY_DRY_RUN === 'PARTIAL_PROJECTION_ONLY'
    ),
)
check('native key uniqueness', flags.R1B_POSTMIGRATION_NATIVE_KEY_UNIQUENESS === 'PASS')
check('sameday repair projection', flags.R1B_GAMEPK_SAMEDAY_REPAIR_READBACK === 'PASS')
check('asof leakage', flags.R1B_ASOF_LEAKAGE_STATE === 'PASS')
check('idempotency', flags.R1B_RESUME_IDEMPOTENCY_PROJECTED === 'PASS')
check('dml unauthorized', flags.MLB_DATA_01D_R1B_FEATURE_DML_RESUME_AUTHORIZED === 'NO')
check('provider calls zero', artifact.safety.providerCalls === 0 && artifact.alignment.providerCallsMade === 0)
check('codex ddl zero', artifact.safety.codexProductionDdlMutations === 0)
check('codex dml zero', artifact.safety.codexProductionDmlMutations === 0)
check('model prediction boundary', flags.MODEL_PREDICTION_BOUNDARY === 'PASS')

const failures = checks.filter((item) => item.status !== 'PASS')
if (failures.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1b-post-manual-migration-readback-validate', status: 'FAIL', failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-01d-r1b-post-manual-migration-readback-validate',
  status: 'PASS',
  verdict: artifact.certificationVerdict,
  catalogReadback: artifact.catalogReadback.available ? 'AVAILABLE' : 'UNAVAILABLE',
}, null, 2))
