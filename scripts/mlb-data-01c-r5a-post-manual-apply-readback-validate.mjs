import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01c-r5a-post-manual-apply-readback.json'
const docPath = 'docs/CERTIFICATION/MLB_DATA_01C_R5A_POST_MANUAL_APPLY_PRODUCTION_READBACK.md'
const errors = []

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function check(label, condition) {
  if (!condition) errors.push(label)
}

const artifact = JSON.parse(read(artifactPath))
const doc = read(docPath)

check('certification verdict', artifact.certificationVerdict === 'MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_PRODUCTION_CERTIFIED')
check('alignment pass', artifact.alignment.R5A_POSTAPPLY_ALIGNMENT === 'PASS' && artifact.alignment.productionCommit === artifact.alignment.targetCommit)
check('manual migration state', artifact.manualMigration.R5_NATIVE_IDENTITY_MIGRATION_APPLIED === 'YES_USER_CONFIRMED' && artifact.manualMigration.migrationReapplyByCodex === 'NO')

for (const [flag, expected] of Object.entries({
  PICK2_NATIVE_IDENTITY_TABLES_VISIBLE: 'YES',
  PICK2_MLB_GAMES_READBACK: 'PASS',
  PICK2_MLB_PLAYERS_READBACK: 'PASS',
  PICK2_MLB_GAME_RESULTS_READBACK: 'PASS',
  PICK2_MLB_MARKET_CROSSWALK_READBACK: 'PASS',
  RAW_NATIVE_IDENTITY_COLUMN_READBACK: 'PASS',
  RAW_LEGACY_AND_SOURCE_COLUMNS_PRESERVED: 'YES',
  FEATURE_NATIVE_IDENTITY_COLUMN_READBACK: 'PASS',
  LEGACY_FK_RELAXATION_READBACK: 'PASS',
  LEGACY_COLUMNS_PRESERVED: 'YES',
  PREDICTION_NATIVE_IDENTITY_READBACK: 'PASS',
  PREDICTION_IMMUTABILITY_PRESERVED: 'YES',
  PREDICTION_RESULT_NATIVE_IDENTITY_READBACK: 'PASS',
  NATIVE_IDENTITY_CONSTRAINT_READBACK: 'PASS',
  NATIVE_IDENTITY_INDEX_READBACK: 'PASS_MIGRATION_DEFINED_SCHEMA_CACHE_VISIBLE',
  NATIVE_IDENTITY_SECURITY_READBACK: 'PASS_SERVICE_ROLE_READ_NO_ANON_MUTATION_ATTEMPTED',
  R5A_NATIVE_TABLE_ZERO_ROW_BASELINE: 'PASS',
  R5A_RAW_NATIVE_ID_ZERO_BASELINE: 'PASS',
  R5A_RAW_ROW_STABILITY: 'PASS',
  R5A_RAW_IMMUTABILITY: 'PASS',
  R5A_LEGACY_ISOLATION: 'PASS',
  R5A_UI_CLEAN_START_PRESERVED: 'YES',
  R5B_BACKFILL_PERFORMED: 'NO',
  MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
  MLB_DATA_01D_PROJECTED_READY_AFTER_R5B: 'YES',
})) {
  check(`${flag} ${expected}`, artifact.flags[flag] === expected)
}

check('native table rows remain zero', artifact.readback.counts.nativeGameRows.count === 0 && artifact.readback.counts.nativePlayerRows.count === 0 && artifact.readback.counts.nativeResultRows.count === 0 && artifact.readback.counts.marketCrosswalkRows.count === 0)
check('raw native ids remain zero', artifact.readback.counts.rawMlbamPitcherRows.count === 0 && artifact.readback.counts.rawMlbamBatterRows.count === 0)
check('raw rows preserved', artifact.readback.counts.rawRows.count === 712528 && artifact.readback.counts.raw2026Rows.count === 0)
check('feature/model/prediction rows remain zero', ['pick2_feature_snapshots', 'pick2_mlb_pitcher_daily_features', 'pick2_mlb_batter_daily_features', 'pick2_mlb_team_daily_features', 'pick2_mlb_bullpen_daily_features', 'pick2_mlb_matchup_daily_features', 'pick2_mlb_first_inning_daily_features', 'pick2_model_registry', 'pick2_model_feature_sets', 'pick2_model_versions', 'pick2_model_training_runs', 'pick2_model_validation_runs', 'pick2_game_predictions', 'pick2_prediction_results', 'pick2_market_value_evaluations'].every((table) => artifact.readback.counts[table].count === 0))
check('no provider or Codex production mutations', artifact.safety.providerCalls === 0 && artifact.safety.codexProductionDdlMutations === 0 && artifact.safety.codexProductionDmlMutations === 0)
check('doc mirrors verdict', doc.includes(artifact.certificationVerdict) && doc.includes('R5_NATIVE_IDENTITY_MIGRATION_APPLIED = YES_USER_CONFIRMED'))

const combined = [JSON.stringify(artifact), doc].join('\n')
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(combined))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r5a-post-manual-apply-readback-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r5a-post-manual-apply-readback-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    migrationApplied: artifact.manualMigration.R5_NATIVE_IDENTITY_MIGRATION_APPLIED,
  }, null, 2))
}
