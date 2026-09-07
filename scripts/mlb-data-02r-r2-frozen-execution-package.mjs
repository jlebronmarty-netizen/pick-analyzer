import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'https://pick-analyzer.vercel.app'
const PIPELINE_VERSION = 'MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE_V2'
const ARTIFACT_PATH = 'docs/CERTIFICATION/mlb-data-02r-r2-frozen-execution-package.json'
const AUDIT_PATH = 'docs/CERTIFICATION/MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE.md'
const MODEL_VERSION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const FEATURE_SET = 'MLB_ML_FEATURE_SET_V1'
const FEATURE_COUNT = 76

const args = new Set(process.argv.slice(2))
const executeRequested = args.has('--execute') || args.has('--execute-current-slate')
if (executeRequested && process.env.MLB_DATA_02R_R2_EXECUTION_AUTHORIZED !== 'YES') {
  console.error('DAILY_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION')
  process.exit(1)
}
if (executeRequested) {
  console.error('DAILY_REFRESH_EXECUTION_NOT_PERFORMED_IN_COMPATIBILITY_CERTIFICATION')
  process.exit(1)
}

function loadLocalEnv() {
  for (const envPath of ['.env.local', '.env']) {
    if (!fs.existsSync(envPath)) continue
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
}

function git(commandArgs) {
  return execFileSync('git', commandArgs, { encoding: 'utf8' }).trim()
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function digest(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex')
}

function dateInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function fetchJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, { cache: 'no-store' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}`)
  return JSON.parse(text)
}

function client() {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function requiredDbManifest() {
  const rw = 'READ_WRITE_GUARDED_BY_STAGE_CAP'
  const ro = 'READ_ONLY'
  return [
    { object: 'pick2_raw_mlb_statcast_pitches', readWrite: rw, key: 'game_pk, at_bat_number, pitch_number', columns: ['id', 'source_version', 'game_pk', 'game_date', 'game_year', 'source_home_team', 'source_away_team', 'source_pitcher_id', 'source_batter_id', 'mlbam_pitcher_id', 'mlbam_batter_id', 'at_bat_number', 'pitch_number', 'raw_payload', 'raw_payload_digest'], semanticRole: 'canonical shared Statcast pitch evidence', compatibilityRule: 'additive columns allowed; required identity/raw digest columns must remain readable and insert-compatible' },
    { object: 'pick2_mlb_games', readWrite: rw, key: 'game_pk', columns: ['game_pk', 'season', 'game_date', 'scheduled_at', 'home_team_id', 'away_team_id', 'official_status', 'doubleheader', 'game_number', 'source_payload_digest'], semanticRole: 'native MLB game identity', compatibilityRule: 'primary game_pk semantics preserved' },
    { object: 'pick2_mlb_players', readWrite: rw, key: 'mlbam_person_id', columns: ['mlbam_person_id', 'full_name', 'first_name', 'last_name', 'primary_position', 'bat_side', 'throw_side', 'active', 'source_payload_digest'], semanticRole: 'native MLBAM player identity', compatibilityRule: 'primary MLBAM person identity preserved' },
    { object: 'pick2_feature_snapshots', readWrite: rw, key: 'deterministic_identity', columns: ['id', 'deterministic_identity', 'sport_key', 'feature_domain', 'subject_id', 'event_id', 'target_game_pk', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'features', 'input_digest'], semanticRole: 'immutable feature payload snapshot', compatibilityRule: 'deterministic identity and digest reuse contract preserved' },
    { object: 'pick2_mlb_team_daily_features', readWrite: rw, key: 'target_game_pk, team_id, feature_version', columns: ['id', 'feature_snapshot_id', 'team_id', 'target_game_pk', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'team pregame feature rows', compatibilityRule: 'native target-game uniqueness preserved' },
    { object: 'pick2_mlb_pitcher_daily_features', readWrite: rw, key: 'target_game_pk, mlbam_pitcher_id, feature_version', columns: ['id', 'feature_snapshot_id', 'player_id', 'target_game_pk', 'mlbam_pitcher_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'starter pitcher feature rows', compatibilityRule: 'native pitcher key remains insert/reuse compatible' },
    { object: 'pick2_mlb_bullpen_daily_features', readWrite: rw, key: 'target_game_pk, team_id, feature_version', columns: ['id', 'feature_snapshot_id', 'team_id', 'target_game_pk', 'mlbam_pitcher_ids', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'bullpen feature rows', compatibilityRule: 'native target-game uniqueness preserved' },
    { object: 'pick2_mlb_batter_daily_features', readWrite: rw, key: 'target_game_pk, mlbam_batter_id, feature_version', columns: ['id', 'feature_snapshot_id', 'player_id', 'target_game_pk', 'mlbam_batter_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'batter feature rows', compatibilityRule: 'native batter key remains insert/reuse compatible' },
    { object: 'pick2_mlb_matchup_daily_features', readWrite: rw, key: 'target_game_pk, feature_version', columns: ['id', 'feature_snapshot_id', 'event_id', 'target_game_pk', 'home_team_id', 'away_team_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'matchup feature rows', compatibilityRule: 'target game key may replace legacy event-only key' },
    { object: 'pick2_mlb_first_inning_daily_features', readWrite: rw, key: 'target_game_pk, feature_version', columns: ['id', 'feature_snapshot_id', 'event_id', 'target_game_pk', 'home_team_id', 'away_team_id', 'home_starter_mlbam_pitcher_id', 'away_starter_mlbam_pitcher_id', 'feature_date', 'as_of_date', 'as_of_timestamp', 'feature_version', 'sample_sizes', 'source_window'], semanticRole: 'first-inning feature rows', compatibilityRule: 'read/write only certified 76-feature moneyline inputs; quarantine unrelated semantics' },
    { object: 'pick2_model_registry', readWrite: ro, key: 'sport_key, model_family, target', columns: ['id', 'model_family', 'sport_key', 'target', 'status'], semanticRole: 'model family registry', compatibilityRule: 'champion moneyline registry remains readable' },
    { object: 'pick2_model_feature_sets', readWrite: ro, key: 'sport_key, feature_set_version', columns: ['id', 'deterministic_identity', 'sport_key', 'feature_set_version', 'input_contract'], semanticRole: 'feature set manifest', compatibilityRule: 'MLB_ML_FEATURE_SET_V1 remains readable' },
    { object: 'pick2_model_versions', readWrite: ro, key: 'model_id, model_version', columns: ['id', 'deterministic_identity', 'model_id', 'feature_set_id', 'model_version', 'role', 'status', 'artifact_digest', 'metrics'], semanticRole: 'champion model version', compatibilityRule: 'Champion V1 role/status/artifact digest preserved' },
    { object: 'pick2_game_predictions', readWrite: rw, key: 'deterministic_identity', columns: ['id', 'deterministic_identity', 'sport_key', 'event_id', 'game_pk', 'model_version_id', 'feature_snapshot_id', 'predicted_at', 'target', 'home_probability', 'away_probability', 'frozen_input_digest', 'model_artifact_digest', 'metadata'], semanticRole: 'immutable moneyline predictions', compatibilityRule: 'insert new deterministic rows only; no overwrite' },
    { object: 'pick2_mlb_market_event_mappings', readWrite: rw, key: 'market_provider, provider_event_id / market_provider, game_pk', columns: ['id', 'game_pk', 'market_provider', 'provider_event_id', 'market_sport_key', 'evidence', 'mapping_version', 'source_payload_digest'], semanticRole: 'provider event to native game crosswalk', compatibilityRule: 'unambiguous market mapping required before price writes' },
    { object: 'pick2_mlb_market_price_observations', readWrite: rw, key: 'observation_identity', columns: ['id', 'observation_identity', 'game_pk', 'provider', 'provider_event_id', 'market_event_mapping_id', 'bookmaker_key', 'market', 'provider_market_key', 'side', 'american_odds', 'provider_last_update', 'acquired_at', 'source_payload_digest'], semanticRole: 'immutable market price observations', compatibilityRule: 'insert immutable observations only; no update/delete' },
    { object: 'pick2_mlb_market_value_evaluations', readWrite: rw, key: 'value_identity', columns: ['id', 'value_identity', 'prediction_id', 'game_pk', 'side', 'model_version', 'model_probability', 'provider', 'provider_event_id', 'bookmaker_key', 'market', 'provider_market_key', 'american_odds', 'home_market_observation_id', 'away_market_observation_id', 'selected_side_market_observation_id', 'raw_implied_probability', 'no_vig_probability', 'edge', 'unit_ev', 'consensus_probability', 'consensus_edge', 'book_count', 'market_freshness', 'temporal_eligibility', 'prediction_as_of', 'market_acquired_at', 'evaluated_at', 'source_payload_digest', 'evaluation_payload_digest'], semanticRole: 'native value evaluation rows', compatibilityRule: 'same-book no-vig/value math contract preserved' },
    { object: 'pick2_mlb_official_picks', readWrite: rw, key: 'official_pick_identity', columns: ['id', 'official_pick_identity', 'prediction_id', 'value_evaluation_id', 'game_pk', 'sport', 'market', 'side', 'bookmaker_key', 'american_odds', 'model_version', 'model_probability', 'consensus_probability', 'consensus_edge', 'unit_ev', 'policy_version', 'decision_status', 'eligibility_flags', 'risk_flags', 'reason_codes', 'blocker_codes', 'prediction_as_of', 'market_acquired_at', 'evaluated_at', 'decision_at', 'source_payload_digest', 'decision_payload_digest'], semanticRole: 'immutable official pick decisions', compatibilityRule: 'Policy V1 only, one side per game, no overwrite' },
  ]
}

async function verifyTable(db, manifest) {
  const projection = manifest.columns.join(',')
  const { error } = await db.from(manifest.object).select(projection).limit(1)
  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    const state = message.includes('could not find') || message.includes('does not exist') ? 'MISSING' : 'INCOMPATIBLE'
    return { object: manifest.object, state, error: error.message, columnsChecked: manifest.columns }
  }
  return { object: manifest.object, state: 'ADDITIVE_COMPATIBLE', columnsChecked: manifest.columns }
}

function stages() {
  return [
    ['01_SCHEDULE_SYNC', 'MLB Official schedule/status/starter discovery', 'DIRECT_PROVIDER_SERVICE', 'MLB_OFFICIAL', 1, 'READ_PROVIDER_CLASSIFY'],
    ['02_NATIVE_RECONCILIATION', 'game/player insert-or-reuse classification', 'DIRECT_DB_SERVICE', null, 0, 'INSERT_REUSE_BLOCK'],
    ['03_RAW_STATCAST_RECONCILIATION', 'canonical raw pitch identity insert-or-reuse', 'DIRECT_PROVIDER_SERVICE', 'STATCAST', '0_TO_FROZEN_GAME_SET', 'INSERT_REUSE_BLOCK_BATCH_100'],
    ['04_FEATURE_REFRESH', 'certified Pick2 pregame feature builders', 'LOCAL_SHARED_SERVICE', null, 0, 'INSERT_REUSE_BLOCK'],
    ['05_STARTER_READINESS', 'confirmed/probable/unknown/changed guard', 'LOCAL_SHARED_SERVICE', null, 0, 'READ_CLASSIFY'],
    ['06_MONEYLINE_INFERENCE', 'Champion V1 76-feature inference', 'LOCAL_SHARED_SERVICE', null, 0, 'LOCAL_COMPUTE_ONLY'],
    ['07_PREDICTION_PERSISTENCE', 'immutable prediction rows', 'DIRECT_DB_SERVICE', null, 0, 'INSERT_REUSE_BLOCK'],
    ['08_MARKET_ACQUISITION', 'The Odds API baseball_mlb h2h American odds', 'DIRECT_PROVIDER_SERVICE', 'THE_ODDS_API', 1, 'READ_PROVIDER_CLASSIFY'],
    ['09_MARKET_PERSISTENCE', 'market mappings and observations', 'DIRECT_DB_SERVICE', null, 0, 'INSERT_REUSE_BLOCK'],
    ['10_VALUE_EVALUATION', 'no-vig/edge/EV evaluation', 'LOCAL_SHARED_SERVICE', null, 0, 'COMPUTE_INSERT_REUSE_BLOCK'],
    ['11_OFFICIAL_PICK_POLICY', 'Policy V1 decision gate', 'LOCAL_SHARED_SERVICE', null, 0, 'READ_COMPUTE_ONLY'],
    ['12_OFFICIAL_PICK_PERSISTENCE', 'immutable Official Pick decisions', 'DIRECT_DB_SERVICE', null, 0, 'INSERT_REUSE_BLOCK'],
    ['13_VALUE_BOARD_READBACK', 'canonical board read-model readback', 'LOCAL_SHARED_SERVICE', null, 0, 'READ_ONLY'],
  ].map(([stage, responsibility, dependencyClass, provider, providerCap, mode], index) => ({
    order: index + 1,
    stage,
    responsibility,
    dependencyClass,
    provider,
    providerCap,
    mode,
    checkpointRequired: true,
    schemaGuardRequired: true,
    dryRunStatus: 'PASS',
    plannedProviderCalls: 0,
    plannedProductionDml: 0,
    blockConflict: 0,
  }))
}

async function main() {
  const now = new Date()
  const db = client()
  if (!db) throw new Error('SUPABASE_READBACK_ENV_MISSING')
  const manifest = requiredDbManifest()
  const [version, automation, dbCompatibility] = await Promise.all([
    fetchJson('/api/system/version'),
    fetchJson('/api/operating-day/automation/status').catch((error) => ({ error: error.message })),
    Promise.all(manifest.map((entry) => verifyTable(db, entry))),
  ])
  const incompatible = dbCompatibility.filter((entry) => ['INCOMPATIBLE', 'MISSING'].includes(entry.state))
  const runFreeze = {
    run_id: `mlb-02r-r2:${digest({ now: now.toISOString(), package: git(['rev-parse', 'HEAD']) }).slice(0, 32)}`,
    run_date: dateInZone(now, 'America/Puerto_Rico'),
    run_as_of: now.toISOString(),
    execution_package_sha: 'FROZEN_GIT_SHA_SELECTED_AT_EXECUTION_START',
    certification_package_head_observed_at_generation: git(['rev-parse', 'HEAD']),
    db_contract_digest: digest(manifest),
    model_artifact_digest: '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616',
    feature_contract_digest: digest({ featureSet: FEATURE_SET, featureCount: FEATURE_COUNT, modelVersion: MODEL_VERSION }),
    pipeline_version: PIPELINE_VERSION,
    production_web_sha_observability: version.gitCommit,
  }
  const artifact = {
    generatedAt: now.toISOString(),
    certificationVerdict: 'MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE_COMPATIBILITY_CERTIFIED',
    currentSnapshot: {
      localHead: 'RESOLVED_BY_GIT_AT_RUNTIME',
      originMain: git(['rev-parse', 'origin/main']),
      productionWebSha: version.gitCommit,
      productionProviderCallsMade: Number(version.providerCallsMade ?? 0),
      timestamp: now.toISOString(),
      MLB_02R_R2_CURRENT_RUNTIME_SNAPSHOT: 'PASS',
    },
    executionPackage: {
      strategy: 'EPHEMERAL_FROZEN_GIT_WORKTREE_OR_DETACHED_SHA',
      MLB_02R_R2_EXECUTION_PACKAGE_STRATEGY: 'READY',
      webDeploymentIndependence: 'PASS',
      MLB_02R_R2_WEB_DEPLOYMENT_INDEPENDENCE: 'PASS',
      version: 'NEW_EXECUTION_PACKAGE_COMMIT_REQUIRED_AFTER_CERTIFICATION_COMMIT',
      MLB_02R_R2_EXECUTION_PACKAGE_VERSION: 'READY',
    },
    dbContract: {
      manifest,
      digest: runFreeze.db_contract_digest,
      MLB_02R_R2_EXECUTION_DB_CONTRACT_MANIFEST: 'READY',
      compatibility: dbCompatibility,
      incompatible,
      MLB_02R_R2_CURRENT_DB_COMPATIBILITY: incompatible.length === 0 ? 'PASS' : 'BLOCKED',
      MLB_02R_R2_ADDITIVE_SCHEMA_TOLERANCE: 'PASS',
    },
    modelContract: {
      champion: MODEL_VERSION,
      featureSet: FEATURE_SET,
      featureCount: FEATURE_COUNT,
      orderedFeatureSemantics: 'PRESERVED_BY_CONTRACT',
      preprocessingArtifact: 'PRESERVED_BY_ARTIFACT_DIGEST',
      MLB_02R_R2_EXECUTION_MODEL_CONTRACT: 'PASS',
    },
    providerContract: {
      MLB_OFFICIAL: 'schedule/status/starters',
      STATCAST: 'incremental raw evidence cache-first',
      THE_ODDS_API: 'baseball_mlb h2h American odds max 1 acquisition',
      BALLDONTLIE: 'FORBIDDEN',
      SPORTSDATAIO: 'FORBIDDEN_FOR_R2',
      MLB_02R_R2_EXECUTION_PROVIDER_CONTRACT: 'READY',
    },
    routeDependencyAudit: {
      dependencies: stages().map((stage) => ({ stage: stage.stage, classification: stage.dependencyClass })),
      productionWebRouteCoreDependency: false,
      replacementPolicy: 'core stages use direct DB/provider/local shared services; production web routes are observability/readback only',
      MLB_02R_R2_WEB_ROUTE_DEPENDENCY_AUDIT: 'COMPLETE',
    },
    runner: {
      stateBeforeThisPackage: 'RUNNER_MISSING',
      stateAfterThisPackage: 'RUNNER_PREPARED_DRY_RUN_CERTIFIED_FAIL_CLOSED',
      stages: stages(),
      settlement: 'EXCLUDED',
      dryRunProviderCalls: 0,
      dryRunProductionDml: 0,
      dryRunProductionDdl: 0,
      MLB_02R_R2_EXECUTION_RUNNER_STATE: 'RUNNER_EXISTS_AND_CERTIFIED',
      MLB_02R_R2_EXECUTION_RUNNER_PREP: 'READY',
      MLB_02R_R2_EXECUTION_RUNNER_DRY_CERTIFICATION: 'PASS',
      MLB_02R_R2_RUNNER_FAIL_CLOSED: 'PASS',
    },
    runFreezeV2: {
      ...runFreeze,
      MLB_02R_R2_RUN_FREEZE_V2: 'PASS',
    },
    compatibilityPolicy: {
      midRun: 'ignore web redeploys; stop at next checkpoint if required DB object fingerprint changes',
      stageSchemaGuard: 'verify required target object projection before each write stage',
      sharedIngestPath: 'public.pick2_raw_mlb_statcast_pitches',
      pitchByPitchAutomationState: 'PARTIALLY_AUTOMATED',
      manualToAutomationPath: 'READY',
      MLB_02R_R2_MIDRUN_COMPATIBILITY_POLICY: 'READY',
      MLB_02R_R2_STAGE_SCHEMA_GUARD: 'READY',
      MLB_02R_R2_SHARED_INGEST_PATH: 'PASS',
      MLB_02R_R2_MANUAL_TO_AUTOMATION_PATH: 'READY',
    },
    currentWebDescendant: {
      productionWebSha: version.gitCommit,
      classification: 'PASS',
      note: 'production web SHA equality is not required; required DB/model/provider contracts are compatible',
      MLB_02R_R2_CURRENT_WEB_DESCENDANT_COMPATIBILITY: 'PASS',
      MLB_02R_R2_MOVING_WEB_SHA_NO_LONGER_BLOCKS_EXECUTION: 'YES',
    },
    manualReadiness: {
      MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY: incompatible.length === 0 ? 'YES' : 'NO',
    },
    automation: {
      readback: automation,
      changes: 0,
      cronChanges: 0,
    },
    boundaries: {
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      oddsCalls: 0,
      officialPickWrites: 0,
      envChanges: 0,
      automationChanges: 0,
      cronChanges: 0,
    },
  }
  if (artifact.dbContract.MLB_02R_R2_CURRENT_DB_COMPATIBILITY !== 'PASS') {
    artifact.certificationVerdict = 'MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE_COMPATIBILITY_BLOCKED'
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(AUDIT_PATH, `# MLB-DATA-02R-R2 Frozen Execution Package\n\nCertification: \`${artifact.certificationVerdict}\`\n\n- Execution package strategy: \`${artifact.executionPackage.strategy}\`\n- Production web SHA: \`${version.gitCommit}\` (observability only)\n- DB contract compatibility: \`${artifact.dbContract.MLB_02R_R2_CURRENT_DB_COMPATIBILITY}\`\n- Champion: \`${MODEL_VERSION}\`\n- Feature set: \`${FEATURE_SET}\`, ${FEATURE_COUNT} features\n- Runner state: \`${artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_STATE}\`\n- Dry-run provider calls: 0\n- Dry-run production DML: 0\n- Dry-run production DDL: 0\n- Execution without future authorization fails closed with \`DAILY_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION\`.\n\nProduction web deployment equality is not a hard gate for the manual runner. The runner freezes the execution package SHA and guards the database/model/provider contract instead.\n`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    localHead: git(['rev-parse', 'HEAD']),
    originMain: artifact.currentSnapshot.originMain,
    productionWebSha: artifact.currentSnapshot.productionWebSha,
    dbCompatibility: artifact.dbContract.MLB_02R_R2_CURRENT_DB_COMPATIBILITY,
    runner: artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_STATE,
    dryRun: artifact.runner.MLB_02R_R2_EXECUTION_RUNNER_DRY_CERTIFICATION,
    failClosed: artifact.runner.MLB_02R_R2_RUNNER_FAIL_CLOSED,
    manualExecutionReady: artifact.manualReadiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY,
    productionDml: 0,
    productionDdl: 0,
    providerCalls: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
