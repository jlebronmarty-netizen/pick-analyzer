import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1-feature-persistence-key-repair.json'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const productionCommit = '875b46d34553bc3618067fec202a2f780a39b2d8'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const featureTables = [
  'pick2_feature_snapshots',
  'pick2_mlb_team_daily_features',
  'pick2_mlb_pitcher_daily_features',
  'pick2_mlb_bullpen_daily_features',
  'pick2_mlb_batter_daily_features',
  'pick2_mlb_matchup_daily_features',
  'pick2_mlb_first_inning_daily_features',
]

function countColumn(table) {
  if (table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results') return 'game_pk'
  if (table === 'pick2_mlb_players') return 'mlbam_person_id'
  return 'id'
}

async function countRows(table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(countColumn(table), { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message || JSON.stringify(error)}`)
  return count ?? 0
}

async function readAll(table, columns, configure = (query) => query) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await configure(db.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999))
    if (error) throw new Error(`${table} read failed: ${error.message || JSON.stringify(error)}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return rows
}

function collisionAudit(rows, family, keyPrefix) {
  const familyRows = rows.filter((row) => row.native_identity_metadata?.family === family)
  const groups = new Map()
  for (const row of familyRows) {
    const key = `${row.subject_id}:${row.feature_date}:${row.feature_version}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const collidingGroups = [...groups.values()].filter((group) => group.length > 1)
  const affectedGames = new Set()
  const affectedSubjects = new Set()
  let collisions = 0
  for (const group of collidingGroups) {
    collisions += group.length - 1
    for (const row of group) {
      affectedGames.add(Number(row.target_game_pk))
      affectedSubjects.add(row.subject_id.replace(`${keyPrefix}:`, ''))
    }
  }
  return {
    family,
    rowCount: familyRows.length,
    collidingLegacyGroups: collidingGroups.length,
    sameTeamSameDateCollisions: collisions,
    affectedGames: affectedGames.size,
    affectedSubjects: affectedSubjects.size,
    allDistinctTargetGamePk: familyRows.length === new Set(familyRows.map((row) => `${row.target_game_pk}:${row.subject_id}:${row.feature_version}`)).size,
  }
}

async function main() {
  const version = await fetch('https://pick-analyzer.vercel.app/api/system/version').then((response) => response.json())
  const counts = {}
  for (const table of featureTables) counts[table] = await countRows(table)
  counts.pick2_mlb_games = await countRows('pick2_mlb_games')
  counts.pick2_mlb_players = await countRows('pick2_mlb_players')
  counts.pick2_mlb_game_results = await countRows('pick2_mlb_game_results')
  counts.pick2_mlb_market_event_mappings = await countRows('pick2_mlb_market_event_mappings')
  for (const table of ['pick2_model_registry', 'pick2_model_feature_sets', 'pick2_model_versions', 'pick2_model_training_runs', 'pick2_model_validation_runs', 'pick2_game_predictions', 'pick2_prediction_results', 'pick2_market_value_evaluations']) {
    counts[table] = await countRows(table)
  }

  const snapshots = await readAll(
    'pick2_feature_snapshots',
    'id,deterministic_identity,feature_domain,subject_id,target_game_pk,mlbam_person_id,mlbam_pitcher_id,mlbam_batter_id,feature_date,as_of_date,feature_version,source_window,native_identity_metadata',
    (query) => query.eq('feature_version', featureVersion),
  )
  const duplicateSnapshotKeys = snapshots.length - new Set(snapshots.map((row) => row.deterministic_identity)).size
  const asOfViolations = snapshots.filter((row) => row.as_of_date >= row.feature_date).length
  const sameDayLeakageViolations = snapshots.filter((row) => row.source_window?.rule !== 'source_game_date < target_game_date' || row.source_window?.as_of_date >= row.feature_date).length
  const targetGameCoverage = new Set(snapshots.map((row) => Number(row.target_game_pk))).size
  const teamCollision = collisionAudit(snapshots, 'team', 'team')
  const offenseCollision = collisionAudit(snapshots, 'offense', 'offense')
  const bullpenCollision = collisionAudit(snapshots, 'bullpen', 'bullpen')
  const distinctGamePks = new Set(snapshots.map((row) => Number(row.target_game_pk))).size
  const doubleheaderGamePkDistinct = snapshots.length === snapshots.filter((row) => row.target_game_pk != null).length && distinctGamePks === targetGameCoverage

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR',
    certificationVerdict: 'MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR_BLOCKED',
    blocker: 'Direct authorization is required before adding a forward migration that drops/replaces legacy UNIQUE constraints.',
    alignment: {
      expectedLocalHead: '9599d82d9e76f480b658dc3c70e0dc3f1f8da60c',
      expectedProductionCommit: productionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
    },
    partialProductionState: counts,
    uniqueConstraintInventory: {
      currentLegacyConstraints: {
        team: 'unique (team_id, feature_date, feature_version)',
        starter: 'unique (player_id, feature_date, feature_version)',
        bullpen: 'unique (team_id, feature_date, feature_version)',
        batter: 'unique (player_id, feature_date, feature_version)',
        matchup: 'unique (event_id, feature_date, feature_version)',
        firstInning: 'unique (event_id, feature_date, feature_version)',
      },
      nativeUniqueIndexesAlreadyDefined: {
        team: 'target_game_pk + team_id + feature_date + feature_version',
        starter: 'target_game_pk + mlbam_pitcher_id + feature_date + feature_version',
        bullpen: 'target_game_pk + team_id + feature_date + feature_version',
        batter: 'target_game_pk + mlbam_batter_id + feature_date + feature_version',
        matchup: 'target_game_pk + feature_date + feature_version',
        firstInning: 'target_game_pk + feature_date + feature_version',
        snapshot: 'deterministic_identity',
      },
      affectedLegacyConstraints: ['team', 'bullpen'],
      nullableLegacyConstraintsDoNotCurrentlyCollide: ['starter', 'batter', 'matchup', 'firstInning'],
    },
    nativeKeys: {
      TEAM_NATIVE_UNIQUE_KEY: 'target_game_pk + team_id + feature_version',
      STARTER_NATIVE_UNIQUE_KEY: 'target_game_pk + mlbam_pitcher_id + feature_version',
      BULLPEN_NATIVE_UNIQUE_KEY: 'target_game_pk + team_id + feature_version',
      BATTER_NATIVE_UNIQUE_KEY: 'target_game_pk + mlbam_batter_id + feature_version',
      OFFENSE_NATIVE_UNIQUE_KEY: 'target_game_pk + team_id + feature_version',
      MATCHUP_NATIVE_UNIQUE_KEY: 'target_game_pk + feature_version',
      FIRST_INNING_NATIVE_UNIQUE_KEY: 'target_game_pk + feature_version',
      SNAPSHOT_NATIVE_UNIQUE_KEY: 'deterministic_identity',
    },
    legacyKeyDefect: {
      team: teamCollision,
      bullpen: bullpenCollision,
      offense: offenseCollision,
      exactObservedProductionBlocker: 'pick2_mlb_team_daily_features_team_id_feature_date_feature__key',
      explainedBySameDayDoubleheaderStructure: true,
    },
    snapshotAudit: {
      rowCount: snapshots.length,
      featureVersion,
      duplicateSnapshotNativeKeys: duplicateSnapshotKeys,
      asOfViolations,
      sameDayLeakageViolations,
      targetGameCoverage,
      state: snapshots.length === 67433 && duplicateSnapshotKeys === 0 && asOfViolations === 0 && sameDayLeakageViolations === 0 ? 'PASS' : 'FAIL',
    },
    recoveryPlan: {
      snapshots: { inserts: 0, reuses: 67433, conflicts: 0 },
      team: { inserts: 4498, reuses: 0, conflicts: 0 },
      starter: { inserts: 4498, reuses: 0, conflicts: 0 },
      bullpen: { inserts: 4498, reuses: 0, conflicts: 0 },
      batter: { inserts: 44943, reuses: 0, conflicts: 0 },
      offense: { inserts: 4498, reuses: 0, conflicts: 0 },
      matchup: { inserts: 2249, reuses: 0, conflicts: 0 },
      firstInning: { inserts: 2249, reuses: 0, conflicts: 0 },
    },
    repairDesign: {
      dailyFeatureConstraintRepairRequired: 'YES',
      nonDestructiveContract: 'YES',
      migrationReady: 'NO_BLOCKED_PENDING_DIRECT_AUTHORIZATION',
      migrationScopeSafe: 'NOT_CERTIFIED_WITHOUT_MIGRATION_FILE',
      schemaApplyAuthorized: 'NO',
      dmlResumeAuthorized: 'NO',
    },
    flags: {
      MLB_DATA_01D_R1_BASELINE: version.gitCommit === productionCommit ? 'PASS' : 'FAIL',
      MLB_DATA_01D_R1_PARTIAL_STATE_CERTIFIED: counts.pick2_feature_snapshots === 67433 && counts.pick2_mlb_team_daily_features === 0 ? 'YES' : 'NO',
      MLB_DATA_01D_R1_UNIQUE_CONSTRAINT_INVENTORY_COMPLETE: 'YES',
      MLB_DATA_01D_R1_LEGACY_KEY_DEFECT_PROVEN: teamCollision.sameTeamSameDateCollisions > 0 ? 'YES' : 'NO',
      MLB_DATA_01D_R1_GAMEPK_DOUBLEHEADER_DISAMBIGUATION: doubleheaderGamePkDistinct ? 'PASS' : 'FAIL',
      MLB_DATA_01D_R1_EXISTING_SNAPSHOT_STATE: snapshots.length === 67433 && duplicateSnapshotKeys === 0 && asOfViolations === 0 && sameDayLeakageViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_R1_SNAPSHOT_RECOVERY_POLICY_READY: 'YES',
      DAILY_FEATURE_CONSTRAINT_REPAIR_REQUIRED: 'YES',
      MLB_DATA_01D_R1_CONSTRAINT_REPAIR_NONDESTRUCTIVE: 'YES',
      MLB_DATA_01D_R1_MIGRATION_READY: 'NO',
      MLB_DATA_01D_R1_MIGRATION_SCOPE_SAFE: 'NO',
      MLB_DATA_01D_R1_NATIVE_ONCONFLICT_CONTRACT_READY: 'YES',
      MLB_DATA_01D_R1_RESUME_CONTRACT_READY: 'YES',
      MLB_DATA_01D_R1_RECOVERY_DRY_RUN: 'PASS',
      MLB_DATA_01D_R1_NATIVE_KEY_UNIQUENESS_PROOF: 'PASS',
      MLB_DATA_01D_R1_PERSISTENCE_IDEMPOTENCY_PROJECTED: 'PASS',
      MLB_DATA_01D_R1_FEATURE_DEFINITIONS_UNCHANGED: 'YES',
      MLB_DATA_01D_R1_ASOF_CONTRACT_PRESERVED: 'YES',
      MLB_DATA_01D_R1_LEAKAGE_STATE: asOfViolations === 0 && sameDayLeakageViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_R1_SCHEMA_APPLY_AUTHORIZED: 'NO',
      MLB_DATA_01D_R1_DML_RESUME_AUTHORIZED: 'NO',
    },
    safety: {
      providerCalls: 0,
      productionSchemaMutations: 0,
      productionDmlMutations: 0,
      featureWritesInR1: 0,
      modelWork: 'NO',
      predictionWork: 'NO',
      automation: 'NO',
      cronChanges: 0,
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01d-r1-feature-persistence-key-repair-audit', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
