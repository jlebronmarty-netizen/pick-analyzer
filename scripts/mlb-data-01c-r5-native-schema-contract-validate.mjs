import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01c-r5-native-identity-foundation-migration.json'
const docPath = 'docs/CERTIFICATION/MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION.md'
const typesPath = 'src/types/pick2-native-identity.ts'
const migrationPath = 'supabase/migrations/202608290001_pick2_mlb_native_identity_foundation_v1.sql'
const errors = []

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function check(label, condition) {
  if (!condition) errors.push(label)
}

const artifact = JSON.parse(read(artifactPath))
const doc = read(docPath)
const types = read(typesPath)
const migration = read(migrationPath)

check('certified verdict', artifact.certificationVerdict === 'MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION_CERTIFIED')
check('R4D authority loaded', artifact.r4dAuthority.SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 === 'NO' && artifact.r4dAuthority.PICK2_NATIVE_GAME_IDENTITY_COVERAGE === '2430 / 2430' && artifact.r4dAuthority.PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE === '1469 / 1469')
check(
  'schema audit complete',
  artifact.currentSchemaGapAudit.R5_CURRENT_SCHEMA_GAP_AUDIT_COMPLETE === 'YES' &&
    artifact.currentSchemaGapAudit.tableCountAudited >= 20 &&
    artifact.currentSchemaGapAudit.legacyBlockingColumns.length === 5
)
check('legacy blocking columns listed', artifact.migration.legacyBlockingColumnsRelaxed.includes('pick2_game_predictions.event_id') && artifact.migration.legacyBlockingColumnsRelaxed.includes('pick2_mlb_pitcher_daily_features.player_id'))
for (const flag of [
  'PICK2_MLB_GAMES_SCHEMA_READY',
  'PICK2_MLB_GAMES_CONSTRAINTS_READY',
  'PICK2_MLB_PLAYERS_SCHEMA_READY',
  'PICK2_MLB_PLAYERS_CONSTRAINTS_READY',
  'RAW_NATIVE_IDENTITY_COLUMNS_READY',
  'R5_RAW_NATIVE_IDENTITY_SEMANTICS_READY',
  'PICK2_TEAM_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_STARTER_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_BULLPEN_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_BATTER_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_OFFENSE_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_MATCHUP_FEATURE_NATIVE_SCHEMA_READY',
  'PICK2_FIRST_INNING_NATIVE_SCHEMA_READY',
  'PICK2_FEATURE_SNAPSHOT_NATIVE_SCHEMA_READY',
  'LEGACY_FK_RELAXATION_SAFE',
  'PICK2_PREDICTION_NATIVE_SCHEMA_READY',
  'PICK2_PREDICTION_NATIVE_IDEMPOTENCY_READY',
  'PICK2_RESULT_NATIVE_SCHEMA_READY',
  'PICK2_NATIVE_RESULT_CONTRACT_READY',
  'PICK2_MARKET_CROSSWALK_SCHEMA_READY',
  'R5_PROVIDER_MARKET_SEPARATION_PRESERVED',
  'NATIVE_IDENTITY_INDEX_PLAN_READY',
  'NATIVE_IDENTITY_SECURITY_MODEL_READY',
]) {
  check(`${flag} yes`, artifact.nativeContracts[flag] === 'YES')
}
check('backfill counts explicit', artifact.backfillPreparation.expectedGames === 2430 && artifact.backfillPreparation.expectedPlayers === 1469 && artifact.backfillPreparation.expectedRawRows === 712528 && artifact.backfillPreparation.expectedPitcherIdentityRows === 712528 && artifact.backfillPreparation.expectedBatterIdentityRows === 712528)
check('projected readiness only after R5A/R5B', artifact.readiness.MLB_DATA_01D_PROJECTED_READY_AFTER_R5A_R5B === 'YES' && artifact.readiness.MLB_DATA_01D_2025_FEATURE_BUILD_READY === 'NO')
check('zero mutation safety', artifact.safety.providerCalls === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.productionDmlMutations === 0 && artifact.safety.migrationApplied === 'NO' && artifact.safety.backfillPerformed === 'NO')
check('runtime types prepared', types.includes('Pick2MlbGameIdentity') && types.includes('Pick2MlbPlayerIdentity') && types.includes('Pick2NativePredictionIdentity') && types.includes('assertPositiveMlbamId'))
check('doc mirrors verdict', doc.includes(artifact.certificationVerdict) && doc.includes('Migration applied: `NO`') && doc.includes('Backfill performed: `NO`'))
check('migration independent of SportsDataIO API identity', !/SPORTSDATAIO_MLB_API_KEY|api\.sportsdata\.io|SportsDataIO PlayerID|SportsDataIO GameID/i.test(migration))

const combined = [JSON.stringify(artifact), doc, types, migration].join('\n')
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(combined))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01c-r5-native-schema-contract-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01c-r5-native-schema-contract-validate',
    status: 'PASS',
    certificationVerdict: artifact.certificationVerdict,
    projected01dReadyAfterR5aR5b: artifact.readiness.MLB_DATA_01D_PROJECTED_READY_AFTER_R5A_R5B,
  }, null, 2))
}
