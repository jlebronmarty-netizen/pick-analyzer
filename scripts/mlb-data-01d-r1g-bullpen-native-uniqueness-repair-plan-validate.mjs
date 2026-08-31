import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1g-bullpen-native-uniqueness-repair-plan.json'
const migrationPath = 'supabase/migrations/202608310001_pick2_mlb_bullpen_native_uniqueness_r1g.sql'
const partialPath = 'docs/CERTIFICATION/mlb-data-01d-r1f-daily-feature-recovery-dml-partial.json'

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'))
const migration = fs.readFileSync(migrationPath, 'utf8')
const lowerMigration = migration.toLowerCase()
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict certified', artifact.certificationVerdict === 'MLB_DATA_01D_R1G_BULLPEN_NATIVE_UNIQUENESS_REPAIR_PLAN_CERTIFIED')
check('r1f partial dependency valid', partial.certificationVerdict === 'MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_PARTIAL')
check('production readback pass', artifact.flags.MLB_DATA_01D_R1G_PRODUCTION_READBACK === 'PASS')
check('baseline pass', artifact.flags.R1G_BASELINE === 'PASS')
check('partial rows preserved', artifact.productionReadback.partialFeatureRows.pick2_feature_snapshots === 67433 && artifact.productionReadback.partialFeatureRows.pick2_mlb_team_daily_features === 4498 && artifact.productionReadback.partialFeatureRows.pick2_mlb_pitcher_daily_features === 4498 && artifact.productionReadback.partialFeatureRows.pick2_mlb_bullpen_daily_features === 0)
check('native identity preserved', artifact.productionReadback.nativeIdentityRows.pick2_mlb_games === 2430 && artifact.productionReadback.nativeIdentityRows.pick2_mlb_players === 1469)
check('model prediction isolation', Object.entries(artifact.productionReadback.modelPredictionIsolation).every(([key, value]) => key === 'champion' ? value === 'NONE' : value === 0))
check('raw and 2026 preserved', artifact.productionReadback.rawState.rowsFromExecutionGuardScan === 712528 && artifact.productionReadback.rawState.uniquePitchIdentities === 712528 && artifact.productionReadback.rawState.duplicatePitchIdentities === 0 && artifact.productionReadback.rawState.raw2026Rows === 0)
check('snapshot preservation', artifact.snapshotPreservation.snapshotRows === 67433 && artifact.snapshotPreservation.exactDigestMatches === 67433 && artifact.snapshotPreservation.digestMismatches === 0 && artifact.snapshotPreservation.duplicateDeterministicIdentities === 0 && artifact.snapshotPreservation.status === 'PASS')
check('manifest authority preserved', artifact.productionReadback.liveManifestAuthority.productionAuthorityReady === true && artifact.productionReadback.liveManifestAuthority.criticalCodeIntegrity === 'PASS')
check('root cause exact constraint', artifact.rootCause.missedLegacyConstraintName === 'pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key' && artifact.rootCause.productionBlocker.includes('pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key'))
check('r1 collision evidence preserved', artifact.rootCause.r1CollisionEvidence.sameTeamSameDateCollisions === 42 && artifact.rootCause.r1CollisionEvidence.affectedGames === 42 && artifact.rootCause.r1CollisionEvidence.affectedTeams === 19 && artifact.rootCause.r1CollisionEvidence.allDistinctTargetGamePk === true)
check('constraint inventory complete', artifact.constraintInventory.status === 'COMPLETE' && artifact.constraintInventory.legacyConstraintName === 'pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key' && artifact.constraintInventory.certifiedReplacementColumns.join('|') === 'target_game_pk|team_id|feature_version')
check('prior migration gap identified', artifact.priorMigrationGap.status === 'IDENTIFIED' && artifact.priorMigrationGap.classification === 'CONSTRAINT_NAME_MISMATCH_AND_NATIVE_KEY_INCLUDED_FEATURE_DATE')
check('transaction bounded', /^\s*begin;\s*/i.test(migration) && /\bcommit;\s*$/i.test(migration))
check('drops only exact failing bullpen constraint', /alter table public\.pick2_mlb_bullpen_daily_features\s+drop constraint if exists pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key;/i.test(migration))
check('creates certified native index', /create unique index if not exists pick2_mlb_bullpen_daily_features_target_game_team_version_key\s+on public\.pick2_mlb_bullpen_daily_features \(target_game_pk, team_id, feature_version\)\s+where target_game_pk is not null;/i.test(migration))
check('no feature_date in replacement key', !/target_game_pk,\s*team_id,\s*feature_date,\s*feature_version/i.test(migration))
check('no broad destructive sql', !/\bdrop\s+table\b|\bdrop\s+column\b|\btruncate\b|\bdelete\b|\bupdate\b|\binsert\b|\bexecute\b|\bformat\s*\(/i.test(lowerMigration))
check('no unrelated table touches', !/pick2_feature_snapshots|pick2_raw_mlb_statcast_pitches|pick2_mlb_games|pick2_mlb_players|pick2_mlb_team_daily_features|pick2_mlb_pitcher_daily_features|pick2_mlb_batter_daily_features|pick2_mlb_matchup_daily_features|pick2_mlb_first_inning_daily_features|pick2_model_|pick2_game_predictions|pick2_prediction_results|pick2_market_value_evaluations/i.test(migration.replace(/pick2_mlb_bullpen_daily_features/g, '')))
check('migration not applied in artifact', artifact.preparedMigration.appliedToProduction === false && artifact.flags.R1G_MIGRATION_APPLIED === 'NO')
check('dml not resumed', artifact.flags.R1G_FEATURE_DML_RESUMED === 'NO' && artifact.safety.featureDmlWritesInR1G === 0)
check('partial resume ready but gated', artifact.flags.R1G_PARTIAL_RESUME_PLAN_READY === 'YES' && artifact.partialResumePlan.requiresSeparateAuthorization === true)
check('feature foundation still blocked', artifact.flags.MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY === 'NO' && artifact.flags.MLB_DATA_02A_MODEL_DATASET_PREPARATION_READY === 'NO')
for (const [flag, expected] of Object.entries({
  R1G_PARTIAL_PRODUCTION_STATE: 'PASS',
  R1G_EXISTING_TEAM_STARTER_STATE: 'PASS',
  R1G_EXISTING_SNAPSHOT_STATE: 'PASS',
  R1G_BULLPEN_CONSTRAINT_INVENTORY_COMPLETE: 'YES',
  R1G_BULLPEN_LEGACY_UNIQUENESS_DEFECT_PROVEN: 'YES',
  R1G_PRIOR_MIGRATION_GAP_IDENTIFIED: 'YES',
  R1G_BULLPEN_DROP_SCOPE_CERTIFIED: 'YES',
  R1G_BULLPEN_NATIVE_UNIQUENESS_CONTRACT: 'PASS',
  R1G_BULLPEN_MIGRATION_EXISTING_DATA_COMPATIBILITY: 'PASS',
  R1G_FORWARD_MIGRATION_READY: 'YES',
  R1G_FORWARD_MIGRATION_NONDESTRUCTIVE: 'PASS',
  R1G_PARTIAL_RESUME_PROJECTION: 'PASS',
  R1G_OFFENSE_RESUME_PROJECTION: 'PASS',
  R1G_BULLPEN_POSTMIGRATION_DRY_RUN: 'PASS',
  R1G_TEAM_STARTER_RESUME_IDEMPOTENCY: 'PASS',
  R1G_SNAPSHOT_RESUME_IDEMPOTENCY: 'PASS',
  R1G_FULL_RESUME_IDEMPOTENCY_PROJECTED: 'PASS',
  R1G_FEATURE_DEFINITIONS_UNCHANGED: 'YES',
  R1G_ASOF_LEAKAGE_CONTRACT: 'PASS',
  R1G_RAW_NATIVE_STATE: 'PASS',
  R1G_MANIFEST_AUTHORITY_STATE: 'PASS',
  R1G_MIGRATION_APPLY_AUTHORIZED: 'NO',
  R1G_FEATURE_DML_RESUME_AUTHORIZED: 'NO',
})) {
  check(`${flag} ${expected}`, artifact.flags[flag] === expected)
}
check('safety zeroes', artifact.safety.providerCalls === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.productionDmlMutations === 0 && artifact.safety.snapshotWrites === 0 && artifact.safety.rawStatcastWrites === 0 && artifact.safety.nativeIdentityWrites === 0 && artifact.safety.modelWork === 'NO' && artifact.safety.predictionWork === 'NO' && artifact.safety.import2026 === 'NO' && artifact.safety.automation === 'NO' && artifact.safety.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1g-bullpen-native-uniqueness-repair-plan-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1g-bullpen-native-uniqueness-repair-plan-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    migrationPath,
    productionCommit: artifact.productionReadback.productionCommit,
    partialRows: artifact.productionReadback.partialFeatureRows,
  }, null, 2))
}
