import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-2025-feature-persistence.json'
const scriptPath = 'scripts/mlb-data-01d-2025-feature-persistence.mjs'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const script = fs.readFileSync(scriptPath, 'utf8')

const checks = []
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' })
}

const flags = artifact.flags
const counts = artifact.postwrite?.featureTableCounts ?? {}
const logical = artifact.writeAccounting?.logical ?? {}

check('certification verdict', artifact.certificationVerdict === 'MLB_DATA_01D_2025_FEATURE_PERSISTENCE_CERTIFIED')
check('production alignment preserved', artifact.alignment.productionCommit === artifact.alignment.targetProductionCommit)
check('provider calls zero', artifact.safety.providerCalls === 0 && artifact.alignment.providerCallsMade === 0)
check('schema mutations zero', artifact.safety.productionSchemaMutations === 0)
check('dry-run revalidated', flags.MLB_DATA_01D_DRY_RUN_REVALIDATED === 'YES')
check('prewrite zero baseline', flags.MLB_DATA_01D_PREWRITE_ZERO_BASELINE === 'PASS')
check('identity baseline', flags.MLB_DATA_01D_PREWRITE_IDENTITY_BASELINE === 'PASS')
check('team count', counts.pick2_mlb_team_daily_features === 4498 && flags.MLB_DATA_01D_TEAM_FEATURE_PERSISTENCE === 'PASS')
check('starter count', counts.pick2_mlb_pitcher_daily_features === 4498 && flags.MLB_DATA_01D_STARTER_FEATURE_PERSISTENCE === 'PASS')
check('bullpen count', counts.pick2_mlb_bullpen_daily_features === 4498 && flags.MLB_DATA_01D_BULLPEN_FEATURE_PERSISTENCE === 'PASS')
check('batter count', counts.pick2_mlb_batter_daily_features === 44943 && flags.MLB_DATA_01D_BATTER_FEATURE_PERSISTENCE === 'PASS')
check('matchup count', counts.pick2_mlb_matchup_daily_features === 2249 && flags.MLB_DATA_01D_MATCHUP_FEATURE_PERSISTENCE === 'PASS')
check('first inning count', counts.pick2_mlb_first_inning_daily_features === 2249 && flags.MLB_DATA_01D_FIRST_INNING_FEATURE_PERSISTENCE === 'PASS')
check('snapshot count', counts.pick2_feature_snapshots === 67433 && flags.MLB_DATA_01D_SNAPSHOT_PERSISTENCE === 'PASS')
check('offense logical inserts', logical.offense?.inserts === 4498 && flags.MLB_DATA_01D_OFFENSE_FEATURE_PERSISTENCE === 'PASS')
check('row parity', flags.MLB_DATA_01D_FEATURE_ROW_PARITY === 'PASS')
check('key uniqueness', flags.MLB_DATA_01D_FEATURE_KEY_UNIQUENESS === 'PASS')
check('as-of audit', flags.MLB_DATA_01D_POSTWRITE_ASOF_AUDIT === 'PASS')
check('leakage audit', flags.MLB_DATA_01D_POSTWRITE_LEAKAGE_AUDIT === 'PASS')
check('same-day guard', flags.MLB_DATA_01D_POSTWRITE_SAMEDAY_GUARD === 'PASS')
check('feature sanity', flags.MLB_DATA_01D_POSTWRITE_FEATURE_SANITY === 'PASS')
check('null policy', flags.MLB_DATA_01D_POSTWRITE_NULL_POLICY === 'PASS')
check('sample parity', flags.MLB_DATA_01D_SAMPLE_SIZE_PARITY === 'PASS')
check('idempotency', flags.MLB_DATA_01D_FEATURE_PERSISTENCE_IDEMPOTENCY === 'PASS')
check('raw stability', flags.MLB_DATA_01D_POSTWRITE_RAW_STABILITY === 'PASS')
check('raw immutability', flags.MLB_DATA_01D_POSTWRITE_RAW_IMMUTABILITY === 'PASS')
check('market untouched', flags.MLB_DATA_01D_MARKET_LAYER_UNTOUCHED === 'YES')
check('foundation ready', flags.MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY === 'YES')
check('model dataset prep ready', flags.MLB_DATA_02A_MODEL_DATASET_PREPARATION_READY === 'YES')
check('model work no', flags.MODEL_WORK_PERFORMED === 'NO')
check('prediction work no', flags.PREDICTION_WORK_PERFORMED === 'NO')
check('no provider adapters referenced', !/sportsdataio|the-odds-api|balldontlie|statsapi\.mlb|api\.mlb/i.test(script))
check('no schema mutation calls', !/\b(create|alter|drop|truncate)\s+table\b/i.test(script))
check('no raw table update/delete', !/from\('pick2_raw_mlb_statcast_pitches'\)\.(update|delete|upsert|insert)\(/.test(script))
check('no model mutation calls', !/from\('pick2_model_[^']+'\)\.(insert|upsert|update|delete)\(/.test(script))
check('no prediction mutation calls', !/from\('pick2_(game_predictions|prediction_results|market_value_evaluations)'\)\.(insert|upsert|update|delete)\(/.test(script))

const failures = checks.filter((item) => item.status !== 'PASS')
if (failures.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-2025-feature-persistence-validate', status: 'FAIL', failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'mlb-data-01d-2025-feature-persistence-validate',
  status: 'PASS',
  verdict: artifact.certificationVerdict,
  snapshots: counts.pick2_feature_snapshots,
  featureRows: {
    team: counts.pick2_mlb_team_daily_features,
    starter: counts.pick2_mlb_pitcher_daily_features,
    bullpen: counts.pick2_mlb_bullpen_daily_features,
    batter: counts.pick2_mlb_batter_daily_features,
    matchup: counts.pick2_mlb_matchup_daily_features,
    firstInning: counts.pick2_mlb_first_inning_daily_features,
  },
}, null, 2))
