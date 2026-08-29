import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json', 'utf8'))
const script = fs.readFileSync('scripts/mlb-data-01d-2025-feature-build-dry-run.mjs', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const flags = artifact.flags
check('certified verdict', artifact.certificationVerdict === 'MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_CERTIFIED')
check('alignment', flags.MLB_DATA_01D_ALIGNMENT === 'PASS')
check('identity baseline', flags.MLB_DATA_01D_IDENTITY_BASELINE === 'PASS')
check('inventory', flags.MLB_DATA_01D_FEATURE_TABLE_INVENTORY_COMPLETE === 'YES' && artifact.featureTableInventory.length >= 8)
check('as-of contract', flags.MLB_DATA_01D_ASOF_CONTRACT_READY === 'YES' && artifact.contracts.asOf.includes('source_game_date < target_game_date'))
check('same-day guard', flags.MLB_DATA_01D_SAMEDAY_ORDERING_GUARD === 'PASS')
check('leakage denylist', flags.MLB_DATA_01D_LEAKAGE_DENYLIST_ENFORCED === 'YES' && artifact.dryRun.leakageViolations === 0)
check('window contract', flags.MLB_DATA_01D_WINDOW_CONTRACT_READY === 'YES')
check('feature domains', flags.MLB_DATA_01D_TEAM_FEATURES_READY === 'YES' && flags.MLB_DATA_01D_STARTER_CORE_FEATURES_READY === 'YES' && flags.MLB_DATA_01D_BATTER_FEATURES_READY === 'YES' && flags.MLB_DATA_01D_FIRST_INNING_HISTORY_READY === 'YES')
check('dry-run rows', artifact.dryRun.targetGames === 2430 && artifact.dryRun.rowCounts.snapshotRows > 0)
check('identity conflicts', artifact.dryRun.identityConflicts === 0)
check('sanity audit', flags.MLB_DATA_01D_FEATURE_SANITY_AUDIT === 'PASS')
check('temporal spotcheck', flags.MLB_DATA_01D_TEMPORAL_SPOTCHECK === 'PASS')
check('write boundary', flags.MLB_DATA_01D_FEATURE_WRITE_AUTHORIZED === 'NO' && flags.MLB_DATA_01D_FEATURE_DRY_RUN_READY_FOR_PERSISTENCE === 'YES')
check('raw immutability', flags.MLB_DATA_01D_RAW_IMMUTABILITY === 'PASS')
check('model/prediction isolation', flags.MODEL_WORK_PERFORMED === 'NO' && flags.PREDICTION_WORK_PERFORMED === 'NO')
check('provider isolation', artifact.safety.providerCalls === 0 && !/api\.sportsdata\.io|statsapi\.mlb\.com|api\.the-odds-api\.com|api\.balldontlie/i.test(script))
check('no feature writes in script', !/from\([^)]*pick2_.*features[^)]*\)\.(insert|upsert|update|delete)\(/.test(script))
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test([script, JSON.stringify(artifact)].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-2025-feature-build-dry-run-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-2025-feature-build-dry-run-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    targetGames: artifact.dryRun.targetGames,
    eligibleGames: artifact.dryRun.eligibleGames,
    snapshotRows: artifact.dryRun.rowCounts.snapshotRows,
  }, null, 2))
}
