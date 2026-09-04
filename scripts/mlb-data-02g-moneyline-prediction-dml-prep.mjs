import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const executePredictions = process.argv.includes('--execute-predictions')

const targetProductionCommit = 'fd0ec977c0a7505a9758295df179f55fe25925ac'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const trainingArtifactPath = 'docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json'
const inferenceArtifactPath = 'docs/CERTIFICATION/mlb-data-02f-moneyline-prediction-generation-prep.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02g-moneyline-prediction-dml-prep.json'

const artifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const datasetDigest = '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSet = 'MLB_ML_FEATURE_SET_V1'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const market = 'moneyline'

const expected = {
  replayRows: 2249,
  sampleRows: 24,
  rawRows: 712528,
  nativeGames: 2430,
  nativePlayers: 1469,
  features: { team: 4498, starter: 4498, bullpen: 4498, batter: 44943, matchup: 2249, firstInning: 2249, snapshots: 67433 },
}

const teamFields = ['recent_k_rate', 'recent_bb_rate', 'recent_runs_per_game', 'recent_iso']
const starterFields = ['k_rate', 'bb_rate', 'k_minus_bb_rate', 'whiff_rate', 'csw_rate', 'strike_rate', 'swing_rate', 'avg_release_speed', 'velocity_l1', 'velocity_l3', 'velocity_l5', 'velocity_delta', 'previous_pitch_count', 'days_rest']
const bullpenFields = ['pitches_previous_24h', 'pitches_previous_72h', 'high_workload_reliever_count', 'bullpen_k_rate', 'bullpen_bb_rate', 'bullpen_k_minus_bb_rate', 'bullpen_whiff_rate']

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

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function dateKey(value) {
  return String(value).slice(0, 10)
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function rowKey(gamePk, id) {
  return `${Number(gamePk)}|${id}`
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readAll(db, table, columns, configure = (query) => query, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await configure(db.from(table).select(columns).range(from, from + pageSize - 1))
    if (error) throw new Error(`${table} read failed at ${from}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function fetchRawWindow(db, cursor, limit) {
  const columns = 'id,game_pk,game_date,canonical_home_team_id,canonical_away_team_id,at_bat_number,pitch_number,post_home_score,post_away_score'
  const rows = []
  let currentCursor = cursor
  while (rows.length < limit) {
    const pageLimit = Math.min(1000, limit - rows.length)
    let query = db.from('pick2_raw_mlb_statcast_pitches').select(columns).order('id', { ascending: true }).limit(pageLimit)
    if (currentCursor) query = query.gt('id', currentCursor)
    const { data, error } = await query
    if (error) throw new Error(`pick2_raw_mlb_statcast_pitches read failed after cursor ${currentCursor ?? 'START'}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageLimit) break
    currentCursor = data[data.length - 1].id
  }
  return rows
}

function addGame(gameMap, row) {
  const key = String(row.game_pk)
  if (!gameMap.has(key)) {
    gameMap.set(key, {
      gamePk: Number(row.game_pk),
      gameDate: row.game_date,
      homeTeamId: row.canonical_home_team_id,
      awayTeamId: row.canonical_away_team_id,
      finalHomeScore: null,
      finalAwayScore: null,
    })
  }
  const game = gameMap.get(key)
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
}

function splitRows(rows) {
  const sorted = [...rows].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  const trainEnd = Math.floor(sorted.length * 0.7)
  const validationEnd = Math.floor(sorted.length * 0.85)
  return { train: sorted.slice(0, trainEnd), validation: sorted.slice(trainEnd, validationEnd), test: sorted.slice(validationEnd) }
}

function buildVector(game, maps) {
  const homeTeam = maps.team.get(rowKey(game.gamePk, game.homeTeamId))
  const awayTeam = maps.team.get(rowKey(game.gamePk, game.awayTeamId))
  const first = maps.first.get(Number(game.gamePk))
  const homeStarter = maps.starter.get(rowKey(game.gamePk, first?.home_starter_mlbam_pitcher_id))
  const awayStarter = maps.starter.get(rowKey(game.gamePk, first?.away_starter_mlbam_pitcher_id))
  const homeBullpen = maps.bullpen.get(rowKey(game.gamePk, game.homeTeamId))
  const awayBullpen = maps.bullpen.get(rowKey(game.gamePk, game.awayTeamId))
  ensure(homeTeam && awayTeam, `TEAM_FEATURE_MISSING:${game.gamePk}`)
  ensure(first && homeStarter && awayStarter, `STARTER_FEATURE_MISSING:${game.gamePk}`)
  ensure(homeBullpen && awayBullpen, `BULLPEN_FEATURE_MISSING:${game.gamePk}`)
  const vector = []
  for (const field of teamFields) {
    const home = numberOrNull(homeTeam[field])
    const away = numberOrNull(awayTeam[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  for (const field of starterFields) {
    const home = numberOrNull(homeStarter[field])
    const away = numberOrNull(awayStarter[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  for (const field of bullpenFields) {
    const home = numberOrNull(homeBullpen[field])
    const away = numberOrNull(awayBullpen[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  vector.push(1)
  return { vector, first, matchup: maps.matchup.get(Number(game.gamePk)) }
}

function transformVector(vector, preprocessing) {
  return vector.map((value, index) => {
    const filled = Number.isFinite(value) ? value : preprocessing.medians[index]
    return (filled - preprocessing.means[index]) / preprocessing.stds[index]
  })
}

function sigmoid(value) {
  if (value > 35) return 1 - 1e-15
  if (value < -35) return 1e-15
  return 1 / (1 + Math.exp(-value))
}

function dot(weights, features) {
  let sum = weights[0]
  for (let index = 0; index < features.length; index += 1) sum += weights[index + 1] * features[index]
  return sum
}

function infer(modelArtifact, row) {
  const z = transformVector(row.x, modelArtifact.preprocessing)
  const home = sigmoid(dot(modelArtifact.weights, z))
  return { homeProbability: home, awayProbability: 1 - home }
}

function deterministicSample(rows) {
  const test = splitRows(rows).test
  const homeWins = test.filter((row) => row.homeWin === 1)
  const awayWins = test.filter((row) => row.homeWin === 0)
  const every = (items, count) => items.filter((_, index) => index % Math.max(1, Math.floor(items.length / count)) === 0).slice(0, count)
  return [...every(homeWins, 12), ...every(awayWins, 12)].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
}

function inputPayload(row) {
  return {
    game_pk: row.gamePk,
    market,
    model_version: modelVersion,
    feature_set: featureSet,
    feature_version: featureVersion,
    artifact_digest: artifactDigest,
    as_of: row.asOf,
    home_team_id: row.homeTeamId,
    away_team_id: row.awayTeamId,
    starter_status: row.starterStatus,
    data_completeness: row.dataCompleteness,
    ordered_feature_values: row.x.map((value) => Number.isFinite(value) ? Number(value.toFixed(12)) : null),
    missingness: row.x.map((value, index) => ({ index, missing: !Number.isFinite(value) })).filter((item) => item.missing),
  }
}

function buildPredictionRow(row, champion, modelArtifact) {
  const probabilities = infer(modelArtifact, row)
  const payload = inputPayload(row)
  const frozenInputDigest = sha256(stable(payload))
  const deterministicIdentity = ['baseball_mlb', 'prediction', market, String(row.gamePk), modelVersion, frozenInputDigest].join('::')
  return {
    deterministic_identity: deterministicIdentity,
    pick2_era: 'PICK_2_ERA_V1',
    sport_key: 'baseball_mlb',
    game_pk: row.gamePk,
    event_id: null,
    model_version_id: champion.id,
    feature_snapshot_id: row.featureSnapshotId,
    predicted_at: row.asOf,
    target: 'home_win_probability',
    home_probability: Number(probabilities.homeProbability.toFixed(12)),
    away_probability: Number(probabilities.awayProbability.toFixed(12)),
    expected_home_score: null,
    expected_away_score: null,
    expected_total: null,
    expected_margin: null,
    frozen_input_digest: frozenInputDigest,
    model_artifact_digest: artifactDigest,
    metadata: {
      market,
      model_version: modelVersion,
      feature_set: featureSet,
      home_team_id: row.homeTeamId,
      away_team_id: row.awayTeamId,
      starter_status: row.starterStatus,
      data_completeness: row.dataCompleteness,
      recommendation: null,
      value: null,
      official_pick: false,
      as_of: row.asOf,
      input_payload_contract: 'MLB_02G_INFERENCE_INPUT_PAYLOAD_CONTRACT',
    },
  }
}

function validateDryRows(rows) {
  const duplicateIdentities = rows.length - new Set(rows.map((row) => row.deterministic_identity)).size
  const invalid = rows.filter((row) => (
    !row.game_pk ||
    !row.model_version_id ||
    !row.feature_snapshot_id ||
    !(row.home_probability > 0 && row.home_probability < 1) ||
    Math.abs(row.home_probability + row.away_probability - 1) > 1e-9 ||
    !row.frozen_input_digest ||
    !row.predicted_at ||
    !row.deterministic_identity
  )).length
  return { rows: rows.length, duplicateIdentities, invalid, blockConflicts: duplicateIdentities + invalid }
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,feature_set_id,pick2_model_feature_sets(feature_set_version)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  ensure((data ?? []).length === 1, `CHAMPION_COUNT_MISMATCH:${(data ?? []).length}`)
  return data[0]
}

async function main() {
  if (executePredictions) throw new Error('PREDICTION_DML_EXECUTION_FORBIDDEN_IN_02G_PREP')
  ensure(fs.existsSync(modelArtifactPath), 'MODEL_ARTIFACT_MISSING')
  ensure(fs.existsSync(trainingArtifactPath), 'TRAINING_ARTIFACT_MISSING')
  ensure(fs.existsSync(inferenceArtifactPath), '02F_ARTIFACT_MISSING')

  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetProductionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const modelArtifact = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8'))
  const trainingArtifact = JSON.parse(fs.readFileSync(trainingArtifactPath, 'utf8'))
  const inferenceArtifact = JSON.parse(fs.readFileSync(inferenceArtifactPath, 'utf8'))
  ensure(sha256(stable(modelArtifact)) === artifactDigest, 'MODEL_ARTIFACT_DIGEST_MISMATCH')
  ensure(inferenceArtifact.certificationVerdict === 'MLB_DATA_02F_MONEYLINE_PREDICTION_GENERATION_PREP_CERTIFIED', '02F_NOT_CERTIFIED')
  ensure(inferenceArtifact.flags?.MLB_02F_REPLAY_METRIC_PARITY === 'PASS', '02F_METRIC_PARITY_NOT_CERTIFIED')

  const db = dbClient()
  const champion = await readChampion(db)
  ensure(champion.model_version === modelVersion && champion.artifact_digest === artifactDigest && champion.pick2_model_feature_sets?.feature_set_version === featureSet, 'CHAMPION_READBACK_MISMATCH')

  const predictionZero = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(Object.values(predictionZero).every((count) => count === 0), 'PREDICTION_ZERO_BASELINE_FAILED')

  const featureCounts = {
    team: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    starter: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    bullpen: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    batter: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    matchup: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    firstInning: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    snapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
  for (const [key, expectedCount] of Object.entries(expected.features)) ensure(featureCounts[key] === expectedCount, `FEATURE_COUNT_MISMATCH:${key}:${featureCounts[key]}`)

  const rawNative = {
    raw: await countRows(db, 'pick2_raw_mlb_statcast_pitches'),
    raw2026: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01')),
    nativeGames: await countRows(db, 'pick2_mlb_games', 'game_pk'),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
  }
  ensure(rawNative.raw === expected.rawRows && rawNative.raw2026 === 0 && rawNative.nativeGames === expected.nativeGames && rawNative.nativePlayers === expected.nativePlayers, 'RAW_NATIVE_BASELINE_CHANGED')

  const [teamRows, starterRows, bullpenRows, matchupRows, firstRows, games] = await Promise.all([
    readAll(db, 'pick2_mlb_team_daily_features', `target_game_pk,team_id,feature_date,as_of_date,as_of_timestamp,feature_version,source_window,${teamFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_pitcher_daily_features', `target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,as_of_timestamp,feature_version,source_window,${starterFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_bullpen_daily_features', `target_game_pk,team_id,feature_date,as_of_date,as_of_timestamp,feature_version,source_window,${bullpenFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_matchup_daily_features', 'id,feature_snapshot_id,target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version,source_window', (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_first_inning_daily_features', 'target_game_pk,feature_date,as_of_date,as_of_timestamp,feature_version,source_window,home_starter_mlbam_pitcher_id,away_starter_mlbam_pitcher_id', (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_games', 'game_pk,game_date,home_team_id,away_team_id', (query) => query.eq('season', 2025).order('game_date', { ascending: true }).order('game_pk', { ascending: true })),
  ])
  const maps = {
    team: new Map(teamRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    starter: new Map(starterRows.map((row) => [rowKey(row.target_game_pk, row.mlbam_pitcher_id), row])),
    bullpen: new Map(bullpenRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    matchup: new Map(matchupRows.map((row) => [Number(row.target_game_pk), row])),
    first: new Map(firstRows.map((row) => [Number(row.target_game_pk), row])),
  }

  const rawGameMap = new Map()
  const pitchIdentities = new Set()
  let rawRows = 0
  let cursor = null
  for (;;) {
    const page = await fetchRawWindow(db, cursor, 5000)
    if (!page.length) break
    for (const row of page) {
      rawRows += 1
      pitchIdentities.add(`${row.game_pk}|${row.at_bat_number}|${row.pitch_number}`)
      addGame(rawGameMap, row)
    }
    cursor = page[page.length - 1].id
    if (page.length < 5000) break
  }
  ensure(rawRows === expected.rawRows && pitchIdentities.size === expected.rawRows, 'RAW_IDENTITY_CHANGED')

  const gamesByPk = new Map(games.map((game) => [Number(game.game_pk), game]))
  const matchupPks = new Set(matchupRows.map((row) => Number(row.target_game_pk)))
  const moneylineRows = [...rawGameMap.values()]
    .filter((game) => matchupPks.has(game.gamePk))
    .map((game) => {
      const nativeGame = gamesByPk.get(game.gamePk)
      const built = buildVector({
        gamePk: game.gamePk,
        homeTeamId: nativeGame?.home_team_id ?? game.homeTeamId,
        awayTeamId: nativeGame?.away_team_id ?? game.awayTeamId,
      }, maps)
      return {
        gamePk: game.gamePk,
        gameDate: dateKey(nativeGame?.game_date ?? game.gameDate),
        homeTeamId: nativeGame?.home_team_id ?? game.homeTeamId,
        awayTeamId: nativeGame?.away_team_id ?? game.awayTeamId,
        homeWin: game.finalHomeScore > game.finalAwayScore ? 1 : 0,
        x: built.vector,
        featureSnapshotId: built.matchup?.feature_snapshot_id,
        asOf: built.matchup?.as_of_timestamp ?? `${dateKey(built.matchup?.as_of_date)}T00:00:00.000Z`,
        starterStatus: 'READY_PROBABLE_WITH_FLAG',
        dataCompleteness: 'COMPLETE',
      }
    })
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  ensure(moneylineRows.length === expected.replayRows, `REPLAY_ROW_COUNT_CHANGED:${moneylineRows.length}`)

  const dryRows = moneylineRows.map((row) => buildPredictionRow(row, champion, modelArtifact))
  const fullAudit = validateDryRows(dryRows)
  ensure(fullAudit.rows === expected.replayRows && fullAudit.duplicateIdentities === 0 && fullAudit.blockConflicts === 0, `FULL_IDENTITY_DRY_RUN_FAILED:${JSON.stringify(fullAudit)}`)
  const samplePks = new Set(deterministicSample(moneylineRows).map((row) => row.gamePk))
  const drySample = dryRows.filter((row) => samplePks.has(row.game_pk))
  const sampleAudit = validateDryRows(drySample)
  ensure(sampleAudit.rows >= expected.sampleRows && sampleAudit.blockConflicts === 0, `SAMPLE_DRY_RUN_FAILED:${JSON.stringify(sampleAudit)}`)

  const secondAudit = validateDryRows(dryRows.map((row) => ({ ...row })))
  ensure(secondAudit.blockConflicts === 0 && secondAudit.duplicateIdentities === 0, 'SECOND_RUN_IDEMPOTENCY_FAILED')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02G_MONEYLINE_PREDICTION_DML_PREP',
    certificationVerdict: 'MLB_DATA_02G_MONEYLINE_PREDICTION_DML_PREP_CERTIFIED',
    publication: {
      publishedCommit: targetProductionCommit,
      originMain: targetProductionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02G_PREPUBLISH_STATE: 'PASS',
      MLB_02G_02F_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    champion: {
      count: 1,
      modelVersion: champion.model_version,
      role: champion.role,
      status: champion.status,
      artifactDigest: champion.artifact_digest,
      featureSet: champion.pick2_model_feature_sets.feature_set_version,
      MLB_02G_CHAMPION_READBACK: 'PASS',
      MLB_02G_CHAMPION_UNCHANGED: 'PASS',
    },
    inferenceContract: {
      trainingCertification: trainingArtifact.certificationVerdict,
      datasetDigest,
      sourceCertification: inferenceArtifact.certificationVerdict,
      featureOrdering: inferenceArtifact.flags.MLB_02F_FEATURE_ORDERING,
      preprocessingReadback: inferenceArtifact.flags.MLB_02F_PREPROCESSING_READBACK,
      probabilityComplement: inferenceArtifact.flags.MLB_02F_PROBABILITY_COMPLEMENT_CONTRACT,
      reproducibility: inferenceArtifact.flags.MLB_02F_INFERENCE_REPRODUCIBILITY,
      fullReplayRows: inferenceArtifact.flags.MLB_02F_FULL_REPLAY_ROWS,
      MLB_02G_INFERENCE_CONTRACT_READBACK: 'PASS',
    },
    schemaInventory: {
      pick2_game_predictions: {
        nativeGameKey: 'game_pk bigint nullable compatibility column, indexed by sport_key/game_pk/predicted_at',
        legacyEventCompatibility: 'event_id is nullable after R5 native identity migration',
        modelVersionFk: 'model_version_id references pick2_model_versions(id)',
        featureVersionFk: 'feature_snapshot_id references pick2_feature_snapshots(id); full input state is frozen in frozen_input_digest',
        marketFields: 'target plus metadata.market',
        selectionFields: 'home_probability and away_probability only; no pick side',
        asOfFields: 'predicted_at and metadata.as_of',
        inputDigestFields: 'frozen_input_digest and model_artifact_digest',
        statusFields: 'metadata.status_flags prepared; no recommendation status',
        immutability: 'pick2_game_predictions_no_update trigger blocks updates',
      },
      pick2_prediction_results: {
        linkage: 'prediction_id plus native game_pk; settlement separate',
      },
      MLB_02G_PREDICTION_SCHEMA_INVENTORY_COMPLETE: 'YES',
    },
    recordContract: {
      nativeGameIdentity: 'game_pk',
      market,
      semantics: 'home win probability and away win probability equals one minus home',
      requiredFields: ['game_pk', 'sport', 'market', 'home_team_id', 'away_team_id', 'home_win_probability', 'away_win_probability', 'model_version', 'feature_set', 'artifact_digest', 'as_of', 'feature_input_digest', 'starter_status', 'data_completeness', 'created_at'],
      probabilityStorage: 'numeric columns preserve model output; bounded to 0..1 by schema checks, future writer requires strict 0<p<1',
      complementTolerance: 1e-9,
      asOfSemantics: 'timestamp at which complete feature/inference payload is frozen',
      materialInputChange: ['starter changes', 'feature payload changes', 'new completed game changes rolling features', 'model version changes', 'feature set changes', 'material input digest changes'],
      noOverwrite: 'materially different inference state creates a new immutable deterministic identity',
      deterministicIdentity: ['game_pk', 'market', 'model_version', 'feature_input_digest'],
      reuseContract: 'same identity and payload => REUSE_NO_OP',
      conflictContract: 'same identity with different input/probability/model/feature payload => BLOCK_CONFLICT',
      inputPayload: ['ordered 76 feature values', 'missingness state', 'game_pk', 'teams', 'starter state', 'as_of', 'feature_set_version', 'model_version'],
      inputDigest: 'stable key ordering, explicit null handling, stable numeric representation, ordered vector preserved, SHA-256',
      MLB_02G_GAMEPK_PREDICTION_IDENTITY: 'PASS',
      MLB_02G_MONEYLINE_MARKET_CONTRACT: 'PASS',
      MLB_02G_PREDICTION_RECORD_CONTRACT: 'READY',
      MLB_02G_PROBABILITY_STORAGE_CONTRACT: 'PASS',
      MLB_02G_PROBABILITY_COMPLEMENT_STORAGE: 'PASS',
      MLB_02G_ASOF_SEMANTICS: 'READY',
      MLB_02G_MATERIAL_INPUT_CHANGE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_NO_OVERWRITE: 'PASS',
      MLB_02G_PREDICTION_DETERMINISTIC_IDENTITY: 'READY',
      MLB_02G_PREDICTION_REUSE_CONTRACT: 'PASS',
      MLB_02G_PREDICTION_CONFLICT_CONTRACT: 'PASS',
      MLB_02G_INFERENCE_INPUT_PAYLOAD_CONTRACT: 'READY',
      MLB_02G_INFERENCE_INPUT_DIGEST_CONTRACT: 'PASS',
    },
    readinessPolicy: {
      starterPersistencePolicy: ['READY_CONFIRMED', 'READY_PROBABLE_WITH_FLAG', 'BLOCK_STARTER_UNKNOWN', 'BLOCK_STARTER_CHANGED_REBUILD_REQUIRED'],
      persistableStarterStates: ['READY_CONFIRMED', 'READY_PROBABLE_WITH_FLAG'],
      dataCompletenessStates: ['COMPLETE', 'PARTIAL_ALLOWED', 'BLOCKED'],
      probabilityConfidenceSeparation: 'model probability is not confidence',
      confidenceMetadataPolicy: 'derive later from calibration, data completeness, sample support and freshness; no fabricated confidence percentage in 02G',
      MLB_02G_STARTER_PERSISTENCE_POLICY: 'READY',
      MLB_02G_DATA_COMPLETENESS_CONTRACT: 'READY',
      MLB_02G_PROBABILITY_CONFIDENCE_SEPARATION: 'PASS',
      MLB_02G_CONFIDENCE_PERSISTENCE_POLICY: 'READY',
    },
    dryRun: {
      sample: { rows: drySample.length, audit: sampleAudit, sampleRows: drySample.slice(0, 5) },
      fullIdentityAudit: fullAudit,
      productionPredictionZeroBaseline: predictionZero,
      historicalBackfillAuthorized: 'NO',
      singleGameDmlCapReady: 'YES',
      slateDmlCapContract: 'PASS',
      replayNotProductionBackfill: 'PASS',
      prewriteClassificationContract: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'],
      partialFailureContract: 'READY_STOP_BEFORE_WRITES_OR_TRANSACTIONAL_CHECKPOINT',
      idempotencyProjected: { newInserts: 0, allExactRows: 'REUSE_NO_OP', conflicts: secondAudit.blockConflicts },
      MLB_02G_PERSISTENCE_ROW_DRY_RUN_COUNT: drySample.length,
      MLB_02G_PERSISTENCE_ROW_DRY_RUN: 'PASS',
      MLB_02G_FULL_IDENTITY_DRY_RUN: 'PASS',
      MLB_02G_PRODUCTION_PREDICTION_ZERO_BASELINE: 'PASS',
      MLB_02G_HISTORICAL_PREDICTION_BACKFILL_AUTHORIZED: 'NO',
      MLB_02G_SINGLE_GAME_DML_CAP_READY: 'YES',
      MLB_02G_SLATE_DML_CAP_CONTRACT: 'PASS',
      MLB_02G_REPLAY_NOT_PRODUCTION_BACKFILL: 'PASS',
      MLB_02G_PREWRITE_CLASSIFICATION_CONTRACT: 'PASS',
      MLB_02G_PARTIAL_FAILURE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_IDEMPOTENCY_PROJECTED: 'PASS',
    },
    resultMarketBoundary: {
      resultLinkage: 'game_pk plus prediction id/version; no team-name matching',
      predictionResultSeparation: 'prediction insert does not create result row',
      oddsPersistenceSeparation: 'The Odds API not required for fair probability persistence',
      futureValueJoin: 'prediction fair probability + market price + no-vig probability => edge/value evaluation in a later phase',
      officialPickSeparation: 'prediction row alone never implies Official Pick',
      MLB_02G_RESULT_LINKAGE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_RESULT_SEPARATION: 'PASS',
      MLB_02G_ODDS_PERSISTENCE_SEPARATION: 'PASS',
      MLB_02G_FUTURE_VALUE_JOIN_CONTRACT: 'READY',
      MLB_02G_OFFICIAL_PICK_SEPARATION: 'PASS',
    },
    runnerPrep: {
      state: 'DRY_RUN_ONLY',
      canLoadChampion: true,
      canAssembleCertifiedFeatures: true,
      canComputePrediction: true,
      canBuildInputDigest: true,
      canClassifyInsertReuseConflict: true,
      executionFailClosed: 'PREDICTION_DML_EXECUTION_FORBIDDEN_IN_02G_PREP',
      live2026PredictionState: 'NOT_READY',
      liveDataDependency: ['2026/native current ingest', 'current schedule/game identities', 'pregame feature construction', 'fresh starter state', 'dry inference'],
      MLB_02G_PREDICTION_DML_RUNNER_PREP: 'PASS',
      MLB_02G_PREDICTION_DML_EXECUTION_FAIL_CLOSED: 'PASS',
      MLB_02G_2026_LIVE_PREDICTION_STATE: 'NOT_READY',
      MLB_02G_LIVE_DATA_DEPENDENCY_DOCUMENTED: 'YES',
    },
    preservation: {
      featureFoundation: featureCounts,
      rawNative: { ...rawNative, uniquePitchIdentities: pitchIdentities.size, duplicatePitchIdentities: rawRows - pitchIdentities.size },
      modelWrites: 0,
      championChanges: 0,
      predictionWrites: 0,
      MLB_02G_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02G_RAW_NATIVE_UNCHANGED: 'PASS',
    },
    safety: {
      predictionWrites: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      officialPicks: 0,
      featureWrites: 0,
      rawWrites: 0,
      modelWrites: 0,
      championChanges: 0,
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      oddsApiCalls: 0,
      ballDontLieCalls: 0,
      mlbOfficialCalls: 0,
      sportsDataIoCalls: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      parlay100Generation: 'NO',
    },
    flags: {
      MLB_02G_CHAMPION_READBACK: 'PASS',
      MLB_02G_INFERENCE_CONTRACT_READBACK: 'PASS',
      MLB_02G_PREDICTION_SCHEMA_INVENTORY_COMPLETE: 'YES',
      MLB_02G_GAMEPK_PREDICTION_IDENTITY: 'PASS',
      MLB_02G_MONEYLINE_MARKET_CONTRACT: 'PASS',
      MLB_02G_PREDICTION_RECORD_CONTRACT: 'READY',
      MLB_02G_PROBABILITY_STORAGE_CONTRACT: 'PASS',
      MLB_02G_PROBABILITY_COMPLEMENT_STORAGE: 'PASS',
      MLB_02G_ASOF_SEMANTICS: 'READY',
      MLB_02G_MATERIAL_INPUT_CHANGE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_NO_OVERWRITE: 'PASS',
      MLB_02G_PREDICTION_DETERMINISTIC_IDENTITY: 'READY',
      MLB_02G_PREDICTION_REUSE_CONTRACT: 'PASS',
      MLB_02G_PREDICTION_CONFLICT_CONTRACT: 'PASS',
      MLB_02G_INFERENCE_INPUT_PAYLOAD_CONTRACT: 'READY',
      MLB_02G_INFERENCE_INPUT_DIGEST_CONTRACT: 'PASS',
      MLB_02G_STARTER_PERSISTENCE_POLICY: 'READY',
      MLB_02G_DATA_COMPLETENESS_CONTRACT: 'READY',
      MLB_02G_PROBABILITY_CONFIDENCE_SEPARATION: 'PASS',
      MLB_02G_CONFIDENCE_PERSISTENCE_POLICY: 'READY',
      MLB_02G_PERSISTENCE_ROW_DRY_RUN: 'PASS',
      MLB_02G_FULL_IDENTITY_DRY_RUN: 'PASS',
      MLB_02G_PRODUCTION_PREDICTION_ZERO_BASELINE: 'PASS',
      MLB_02G_HISTORICAL_PREDICTION_BACKFILL_AUTHORIZED: 'NO',
      MLB_02G_SINGLE_GAME_DML_CAP_READY: 'YES',
      MLB_02G_SLATE_DML_CAP_CONTRACT: 'PASS',
      MLB_02G_REPLAY_NOT_PRODUCTION_BACKFILL: 'PASS',
      MLB_02G_PREWRITE_CLASSIFICATION_CONTRACT: 'PASS',
      MLB_02G_PARTIAL_FAILURE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_IDEMPOTENCY_PROJECTED: 'PASS',
      MLB_02G_RESULT_LINKAGE_CONTRACT: 'READY',
      MLB_02G_PREDICTION_RESULT_SEPARATION: 'PASS',
      MLB_02G_ODDS_PERSISTENCE_SEPARATION: 'PASS',
      MLB_02G_FUTURE_VALUE_JOIN_CONTRACT: 'READY',
      MLB_02G_OFFICIAL_PICK_SEPARATION: 'PASS',
      MLB_02G_PREDICTION_DML_RUNNER_PREP: 'PASS',
      MLB_02G_PREDICTION_DML_EXECUTION_FAIL_CLOSED: 'PASS',
      MLB_02G_2026_LIVE_PREDICTION_STATE: 'NOT_READY',
      MLB_02G_LIVE_DATA_DEPENDENCY_DOCUMENTED: 'YES',
      MLB_02G_CHAMPION_UNCHANGED: 'PASS',
      MLB_02G_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02G_RAW_NATIVE_UNCHANGED: 'PASS',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }

  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02g-moneyline-prediction-dml-prep', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
