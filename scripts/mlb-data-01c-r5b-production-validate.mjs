import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json'
const scriptPath = 'scripts/mlb-data-01c-r5b-2025-native-identity-backfill.mjs'
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const script = fs.readFileSync(scriptPath, 'utf8')
const flags = artifact.flags
const counts = artifact.finalCounts
const dml = artifact.dmlAccounting
const safety = artifact.safety

check('certified verdict', artifact.certificationVerdict === 'MLB_DATA_01C_R5B_2025_NATIVE_IDENTITY_BACKFILL_CERTIFIED')
check('2430 native games', counts.nativeGameRows === 2430)
check('1469 native players', counts.nativePlayerRows === 1469)
check('712528 pitcher identity rows', counts.rawMlbamPitcherRows === 712528 && counts.rawMlbamPitcherNullRows === 0)
check('712528 batter identity rows', counts.rawMlbamBatterRows === 712528 && counts.rawMlbamBatterNullRows === 0)
check('zero identity conflicts', artifact.dataHealthReadback.identityConflicts === 0)
check('cross-domain parity', flags.R5B_GAME_IDENTITY_PARITY === 'PASS' && flags.R5B_PITCHER_IDENTITY_PARITY === 'PASS' && flags.R5B_BATTER_IDENTITY_PARITY === 'PASS')
check('raw stability', flags.R5B_RAW_ROW_STABILITY === 'PASS')
check('raw immutability', flags.R5B_RAW_IMMUTABILITY === 'PASS')
check('legacy field preservation', flags.R5B_LEGACY_MAPPING_FIELDS_UNTOUCHED === 'YES')
check('idempotency', flags.R5B_NATIVE_BACKFILL_IDEMPOTENCY === 'PASS')
check('feature/model/prediction isolation', flags.FEATURE_BUILD_PERFORMED === 'NO' && flags.MODEL_WORK_PERFORMED === 'NO' && flags.PREDICTION_WORK_PERFORMED === 'NO')
check('2026 isolation', counts.raw2026Rows === 0 && safety.import2026 === 'NO')
check('provider isolation', safety.providerCalls === 0 && safety.sportsDataIoCalls === 0 && safety.mlbOfficialCalls === 0 && safety.theOddsApiCalls === 0 && safety.ballDontLieCalls === 0)
check('schema isolation', safety.productionSchemaMutations === 0 && safety.migrationReapply === 'NO')
check('result and market untouched', counts.nativeResultRows === 0 && counts.marketCrosswalkRows === 0 && flags.R5B_MARKET_LAYER_UNTOUCHED === 'YES')
check('01D readiness', flags.R5B_01D_NATIVE_IDENTITY_PREREQUISITES === 'PASS' && flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'YES')
check('DML accounting present', dml.nativeGamesInserted + dml.nativeGamesReused === 2430 && dml.nativePlayersInserted + dml.nativePlayersReused === 1469 && dml.rawPitcherRowsEvaluated === 712528 && dml.rawBatterRowsEvaluated === 712528)
check('no provider fetches in script', !/statsapi\.mlb\.com|api\.sportsdata\.io|api\.the-odds-api\.com|api\.balldontlie/i.test(script))
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test([script, JSON.stringify(artifact)].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r5b-production-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r5b-production-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    nativeGames: counts.nativeGameRows,
    nativePlayers: counts.nativePlayerRows,
    pitcherRows: counts.rawMlbamPitcherRows,
    batterRows: counts.rawMlbamBatterRows,
    featureBuildReady: flags.MLB_DATA_01D_2025_FEATURE_BUILD_READY,
  }, null, 2))
}
