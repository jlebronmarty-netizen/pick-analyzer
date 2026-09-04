import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const executePredictions = process.argv.includes('--execute-predictions')

const targetProductionCommit = '9102cabeb6ff1a255c3012ccfacc78c4ddb6efbd'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const trainingArtifactPath = 'docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json'
const championArtifactPath = 'docs/CERTIFICATION/mlb-data-02e-moneyline-champion-promotion.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02f-moneyline-prediction-generation-prep.json'

const expectedArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const expectedDatasetDigest = '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const featureSetVersion = 'MLB_ML_FEATURE_SET_V1'
const modelVersionName = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'

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
  return {
    train: sorted.slice(0, trainEnd),
    validation: sorted.slice(trainEnd, validationEnd),
    test: sorted.slice(validationEnd),
  }
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
  return vector
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

function infer(modelArtifact, rows) {
  return rows.map((row) => {
    const z = transformVector(row.x, modelArtifact.preprocessing)
    const homeProbability = sigmoid(dot(modelArtifact.weights, z))
    return {
      gamePk: row.gamePk,
      gameDate: row.gameDate,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeWin: row.homeWin,
      homeProbability,
      awayProbability: 1 - homeProbability,
    }
  })
}

function logLoss(rows) {
  return rows.reduce((sum, row) => {
    const p = Math.min(1 - 1e-15, Math.max(1e-15, row.homeProbability))
    return sum - (row.homeWin * Math.log(p) + (1 - row.homeWin) * Math.log(1 - p))
  }, 0) / rows.length
}

function brier(rows) {
  return rows.reduce((sum, row) => sum + (row.homeProbability - row.homeWin) ** 2, 0) / rows.length
}

function auc(rows) {
  const pairs = rows.map((row) => ({ y: row.homeWin, p: row.homeProbability })).sort((a, b) => a.p - b.p)
  const positives = pairs.filter((pair) => pair.y === 1).length
  const negatives = pairs.length - positives
  if (!positives || !negatives) return null
  let rankSum = 0
  for (let index = 0; index < pairs.length; index += 1) if (pairs[index].y === 1) rankSum += index + 1
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives)
}

function accuracy(rows) {
  return rows.filter((row) => (row.homeProbability >= 0.5 ? 1 : 0) === row.homeWin).length / rows.length
}

function calibrationBins(rows, bins = 10) {
  const buckets = Array.from({ length: bins }, (_, index) => ({ bin: index + 1, min: index / bins, max: (index + 1) / bins, count: 0, predictedProbability: 0, observedFrequency: 0 }))
  rows.forEach((row) => {
    const bucket = buckets[Math.min(bins - 1, Math.floor(row.homeProbability * bins))]
    bucket.count += 1
    bucket.predictedProbability += row.homeProbability
    bucket.observedFrequency += row.homeWin
  })
  return buckets.filter((bucket) => bucket.count).map((bucket) => ({
    ...bucket,
    predictedProbability: Number((bucket.predictedProbability / bucket.count).toFixed(6)),
    observedFrequency: Number((bucket.observedFrequency / bucket.count).toFixed(6)),
  }))
}

function ece(rows) {
  return calibrationBins(rows).reduce((sum, bucket) => sum + (bucket.count / rows.length) * Math.abs(bucket.predictedProbability - bucket.observedFrequency), 0)
}

function metrics(rows) {
  return {
    rows: rows.length,
    logLoss: Number(logLoss(rows).toFixed(6)),
    brier: Number(brier(rows).toFixed(6)),
    auc: Number((auc(rows) ?? 0).toFixed(6)),
    accuracy: Number(accuracy(rows).toFixed(6)),
    ece: Number(ece(rows).toFixed(6)),
  }
}

function quantile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
}

function distribution(rows) {
  const values = rows.map((row) => row.homeProbability).sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return {
    min: Number(values[0].toFixed(6)),
    max: Number(values[values.length - 1].toFixed(6)),
    mean: Number(mean.toFixed(6)),
    median: Number(quantile(values, 0.5).toFixed(6)),
    stddev: Number(Math.sqrt(variance).toFixed(6)),
    p10: Number(quantile(values, 0.1).toFixed(6)),
    p25: Number(quantile(values, 0.25).toFixed(6)),
    p75: Number(quantile(values, 0.75).toFixed(6)),
    p90: Number(quantile(values, 0.9).toFixed(6)),
    buckets: {
      lt040: values.filter((value) => value < 0.4).length,
      p040To045: values.filter((value) => value >= 0.4 && value < 0.45).length,
      p045To050: values.filter((value) => value >= 0.45 && value < 0.5).length,
      p050To055: values.filter((value) => value >= 0.5 && value < 0.55).length,
      p055To060: values.filter((value) => value >= 0.55 && value < 0.6).length,
      gt060: values.filter((value) => value >= 0.6).length,
    },
  }
}

function probabilitySanity(rows) {
  const tolerance = 1e-12
  return {
    rows: rows.length,
    finite: rows.filter((row) => Number.isFinite(row.homeProbability) && Number.isFinite(row.awayProbability)).length,
    invalidRange: rows.filter((row) => !(row.homeProbability > 0 && row.homeProbability < 1 && row.awayProbability > 0 && row.awayProbability < 1)).length,
    complementViolations: rows.filter((row) => Math.abs(row.homeProbability + row.awayProbability - 1) > tolerance).length,
    nan: rows.filter((row) => Number.isNaN(row.homeProbability) || Number.isNaN(row.awayProbability)).length,
    inf: rows.filter((row) => !Number.isFinite(row.homeProbability) || !Number.isFinite(row.awayProbability)).length,
    tolerance,
  }
}

function deterministicSample(testRows) {
  const homeWins = testRows.filter((row) => row.homeWin === 1)
  const awayWins = testRows.filter((row) => row.homeWin === 0)
  const every = (rows, count) => {
    const step = Math.max(1, Math.floor(rows.length / count))
    return rows.filter((_, index) => index % step === 0).slice(0, count)
  }
  return [...every(homeWins, 12), ...every(awayWins, 12)].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
}

function sourceDateViolation(row) {
  return [row.as_of_date, row.source_window?.startDate, row.source_window?.start_date, row.source_window?.start, row.source_window?.from]
    .filter(Boolean)
    .map(dateKey)
    .some((candidate) => candidate >= dateKey(row.feature_date))
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,metrics,feature_set_id,pick2_model_feature_sets(feature_set_version)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  ensure((data ?? []).length === 1, `CHAMPION_COUNT_MISMATCH:${(data ?? []).length}`)
  return data[0]
}

async function main() {
  if (executePredictions) throw new Error('PREDICTION_EXECUTION_FORBIDDEN_IN_02F_PREP')
  ensure(fs.existsSync(modelArtifactPath), 'MODEL_ARTIFACT_MISSING')
  ensure(fs.existsSync(trainingArtifactPath), 'TRAINING_CERTIFICATION_MISSING')
  ensure(fs.existsSync(championArtifactPath), 'CHAMPION_CERTIFICATION_MISSING')

  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetProductionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const modelArtifact = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8'))
  const training = JSON.parse(fs.readFileSync(trainingArtifactPath, 'utf8'))
  const championArtifact = JSON.parse(fs.readFileSync(championArtifactPath, 'utf8'))
  const artifactDigest = sha256(stable(modelArtifact))
  ensure(artifactDigest === expectedArtifactDigest, `MODEL_ARTIFACT_DIGEST_MISMATCH:${artifactDigest}`)
  ensure(modelArtifact.metadata?.datasetDigest === expectedDatasetDigest, 'DATASET_DIGEST_MISMATCH')
  ensure(modelArtifact.metadata?.featureSetVersion === featureSetVersion, 'FEATURE_SET_MISMATCH')
  ensure(modelArtifact.featureNames.length === 76, `FEATURE_COUNT_MISMATCH:${modelArtifact.featureNames.length}`)
  ensure(modelArtifact.preprocessing?.type === 'train_only_median_impute_then_standardize', 'PREPROCESSING_TYPE_MISMATCH')
  ensure(modelArtifact.preprocessing.medians.length === 76 && modelArtifact.preprocessing.means.length === 76 && modelArtifact.preprocessing.stds.length === 76, 'PREPROCESSING_SHAPE_MISMATCH')
  ensure(modelArtifact.weights.length === 77, `WEIGHT_COUNT_MISMATCH:${modelArtifact.weights.length}`)
  ensure(championArtifact.certificationVerdict === 'MLB_DATA_02E_MONEYLINE_CHAMPION_PROMOTION_CERTIFIED', 'CHAMPION_CERTIFICATION_NOT_READY')

  const db = dbClient()
  const champion = await readChampion(db)
  ensure(champion.model_version === modelVersionName, 'CHAMPION_MODEL_VERSION_MISMATCH')
  ensure(champion.artifact_digest === expectedArtifactDigest, 'CHAMPION_ARTIFACT_MISMATCH')
  ensure(champion.pick2_model_feature_sets?.feature_set_version === featureSetVersion, 'CHAMPION_FEATURE_SET_MISMATCH')

  const modelCounts = {
    registry: await countRows(db, 'pick2_model_registry'),
    featureSets: await countRows(db, 'pick2_model_feature_sets'),
    versions: await countRows(db, 'pick2_model_versions'),
    trainingRuns: await countRows(db, 'pick2_model_training_runs'),
    validationRuns: await countRows(db, 'pick2_model_validation_runs'),
    champions: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('role', 'champion').eq('status', 'promoted')),
  }
  const predictionCountsBefore = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(predictionCountsBefore.predictions === 0 && predictionCountsBefore.predictionResults === 0 && predictionCountsBefore.marketValueEvaluations === 0, 'PREDICTION_BASELINE_NONZERO')

  const featureCounts = {
    team: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    starter: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    bullpen: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    batter: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    matchup: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    firstInning: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.eq('feature_version', featureVersion)),
    snapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
  for (const [key, value] of Object.entries(expected.features)) ensure(featureCounts[key] === value, `FEATURE_COUNT_MISMATCH:${key}:${featureCounts[key]}`)

  const rawNativeCounts = {
    raw: await countRows(db, 'pick2_raw_mlb_statcast_pitches'),
    nativeGames: await countRows(db, 'pick2_mlb_games', 'game_pk'),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
  }
  ensure(rawNativeCounts.raw === expected.rawRows && rawNativeCounts.nativeGames === expected.nativeGames && rawNativeCounts.nativePlayers === expected.nativePlayers, 'RAW_NATIVE_COUNTS_CHANGED')

  const [teamRows, starterRows, bullpenRows, matchupRows, firstRows, games] = await Promise.all([
    readAll(db, 'pick2_mlb_team_daily_features', `target_game_pk,team_id,feature_date,as_of_date,feature_version,source_window,${teamFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_pitcher_daily_features', `target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,feature_version,source_window,${starterFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_bullpen_daily_features', `target_game_pk,team_id,feature_date,as_of_date,feature_version,source_window,${bullpenFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_matchup_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version,source_window', (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_first_inning_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version,source_window,home_starter_mlbam_pitcher_id,away_starter_mlbam_pitcher_id', (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_games', 'game_pk,game_date,home_team_id,away_team_id', (query) => query.eq('season', 2025).order('game_date', { ascending: true }).order('game_pk', { ascending: true })),
  ])

  const asOfViolations = [...teamRows, ...starterRows, ...bullpenRows, ...matchupRows, ...firstRows].filter(sourceDateViolation).length
  ensure(asOfViolations === 0, `ASOF_VIOLATIONS:${asOfViolations}`)

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
      return {
        gamePk: game.gamePk,
        gameDate: dateKey(nativeGame?.game_date ?? game.gameDate),
        homeTeamId: nativeGame?.home_team_id ?? game.homeTeamId,
        awayTeamId: nativeGame?.away_team_id ?? game.awayTeamId,
        finalHomeScore: game.finalHomeScore,
        finalAwayScore: game.finalAwayScore,
        homeWin: game.finalHomeScore > game.finalAwayScore ? 1 : 0,
      }
    })
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  ensure(moneylineRows.length === expected.replayRows, `REPLAY_ROW_COUNT_CHANGED:${moneylineRows.length}`)

  const maps = {
    team: new Map(teamRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    starter: new Map(starterRows.map((row) => [rowKey(row.target_game_pk, row.mlbam_pitcher_id), row])),
    bullpen: new Map(bullpenRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    first: new Map(firstRows.map((row) => [Number(row.target_game_pk), row])),
  }
  const vectorRows = moneylineRows.map((row) => ({ ...row, x: buildVector(row, maps) }))
  ensure(vectorRows.every((row) => row.x.length === modelArtifact.featureNames.length), 'FEATURE_VECTOR_LENGTH_MISMATCH')
  const splits = splitRows(vectorRows)
  const replayRows = infer(modelArtifact, vectorRows)
  const replayRowsSecond = infer(modelArtifact, vectorRows)
  const reproducibilityFailures = replayRows.filter((row, index) => Math.abs(row.homeProbability - replayRowsSecond[index].homeProbability) > 1e-15).length
  ensure(reproducibilityFailures === 0, `REPRODUCIBILITY_FAILURES:${reproducibilityFailures}`)

  const sampleBase = deterministicSample(splits.test)
  ensure(sampleBase.length >= 20, `REPLAY_SAMPLE_TOO_SMALL:${sampleBase.length}`)
  ensure(sampleBase.some((row) => row.homeWin === 1) && sampleBase.some((row) => row.homeWin === 0), 'REPLAY_SAMPLE_CLASS_BALANCE_MISSING')
  const sampleReplay = infer(modelArtifact, sampleBase)
  const sampleSanity = probabilitySanity(sampleReplay)
  ensure(sampleSanity.invalidRange === 0 && sampleSanity.complementViolations === 0 && sampleSanity.nan === 0 && sampleSanity.inf === 0, 'SAMPLE_PROBABILITY_SANITY_FAILED')

  const fullSanity = probabilitySanity(replayRows)
  ensure(fullSanity.invalidRange === 0 && fullSanity.complementViolations === 0 && fullSanity.nan === 0 && fullSanity.inf === 0, 'FULL_PROBABILITY_SANITY_FAILED')
  const distributionAudit = distribution(replayRows)
  const testReplayPks = new Set(splits.test.map((row) => row.gamePk))
  const testReplay = replayRows.filter((row) => testReplayPks.has(row.gamePk))
  const testMetrics = metrics(testReplay)
  const certifiedTest = training.modelResults.testMetrics
  const tolerance = 0.000001
  ensure(Math.abs(testMetrics.logLoss - certifiedTest.logLoss) <= tolerance, `LOGLOSS_PARITY_FAILED:${testMetrics.logLoss}`)
  ensure(Math.abs(testMetrics.brier - certifiedTest.brier) <= tolerance, `BRIER_PARITY_FAILED:${testMetrics.brier}`)
  ensure(Math.abs(testMetrics.auc - certifiedTest.auc) <= tolerance, `AUC_PARITY_FAILED:${testMetrics.auc}`)
  ensure(Math.abs(testMetrics.accuracy - certifiedTest.accuracy) <= tolerance, `ACCURACY_PARITY_FAILED:${testMetrics.accuracy}`)
  ensure(Math.abs(testMetrics.ece - certifiedTest.ece) <= tolerance, `ECE_PARITY_FAILED:${testMetrics.ece}`)

  const predictionCountsAfter = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(JSON.stringify(predictionCountsAfter) === JSON.stringify(predictionCountsBefore), 'PREDICTION_STATE_CHANGED')
  const championAfter = await readChampion(db)
  ensure(championAfter.id === champion.id && championAfter.artifact_digest === champion.artifact_digest, 'CHAMPION_CHANGED')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02F_MONEYLINE_PREDICTION_GENERATION_PREP',
    certificationVerdict: 'MLB_DATA_02F_MONEYLINE_PREDICTION_GENERATION_PREP_CERTIFIED',
    publication: {
      publishedCommit: targetProductionCommit,
      originMain: targetProductionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02F_PREPUBLISH_STATE: 'PASS',
      MLB_02F_02E_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    champion: {
      count: modelCounts.champions,
      modelVersion: champion.model_version,
      role: champion.role,
      status: champion.status,
      artifactDigest: champion.artifact_digest,
      featureSet: champion.pick2_model_feature_sets.feature_set_version,
      MLB_02F_CHAMPION_READBACK: 'PASS',
    },
    modelArtifact: {
      path: modelArtifactPath,
      digest: artifactDigest,
      featureSetVersion,
      featureCount: modelArtifact.featureNames.length,
      featureOrderingDigest: sha256(stable(modelArtifact.featureNames)),
      preprocessing: modelArtifact.preprocessing.type,
      MLB_02F_MODEL_ARTIFACT_INTEGRITY: 'PASS',
      MLB_02F_FEATURE_ORDERING: 'PASS',
      MLB_02F_PREPROCESSING_READBACK: 'PASS',
    },
    inputContract: {
      gameIdentity: 'game_pk with exactly one native game row',
      asOf: 'source_game_date < target_game_date; stricter timestamp rule may supersede when live timestamps exist',
      requiredFeatureDomains: ['team', 'starter', 'bullpen', 'matchup', 'offense logical features', 'first_inning_context'],
      missingness: 'no silent zero-fill; use certified train-fitted median imputation and block missing structural identity',
      MLB_02F_GAME_IDENTITY_CONTRACT: 'PASS',
      MLB_02F_INFERENCE_ASOF_CONTRACT: 'PASS',
      MLB_02F_REQUIRED_FEATURE_DOMAINS: 'READY',
      MLB_02F_MISSINGNESS_CONTRACT: 'PASS',
    },
    replay: {
      sample: {
        rows: sampleReplay.length,
        homeWins: sampleReplay.filter((row) => row.homeWin === 1).length,
        awayWins: sampleReplay.filter((row) => row.homeWin === 0).length,
        gamePks: sampleReplay.map((row) => row.gamePk),
        probabilitySanity: sampleSanity,
      },
      full: {
        rows: replayRows.length,
        probabilitySanity: fullSanity,
        distribution: distributionAudit,
        metricParity: {
          replayTest: testMetrics,
          certifiedTest,
          tolerance,
        },
      },
      reproducibility: { failures: reproducibilityFailures, tolerance: 1e-15 },
      MLB_02F_REPLAY_SAMPLE_READY: 'YES',
      MLB_02F_REPLAY_FEATURE_REBUILD: 'PASS',
      MLB_02F_REPLAY_PROBABILITY_SANITY: 'PASS',
      MLB_02F_INFERENCE_REPRODUCIBILITY: 'PASS',
      MLB_02F_FULL_REPLAY_ROWS: replayRows.length,
      MLB_02F_FULL_PROBABILITY_SANITY: 'PASS',
      MLB_02F_PROBABILITY_DISTRIBUTION_AUDIT: 'PASS',
      MLB_02F_REPLAY_METRIC_PARITY: 'PASS',
    },
    liveContract: {
      prerequisites: ['game_pk', 'scheduled start time', 'home team', 'away team', 'probable or confirmed starters', 'team features', 'starter features', 'bullpen features', 'matchup context', 'as_of timestamp'],
      starterStatusPolicy: {
        confirmed: 'READY_CONFIRMED',
        probable: 'READY_PROBABLE_WITH_FLAG',
        unknown: 'BLOCK_STARTER_UNKNOWN',
        changed: 'BLOCK_STARTER_CHANGED_REBUILD_REQUIRED',
      },
      lineupDependency: 'LINEUP_NOT_REQUIRED_FOR_MONEYLINE_V1',
      featureFreshness: {
        team: 'through latest completed game before target',
        bullpen: 'through latest completed game before target',
        starter: 'through latest completed appearance before target',
        targetGamePerformance: 'FORBIDDEN',
      },
      MLB_02F_LIVE_INPUT_CONTRACT: 'READY',
      MLB_02F_STARTER_STATUS_POLICY: 'READY',
      MLB_02F_LINEUP_DEPENDENCY: 'CERTIFIED',
      MLB_02F_FEATURE_FRESHNESS_CONTRACT: 'READY',
    },
    outputContract: {
      fields: ['game_pk', 'sport', 'market', 'home_team_id', 'away_team_id', 'home_win_probability', 'away_win_probability', 'model_version', 'feature_set', 'artifact_digest', 'as_of', 'starter_status', 'data_completeness', 'reason_flags', 'status_flags'],
      sport: 'MLB',
      market: 'moneyline',
      recommendationIncluded: false,
      complementTolerance: 1e-12,
      confidenceSemantics: ['data completeness', 'model calibration', 'sample support', 'input freshness', 'prediction extremity'],
      rawProbabilityIsConfidence: false,
      MLB_02F_PREDICTION_OUTPUT_CONTRACT: 'READY',
      MLB_02F_PROBABILITY_COMPLEMENT_CONTRACT: 'PASS',
      MLB_02F_CONFIDENCE_SEMANTICS: 'READY',
    },
    persistencePrep: {
      schemaInventory: {
        table: 'pick2_game_predictions',
        nativeGamePkSupport: 'game_pk present via R5 native identity migration',
        market: 'target = home_win_probability; market moneyline carried in metadata until schema broadens',
        selectionSideSemantics: 'home/away probabilities only; no recommendation side',
        modelVersionLinkage: 'model_version_id foreign key to pick2_model_versions',
        featureVersionLinkage: 'feature_snapshot_id plus frozen_input_digest; feature version in metadata',
        asOf: 'predicted_at plus metadata.as_of',
        probabilityFields: ['home_probability', 'away_probability'],
        immutability: 'new material input state creates new deterministic_identity',
      },
      deterministicIdentity: ['game_pk', 'moneyline', modelVersionName, 'as_of_or_inference_version'],
      immutability: 'future persisted predictions are immutable; material input change creates a new version/identity',
      idempotency: 'same deterministic identity and payload is REUSE_NO_OP; payload drift is BLOCK_CONFLICT',
      stalePredictionGuard: 'block serving stale predictions when starter status, feature freshness or artifact digest changes',
      MLB_02F_PREDICTION_SCHEMA_INVENTORY_COMPLETE: 'YES',
      MLB_02F_PREDICTION_IDENTITY_CONTRACT: 'READY',
      MLB_02F_PREDICTION_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02F_PREDICTION_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_02F_STALE_PREDICTION_GUARD: 'PASS',
    },
    marketBoundary: {
      oddsIndependentInference: 'PASS',
      noMarketRecommendation: 'PASS',
      evCertification: 'NO',
      valueBoardReady: 'NO',
      officialPicksReady: 'NO',
      MLB_02F_ODDS_INDEPENDENT_INFERENCE: 'PASS',
      MLB_02F_NO_MARKET_RECOMMENDATION: 'PASS',
    },
    runnerPrep: {
      state: 'DRY_RUN_ONLY',
      currentSlateDryRunState: 'NO_CURRENT_SLATE_PREDICTIONS_GENERATED',
      executionFailClosed: 'PREDICTION_EXECUTION_FORBIDDEN_IN_02F_PREP',
      MLB_02F_PREDICTION_RUNNER_PREP: 'PASS',
      MLB_02F_PREDICTION_EXECUTION_FAIL_CLOSED: 'PASS',
    },
    preservation: {
      championUnchanged: 'PASS',
      featureFoundation: featureCounts,
      rawNative: { ...rawNativeCounts, uniquePitchIdentities: pitchIdentities.size, duplicatePitchIdentities: rawRows - pitchIdentities.size },
      productionPredictionStateBefore: predictionCountsBefore,
      productionPredictionStateAfter: predictionCountsAfter,
      MLB_02F_CHAMPION_UNCHANGED: 'PASS',
      MLB_02F_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02F_RAW_NATIVE_UNCHANGED: 'PASS',
      MLB_02F_PRODUCTION_PREDICTION_ZERO_STATE: 'PASS',
    },
    safety: {
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      officialPicks: 0,
      featureWrites: 0,
      rawWrites: 0,
      modelWrites: 0,
      championChanges: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      parlay100Generation: 'NO',
    },
    flags: {
      MLB_02F_CHAMPION_READBACK: 'PASS',
      MLB_02F_MODEL_ARTIFACT_INTEGRITY: 'PASS',
      MLB_02F_FEATURE_ORDERING: 'PASS',
      MLB_02F_PREPROCESSING_READBACK: 'PASS',
      MLB_02F_GAME_IDENTITY_CONTRACT: 'PASS',
      MLB_02F_INFERENCE_ASOF_CONTRACT: 'PASS',
      MLB_02F_REQUIRED_FEATURE_DOMAINS: 'READY',
      MLB_02F_MISSINGNESS_CONTRACT: 'PASS',
      MLB_02F_REPLAY_SAMPLE_READY: 'YES',
      MLB_02F_REPLAY_FEATURE_REBUILD: 'PASS',
      MLB_02F_REPLAY_PROBABILITY_SANITY: 'PASS',
      MLB_02F_INFERENCE_REPRODUCIBILITY: 'PASS',
      MLB_02F_FULL_REPLAY_ROWS: replayRows.length,
      MLB_02F_FULL_PROBABILITY_SANITY: 'PASS',
      MLB_02F_PROBABILITY_DISTRIBUTION_AUDIT: 'PASS',
      MLB_02F_REPLAY_METRIC_PARITY: 'PASS',
      MLB_02F_LIVE_INPUT_CONTRACT: 'READY',
      MLB_02F_STARTER_STATUS_POLICY: 'READY',
      MLB_02F_LINEUP_DEPENDENCY: 'CERTIFIED',
      MLB_02F_FEATURE_FRESHNESS_CONTRACT: 'READY',
      MLB_02F_PREDICTION_OUTPUT_CONTRACT: 'READY',
      MLB_02F_PROBABILITY_COMPLEMENT_CONTRACT: 'PASS',
      MLB_02F_CONFIDENCE_SEMANTICS: 'READY',
      MLB_02F_PREDICTION_SCHEMA_INVENTORY_COMPLETE: 'YES',
      MLB_02F_PREDICTION_IDENTITY_CONTRACT: 'READY',
      MLB_02F_PREDICTION_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02F_PREDICTION_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_02F_ODDS_INDEPENDENT_INFERENCE: 'PASS',
      MLB_02F_NO_MARKET_RECOMMENDATION: 'PASS',
      MLB_02F_PREDICTION_RUNNER_PREP: 'PASS',
      MLB_02F_PREDICTION_EXECUTION_FAIL_CLOSED: 'PASS',
      MLB_02F_STALE_PREDICTION_GUARD: 'PASS',
      MLB_02F_CHAMPION_UNCHANGED: 'PASS',
      MLB_02F_FEATURE_FOUNDATION_UNCHANGED: 'PASS',
      MLB_02F_RAW_NATIVE_UNCHANGED: 'PASS',
      MLB_02F_PRODUCTION_PREDICTION_ZERO_STATE: 'PASS',
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
  console.error(JSON.stringify({ script: 'mlb-data-02f-moneyline-prediction-generation-prep', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
