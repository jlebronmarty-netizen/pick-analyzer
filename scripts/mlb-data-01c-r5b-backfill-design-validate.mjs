import fs from 'node:fs'

const scriptPath = 'scripts/mlb-data-01c-r5b-2025-native-identity-backfill.mjs'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01c-r5-native-identity-foundation-migration.json'
const script = fs.readFileSync(scriptPath, 'utf8')
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('script exists and is dry-run by default', script.includes('const dryRun = !execute') && script.includes('NO_WRITES_DRY_RUN_ONLY'))
check('execution is separately authorized', script.includes("MLB_DATA_01C_R5B_NATIVE_BACKFILL_AUTHORIZED") && script.includes("!== 'true'"))
check('checkpoint contract present', script.includes('checkpointPath') && script.includes('loadCheckpoint') && script.includes('saveCheckpoint'))
check('batch size contract present', script.includes('MLB_DATA_01C_R5B_BATCH_SIZE') && script.includes('5000'))
check('source contract reads existing raw only', script.includes("from('pick2_raw_mlb_statcast_pitches')") && !script.includes('fetch(') && !/statsapi\.mlb\.com|api\.sportsdata\.io|api\.the-odds-api\.com/i.test(script))
check('expected counts encoded', script.includes('rawRows: 712528') && script.includes('games: 2430') && script.includes('players: 1469') && script.includes('pitcherIdentityRows: 712528') && script.includes('batterIdentityRows: 712528'))
check('conflict contract encoded', script.includes('REUSE_NO_OP') && script.includes('BLOCK_CONFLICT') && script.includes('UPDATE_ELIGIBLE'))
check('execution body deferred', script.includes('R5B_EXECUTION_BODY_DEFERRED_TO_SEPARATE_AUTHORIZED_PHASE'))
check('artifact marks backfill ready', artifact.backfillPreparation.R5B_2025_NATIVE_BACKFILL_SCRIPT_READY === 'YES' && artifact.backfillPreparation.R5B_BACKFILL_CHECKPOINT_CONTRACT_READY === 'YES' && artifact.backfillPreparation.R5B_NATIVE_BACKFILL_IDEMPOTENCY_READY === 'YES')
check('R5 did not perform backfill', artifact.safety.backfillPerformed === 'NO' && artifact.safety.productionDmlMutations === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r5b-backfill-design-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r5b-backfill-design-validate',
    status: 'PASS',
    R5B_2025_NATIVE_BACKFILL_SCRIPT_READY: 'YES',
    backfillPerformed: 'NO',
  }, null, 2))
}
