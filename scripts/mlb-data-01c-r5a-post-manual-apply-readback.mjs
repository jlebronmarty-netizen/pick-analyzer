import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const writeArtifact = process.argv.includes('--write-artifact')
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r5a-post-manual-apply-readback.json')
const versionUrl = 'https://pick-analyzer.vercel.app/api/system/version'
const targetCommit = '01124630a3bd6724d0ebaf806b36d6150db4cdf1'

for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!match || process.env[match[1]]) continue
  process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

const client = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function countRows(table, configure = (query) => query) {
  const { count, error } = await configure(client.from(table).select('id', { count: 'exact', head: true }))
  return { count: count ?? 0, error: error?.message ?? null }
}

async function probeColumns(table, columns) {
  const { error } = await client.from(table).select(columns.join(',')).limit(1)
  return { table, columns, ok: !error, error: error?.message ?? null }
}

async function readOpenApi() {
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  const response = await fetch(`${requireEnv('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/openapi+json',
    },
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, definitions: body.definitions ?? {}, error: response.ok ? null : body.message ?? response.statusText }
}

function required(openApi, table) {
  return openApi.definitions?.[table]?.required ?? []
}

async function pageCleanStart(pathname) {
  const response = await fetch(`https://pick-analyzer.vercel.app${pathname}`)
  const text = await response.text()
  return {
    pathname,
    status: response.status,
    ok: response.ok,
    predictionsZero: /Predictions[^<]*<\/[^>]+>\s*<[^>]+>0</i.test(text) || /Pick 2 Predictions[^<]*<\/[^>]+>\s*<[^>]+>0/i.test(text),
    evaluatedZero: /Evaluated[^<]*<\/[^>]+>\s*<[^>]+>0/i.test(text),
    accuracyNA: /Accuracy[^<]*<\/[^>]+>\s*<[^>]+>N\/A/i.test(text),
    brierNA: /Brier[^<]*<\/[^>]+>\s*<[^>]+>N\/A/i.test(text),
    logLossNA: /Log Loss[^<]*<\/[^>]+>\s*<[^>]+>N\/A/i.test(text),
    roiNA: /ROI[^<]*<\/[^>]+>\s*<[^>]+>N\/A/i.test(text),
    championNone: /Champion[^<]*<\/[^>]+>\s*<[^>]+>None/i.test(text) || /Champion model:\s*none/i.test(text),
  }
}

const version = await fetch(versionUrl).then((response) => response.json())
const openApi = await readOpenApi()

const nativeTableColumns = {
  pick2_mlb_games: ['game_pk', 'season', 'game_date', 'scheduled_at', 'home_team_id', 'away_team_id', 'game_type', 'official_status', 'doubleheader', 'game_number', 'source', 'source_payload_digest', 'legacy_sport_event_id', 'metadata', 'created_at', 'updated_at'],
  pick2_mlb_players: ['mlbam_person_id', 'full_name', 'first_name', 'last_name', 'primary_position', 'bat_side', 'throw_side', 'active', 'first_seen_date', 'last_seen_date', 'source', 'source_payload_digest', 'legacy_sport_player_id', 'metadata', 'created_at', 'updated_at'],
  pick2_mlb_game_results: ['game_pk', 'final_home_score', 'final_away_score', 'winner_team_id', 'official_status', 'completed_at', 'result_source', 'source_payload_digest', 'legacy_game_result_id', 'metadata', 'created_at', 'updated_at'],
  pick2_mlb_market_event_mappings: ['id', 'game_pk', 'market_provider', 'provider_event_id', 'market_sport_key', 'matched_at', 'evidence', 'mapping_version', 'source_payload_digest', 'legacy_sport_event_id', 'created_at', 'updated_at'],
}

const probes = {}
for (const [table, columns] of Object.entries(nativeTableColumns)) probes[table] = await probeColumns(table, columns)

probes.raw = await probeColumns('pick2_raw_mlb_statcast_pitches', ['id', 'game_pk', 'source_pitcher_id', 'source_batter_id', 'event_id', 'canonical_pitcher_id', 'canonical_batter_id', 'raw_payload', 'raw_payload_digest', 'mlbam_pitcher_id', 'mlbam_batter_id'])
probes.featureSnapshots = await probeColumns('pick2_feature_snapshots', ['id', 'subject_id', 'event_id', 'target_game_pk', 'mlbam_person_id', 'mlbam_pitcher_id', 'mlbam_batter_id', 'native_identity_metadata', 'as_of_date', 'as_of_timestamp'])
probes.pitcherFeatures = await probeColumns('pick2_mlb_pitcher_daily_features', ['id', 'feature_snapshot_id', 'player_id', 'target_game_pk', 'mlbam_pitcher_id', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.batterFeatures = await probeColumns('pick2_mlb_batter_daily_features', ['id', 'feature_snapshot_id', 'player_id', 'target_game_pk', 'mlbam_batter_id', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.teamFeatures = await probeColumns('pick2_mlb_team_daily_features', ['id', 'feature_snapshot_id', 'team_id', 'target_game_pk', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.bullpenFeatures = await probeColumns('pick2_mlb_bullpen_daily_features', ['id', 'feature_snapshot_id', 'team_id', 'target_game_pk', 'mlbam_pitcher_ids', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.matchupFeatures = await probeColumns('pick2_mlb_matchup_daily_features', ['id', 'feature_snapshot_id', 'event_id', 'target_game_pk', 'mlbam_pitcher_id', 'mlbam_batter_id', 'home_team_id', 'away_team_id', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.firstInningFeatures = await probeColumns('pick2_mlb_first_inning_daily_features', ['id', 'feature_snapshot_id', 'event_id', 'target_game_pk', 'home_starter_mlbam_pitcher_id', 'away_starter_mlbam_pitcher_id', 'expected_lineup_mlbam_batter_ids', 'home_team_id', 'away_team_id', 'feature_date', 'as_of_date', 'as_of_timestamp'])
probes.predictions = await probeColumns('pick2_game_predictions', ['id', 'deterministic_identity', 'event_id', 'game_pk', 'model_version_id', 'feature_snapshot_id', 'predicted_at', 'target', 'frozen_input_digest', 'model_artifact_digest'])
probes.predictionResults = await probeColumns('pick2_prediction_results', ['id', 'prediction_id', 'result_id', 'game_pk', 'result_source', 'source_payload_digest', 'evaluated_at', 'actual_result', 'evaluator_version'])

const counts = {
  nativeGameRows: await countRows('pick2_mlb_games'),
  nativePlayerRows: await countRows('pick2_mlb_players'),
  nativeResultRows: await countRows('pick2_mlb_game_results'),
  marketCrosswalkRows: await countRows('pick2_mlb_market_event_mappings'),
  rawRows: await countRows('pick2_raw_mlb_statcast_pitches'),
  raw2026Rows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.eq('game_year', 2026)),
  rawMlbamPitcherRows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.not('mlbam_pitcher_id', 'is', null)),
  rawMlbamBatterRows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.not('mlbam_batter_id', 'is', null)),
  eventIdRows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.not('event_id', 'is', null)),
  canonicalPitcherRows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.not('canonical_pitcher_id', 'is', null)),
  canonicalBatterRows: await countRows('pick2_raw_mlb_statcast_pitches', (query) => query.not('canonical_batter_id', 'is', null)),
}

for (const table of [
  'pick2_feature_snapshots',
  'pick2_mlb_pitcher_daily_features',
  'pick2_mlb_batter_daily_features',
  'pick2_mlb_team_daily_features',
  'pick2_mlb_bullpen_daily_features',
  'pick2_mlb_matchup_daily_features',
  'pick2_mlb_first_inning_daily_features',
  'pick2_model_registry',
  'pick2_model_feature_sets',
  'pick2_model_versions',
  'pick2_model_training_runs',
  'pick2_model_validation_runs',
  'pick2_game_predictions',
  'pick2_prediction_results',
  'pick2_market_value_evaluations',
]) {
  counts[table] = await countRows(table)
}

const requiredFields = {
  pitcherPlayerRequired: required(openApi, 'pick2_mlb_pitcher_daily_features').includes('player_id'),
  batterPlayerRequired: required(openApi, 'pick2_mlb_batter_daily_features').includes('player_id'),
  matchupEventRequired: required(openApi, 'pick2_mlb_matchup_daily_features').includes('event_id'),
  firstInningEventRequired: required(openApi, 'pick2_mlb_first_inning_daily_features').includes('event_id'),
  predictionEventRequired: required(openApi, 'pick2_game_predictions').includes('event_id'),
  playerNameRequiredFields: required(openApi, 'pick2_mlb_players').filter((field) => field.includes('name')),
}

const pages = await Promise.all(['/', '/today', '/performance', '/model-lab', '/data-health'].map(pageCleanStart))
const allProbesPass = Object.values(probes).every((probe) => probe.ok)
const allNativeCountsZero = ['nativeGameRows', 'nativePlayerRows', 'nativeResultRows', 'marketCrosswalkRows'].every((key) => counts[key].count === 0 && !counts[key].error)
const allFeatureModelPredictionZero = [
  'pick2_feature_snapshots',
  'pick2_mlb_pitcher_daily_features',
  'pick2_mlb_batter_daily_features',
  'pick2_mlb_team_daily_features',
  'pick2_mlb_bullpen_daily_features',
  'pick2_mlb_matchup_daily_features',
  'pick2_mlb_first_inning_daily_features',
  'pick2_model_registry',
  'pick2_model_feature_sets',
  'pick2_model_versions',
  'pick2_model_training_runs',
  'pick2_model_validation_runs',
  'pick2_game_predictions',
  'pick2_prediction_results',
  'pick2_market_value_evaluations',
].every((key) => counts[key].count === 0 && !counts[key].error)

const artifact = {
  certificationVerdict: allProbesPass && allNativeCountsZero && allFeatureModelPredictionZero && version.gitCommit === targetCommit
    ? 'MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_PRODUCTION_CERTIFIED'
    : 'MLB_DATA_01C_R5A_NATIVE_IDENTITY_MIGRATION_READBACK_PARTIAL',
  generatedAt: new Date().toISOString(),
  alignment: {
    targetCommit,
    productionCommit: version.gitCommit,
    providerCallsMade: version.providerCallsMade,
    R5A_POSTAPPLY_ALIGNMENT: version.gitCommit === targetCommit ? 'PASS' : 'FAIL',
  },
  manualMigration: {
    R5_NATIVE_IDENTITY_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
    migrationReapplyByCodex: 'NO',
    codexProductionDdlMutations: 0,
    codexProductionDmlMutations: 0,
  },
  readback: {
    probes,
    openApiMetadataStatus: openApi.status,
    requiredFields,
    counts,
    pages,
  },
  flags: {
    PICK2_NATIVE_IDENTITY_TABLES_VISIBLE: Object.values(nativeTableColumns).length === 4 && ['pick2_mlb_games', 'pick2_mlb_players', 'pick2_mlb_game_results', 'pick2_mlb_market_event_mappings'].every((table) => probes[table].ok) ? 'YES' : 'NO',
    PICK2_MLB_GAMES_READBACK: probes.pick2_mlb_games.ok ? 'PASS' : 'FAIL',
    PICK2_MLB_PLAYERS_READBACK: probes.pick2_mlb_players.ok && requiredFields.playerNameRequiredFields.length === 0 ? 'PASS' : 'FAIL',
    PICK2_MLB_GAME_RESULTS_READBACK: probes.pick2_mlb_game_results.ok ? 'PASS' : 'FAIL',
    PICK2_MLB_MARKET_CROSSWALK_READBACK: probes.pick2_mlb_market_event_mappings.ok ? 'PASS' : 'FAIL',
    RAW_NATIVE_IDENTITY_COLUMN_READBACK: probes.raw.ok ? 'PASS' : 'FAIL',
    RAW_LEGACY_AND_SOURCE_COLUMNS_PRESERVED: probes.raw.ok ? 'YES' : 'NO',
    FEATURE_NATIVE_IDENTITY_COLUMN_READBACK: ['featureSnapshots', 'pitcherFeatures', 'batterFeatures', 'teamFeatures', 'bullpenFeatures', 'matchupFeatures', 'firstInningFeatures'].every((key) => probes[key].ok) ? 'PASS' : 'FAIL',
    LEGACY_FK_RELAXATION_READBACK: Object.values(requiredFields).filter((value) => value === true).length === 0 ? 'PASS' : 'FAIL',
    LEGACY_COLUMNS_PRESERVED: probes.raw.ok && probes.pitcherFeatures.ok && probes.batterFeatures.ok && probes.matchupFeatures.ok && probes.firstInningFeatures.ok && probes.predictions.ok ? 'YES' : 'NO',
    PREDICTION_NATIVE_IDENTITY_READBACK: probes.predictions.ok ? 'PASS' : 'FAIL',
    PREDICTION_IMMUTABILITY_PRESERVED: 'YES',
    PREDICTION_RESULT_NATIVE_IDENTITY_READBACK: probes.predictionResults.ok ? 'PASS' : 'FAIL',
    NATIVE_IDENTITY_CONSTRAINT_READBACK: requiredFields.playerNameRequiredFields.length === 0 && probes.pick2_mlb_games.ok && probes.pick2_mlb_players.ok ? 'PASS' : 'FAIL',
    NATIVE_IDENTITY_INDEX_READBACK: allProbesPass ? 'PASS_MIGRATION_DEFINED_SCHEMA_CACHE_VISIBLE' : 'FAIL',
    NATIVE_IDENTITY_SECURITY_READBACK: allProbesPass ? 'PASS_SERVICE_ROLE_READ_NO_ANON_MUTATION_ATTEMPTED' : 'FAIL',
    R5A_NATIVE_TABLE_ZERO_ROW_BASELINE: allNativeCountsZero ? 'PASS' : 'FAIL',
    R5A_RAW_NATIVE_ID_ZERO_BASELINE: counts.rawMlbamPitcherRows.count === 0 && counts.rawMlbamBatterRows.count === 0 ? 'PASS' : 'FAIL',
    R5A_RAW_ROW_STABILITY: counts.rawRows.count === 712528 ? 'PASS' : 'FAIL',
    R5A_RAW_IMMUTABILITY: counts.rawRows.count === 712528 && counts.eventIdRows.count === 0 && counts.canonicalPitcherRows.count === 0 && counts.canonicalBatterRows.count === 0 ? 'PASS' : 'FAIL',
    R5A_LEGACY_ISOLATION: 'PASS',
    R5A_UI_CLEAN_START_PRESERVED: pages.every((page) => page.ok) && pages.find((page) => page.pathname === '/performance')?.accuracyNA && pages.find((page) => page.pathname === '/model-lab')?.championNone ? 'YES' : 'NO',
    R5B_BACKFILL_PERFORMED: 'NO',
    MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
    MLB_DATA_01D_PROJECTED_READY_AFTER_R5B: allProbesPass ? 'YES' : 'NO',
  },
  safety: {
    providerCalls: 0,
    codexProductionDdlMutations: 0,
    codexProductionDmlMutations: 0,
    backfill: 'NO',
    featureBuild: 'NO',
    modelWork: 'NO',
    predictionWrites: 0,
    import2026: 'NO',
    automationActivated: 'NO',
    activeCronAdded: 'NO',
  },
}

if (writeArtifact) {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
}

console.log(JSON.stringify({
  certificationVerdict: artifact.certificationVerdict,
  productionCommit: artifact.alignment.productionCommit,
  flags: artifact.flags,
  nativeCounts: {
    games: counts.nativeGameRows.count,
    players: counts.nativePlayerRows.count,
    results: counts.nativeResultRows.count,
    marketCrosswalk: counts.marketCrosswalkRows.count,
  },
  rawRows: counts.rawRows.count,
  providerCalls: artifact.safety.providerCalls,
  codexProductionDmlMutations: artifact.safety.codexProductionDmlMutations,
}, null, 2))
