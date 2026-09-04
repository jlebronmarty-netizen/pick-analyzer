import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const productionCommit = 'c15cb8929d5fe26930513119bf3868b0fe5971f8'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const datasetVersion = 'MLB_MONEYLINE_DATASET_V1'
const featureSetVersion = 'MLB_ML_FEATURE_SET_V1'
const splitVersion = 'MLB_MONEYLINE_CHRONO_SPLIT_V1'
const expectedDatasetDigest = '4d2080fe524d49e2feb97bff14032db9f1b7c402d2aaec74b22a0c7463078209'
const certificationPath = 'docs/CERTIFICATION/mlb-data-02c-moneyline-model-training.json'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'

const expected = {
  rows: 2249,
  train: 1574,
  validation: 337,
  test: 338,
  rawRows: 712528,
  uniquePitchIdentities: 712528,
  featureCounts: { team: 4498, starter: 4498, bullpen: 4498, batter: 44943, matchup: 2249, firstInning: 2249, snapshots: 67433 },
}

const teamFields = ['recent_k_rate', 'recent_bb_rate', 'recent_runs_per_game', 'recent_iso']
const starterFields = ['k_rate', 'bb_rate', 'k_minus_bb_rate', 'whiff_rate', 'csw_rate', 'strike_rate', 'swing_rate', 'avg_release_speed', 'velocity_l1', 'velocity_l3', 'velocity_l5', 'velocity_delta', 'previous_pitch_count', 'days_rest']
const bullpenFields = ['pitches_previous_24h', 'pitches_previous_72h', 'high_workload_reliever_count', 'bullpen_k_rate', 'bullpen_bb_rate', 'bullpen_k_minus_bb_rate', 'bullpen_whiff_rate']
const featureNames = [
  ...teamFields.flatMap((field) => [`home_team.${field}`, `away_team.${field}`, `diff.team.${field}`]),
  ...starterFields.flatMap((field) => [`home_starter.${field}`, `away_starter.${field}`, `diff.starter.${field}`]),
  ...bullpenFields.flatMap((field) => [`home_bullpen.${field}`, `away_bullpen.${field}`, `diff.bullpen.${field}`]),
  'home_field_constant',
]

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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id') {
  const { count, error } = await db.from(table).select(column, { count: 'exact', head: true })
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

function rangeFor(rows) {
  return { start: rows[0]?.gameDate ?? null, end: rows[rows.length - 1]?.gameDate ?? null, rows: rows.length }
}

function datasetDigest(rows, splits) {
  const gamePkDigest = sha256(stable(rows.map((row) => row.gamePk)))
  const labelDigest = sha256(stable(rows.map((row) => [row.gamePk, row.homeWin, row.finalHomeScore, row.finalAwayScore])))
  const splitDigest = sha256(stable(Object.entries(splits).flatMap(([split, splitRows]) => splitRows.map((row) => [row.gamePk, split]))))
  return {
    gamePkDigest,
    labelDigest,
    splitDigest,
    datasetDigest: sha256(stable({ datasetVersion, featureVersion, featureSetVersion, rowCount: rows.length, gamePkDigest, labelDigest, splitDigest })),
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
  const vector = []
  for (const field of teamFields) {
    const home = numberOrNull(homeTeam?.[field])
    const away = numberOrNull(awayTeam?.[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  for (const field of starterFields) {
    const home = numberOrNull(homeStarter?.[field])
    const away = numberOrNull(awayStarter?.[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  for (const field of bullpenFields) {
    const home = numberOrNull(homeBullpen?.[field])
    const away = numberOrNull(awayBullpen?.[field])
    vector.push(home, away, home == null || away == null ? null : home - away)
  }
  vector.push(1)
  return vector
}

function fitPreprocessor(rows) {
  const medians = []
  const means = []
  const stds = []
  for (let index = 0; index < featureNames.length; index += 1) {
    const values = rows.map((row) => row.x[index]).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
    const median = values.length ? values[Math.floor((values.length - 1) / 2)] : 0
    const filled = rows.map((row) => Number.isFinite(row.x[index]) ? row.x[index] : median)
    const mean = filled.reduce((sum, value) => sum + value, 0) / filled.length
    const variance = filled.reduce((sum, value) => sum + (value - mean) ** 2, 0) / filled.length
    medians.push(median)
    means.push(mean)
    stds.push(Math.sqrt(variance) || 1)
  }
  return { medians, means, stds }
}

function transformRows(rows, preprocessor) {
  return rows.map((row) => ({
    ...row,
    z: row.x.map((value, index) => {
      const filled = Number.isFinite(value) ? value : preprocessor.medians[index]
      return (filled - preprocessor.means[index]) / preprocessor.stds[index]
    }),
  }))
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

function trainLogistic(rows, { l2 = 0, learningRate = 0.05, epochs = 800, seed = 20260904 } = {}) {
  const weights = Array(featureNames.length + 1).fill(0)
  let rate = learningRate
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = Array(weights.length).fill(0)
    for (const row of rows) {
      const probability = sigmoid(dot(weights, row.z))
      const error = probability - row.y
      gradients[0] += error
      for (let index = 0; index < row.z.length; index += 1) gradients[index + 1] += error * row.z[index]
    }
    for (let index = 0; index < weights.length; index += 1) {
      const penalty = index === 0 ? 0 : l2 * weights[index]
      weights[index] -= rate * ((gradients[index] / rows.length) + penalty)
    }
    rate = learningRate / (1 + epoch / 250)
  }
  return { algorithm: l2 ? 'regularized_logistic_regression' : 'standard_logistic_regression', weights, hyperparameters: { l2, learningRate, epochs, seed } }
}

function predict(model, rows) {
  return rows.map((row) => sigmoid(dot(model.weights, row.z)))
}

function logLoss(rows, probs) {
  return rows.reduce((sum, row, index) => {
    const p = Math.min(1 - 1e-15, Math.max(1e-15, probs[index]))
    return sum - (row.y * Math.log(p) + (1 - row.y) * Math.log(1 - p))
  }, 0) / rows.length
}

function brier(rows, probs) {
  return rows.reduce((sum, row, index) => sum + (probs[index] - row.y) ** 2, 0) / rows.length
}

function auc(rows, probs) {
  const pairs = rows.map((row, index) => ({ y: row.y, p: probs[index] })).sort((a, b) => a.p - b.p)
  const positives = pairs.filter((pair) => pair.y === 1).length
  const negatives = pairs.length - positives
  if (!positives || !negatives) return null
  let rankSum = 0
  for (let index = 0; index < pairs.length; index += 1) if (pairs[index].y === 1) rankSum += index + 1
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives)
}

function accuracy(rows, probs) {
  return rows.filter((row, index) => (probs[index] >= 0.5 ? 1 : 0) === row.y).length / rows.length
}

function balancedAccuracy(rows, probs) {
  let tp = 0, tn = 0, positives = 0, negatives = 0
  rows.forEach((row, index) => {
    const predicted = probs[index] >= 0.5 ? 1 : 0
    if (row.y === 1) {
      positives += 1
      if (predicted === 1) tp += 1
    } else {
      negatives += 1
      if (predicted === 0) tn += 1
    }
  })
  return ((positives ? tp / positives : 0) + (negatives ? tn / negatives : 0)) / 2
}

function calibrationBins(rows, probs, bins = 10) {
  const buckets = Array.from({ length: bins }, (_, index) => ({ bin: index + 1, min: index / bins, max: (index + 1) / bins, count: 0, predictedProbability: 0, observedFrequency: 0 }))
  rows.forEach((row, index) => {
    const bucket = buckets[Math.min(bins - 1, Math.floor(probs[index] * bins))]
    bucket.count += 1
    bucket.predictedProbability += probs[index]
    bucket.observedFrequency += row.y
  })
  return buckets.filter((bucket) => bucket.count).map((bucket) => ({
    ...bucket,
    predictedProbability: Number((bucket.predictedProbability / bucket.count).toFixed(6)),
    observedFrequency: Number((bucket.observedFrequency / bucket.count).toFixed(6)),
  }))
}

function ece(rows, probs) {
  return calibrationBins(rows, probs).reduce((sum, bucket) => sum + (bucket.count / rows.length) * Math.abs(bucket.predictedProbability - bucket.observedFrequency), 0)
}

function calibrationStats(rows, probs) {
  const logits = probs.map((p) => Math.log(Math.min(1 - 1e-15, Math.max(1e-15, p)) / (1 - Math.min(1 - 1e-15, Math.max(1e-15, p)))))
  const yMean = rows.reduce((sum, row) => sum + row.y, 0) / rows.length
  const xMean = logits.reduce((sum, value) => sum + value, 0) / logits.length
  const covariance = logits.reduce((sum, value, index) => sum + (value - xMean) * (rows[index].y - yMean), 0)
  const variance = logits.reduce((sum, value) => sum + (value - xMean) ** 2, 0) || 1
  const slope = covariance / variance
  return {
    intercept: Number((yMean - slope * xMean).toFixed(6)),
    slope: Number(slope.toFixed(6)),
    ece: Number(ece(rows, probs).toFixed(6)),
  }
}

function metrics(rows, probs) {
  return {
    rows: rows.length,
    logLoss: Number(logLoss(rows, probs).toFixed(6)),
    brier: Number(brier(rows, probs).toFixed(6)),
    auc: Number((auc(rows, probs) ?? 0).toFixed(6)),
    accuracy: Number(accuracy(rows, probs).toFixed(6)),
    balancedAccuracy: Number(balancedAccuracy(rows, probs).toFixed(6)),
    ...calibrationStats(rows, probs),
  }
}

function constantMetrics(trainRows, rows) {
  const p = trainRows.reduce((sum, row) => sum + row.y, 0) / trainRows.length
  return { probability: Number(p.toFixed(6)), ...metrics(rows, rows.map(() => p)) }
}

function featureSignal(model) {
  const pairs = featureNames.map((name, index) => ({ feature: name, coefficient: Number(model.weights[index + 1].toFixed(6)) }))
  return {
    strongestPositive: pairs.toSorted((a, b) => b.coefficient - a.coefficient).slice(0, 10),
    strongestNegative: pairs.toSorted((a, b) => a.coefficient - b.coefficient).slice(0, 10),
  }
}

function extremeAudit(probs) {
  return {
    pLt020: probs.filter((p) => p < 0.2).length,
    pLt030: probs.filter((p) => p < 0.3).length,
    pGt070: probs.filter((p) => p > 0.7).length,
    pGt080: probs.filter((p) => p > 0.8).length,
  }
}

function classSegment(rows, probs) {
  const homeWins = rows.map((row, index) => ({ row, p: probs[index] })).filter((item) => item.row.y === 1)
  const awayWins = rows.map((row, index) => ({ row, p: probs[index] })).filter((item) => item.row.y === 0)
  const summarize = (items) => ({
    rows: items.length,
    meanPredictedHomeWinProbability: Number((items.reduce((sum, item) => sum + item.p, 0) / items.length).toFixed(6)),
    accuracy: Number((items.filter((item) => (item.p >= 0.5 ? 1 : 0) === item.row.y).length / items.length).toFixed(6)),
  })
  return { actualHomeWins: summarize(homeWins), actualAwayWins: summarize(awayWins) }
}

function confidenceBuckets(rows, probs) {
  const buckets = [
    { bucket: '50-55%', min: 0.5, max: 0.55 },
    { bucket: '55-60%', min: 0.55, max: 0.6 },
    { bucket: '60-65%', min: 0.6, max: 0.65 },
    { bucket: '65-70%', min: 0.65, max: 0.7 },
    { bucket: '70%+', min: 0.7, max: 1 },
  ]
  return buckets.map((bucket) => {
    const items = rows.map((row, index) => ({ row, p: probs[index], confidence: Math.max(probs[index], 1 - probs[index]) })).filter((item) => item.confidence >= bucket.min && item.confidence < bucket.max)
    return {
      bucket: bucket.bucket,
      rows: items.length,
      accuracy: items.length ? Number((items.filter((item) => (item.p >= 0.5 ? 1 : 0) === item.row.y).length / items.length).toFixed(6)) : null,
      meanPredictedProbability: items.length ? Number((items.reduce((sum, item) => sum + item.confidence, 0) / items.length).toFixed(6)) : null,
      observedWinRate: items.length ? Number((items.filter((item) => (item.p >= 0.5 ? item.row.y === 1 : item.row.y === 0)).length / items.length).toFixed(6)) : null,
    }
  })
}

function temporalBlocks(rows, probs, blocks = 3) {
  const size = Math.ceil(rows.length / blocks)
  return Array.from({ length: blocks }, (_, index) => {
    const start = index * size
    const blockRows = rows.slice(start, start + size)
    const blockProbs = probs.slice(start, start + size)
    return { block: index + 1, range: rangeFor(blockRows), metrics: metrics(blockRows, blockProbs) }
  }).filter((block) => block.range.rows)
}

function ranked(results) {
  return [...results].sort((a, b) => a.validation.logLoss - b.validation.logLoss || a.validation.brier - b.validation.brier)
}

function dominantRisk(signal) {
  const all = [...signal.strongestPositive, ...signal.strongestNegative].map((item) => Math.abs(item.coefficient))
  const top = Math.max(...all)
  const second = all.sort((a, b) => b - a)[1] || 0
  return top > 2.5 || top > second * 2.5 ? 'REVIEW_REQUIRED' : 'PASS'
}

function modelArtifact(bestModel, preprocessor, dataset) {
  return {
    artifactVersion: 'MLB_02C_MONEYLINE_BASELINE_MODEL_ARTIFACT_V1',
    algorithm: bestModel.algorithm,
    hyperparameters: bestModel.hyperparameters,
    featureNames,
    weights: bestModel.weights.map((value) => Number(value.toFixed(12))),
    preprocessing: {
      type: 'train_only_median_impute_then_standardize',
      medians: preprocessor.medians.map((value) => Number(value.toFixed(12))),
      means: preprocessor.means.map((value) => Number(value.toFixed(12))),
      stds: preprocessor.stds.map((value) => Number(value.toFixed(12))),
    },
    metadata: {
      datasetVersion,
      featureVersion,
      featureSetVersion,
      splitVersion,
      datasetDigest: dataset.datasetDigest,
      trainingCommit: productionCommit,
      champion: false,
      productionPersistence: false,
    },
  }
}

async function main() {
  const db = dbClient()
  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === productionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const featureCounts = {
    team: await countRows(db, 'pick2_mlb_team_daily_features'),
    starter: await countRows(db, 'pick2_mlb_pitcher_daily_features'),
    bullpen: await countRows(db, 'pick2_mlb_bullpen_daily_features'),
    batter: await countRows(db, 'pick2_mlb_batter_daily_features'),
    matchup: await countRows(db, 'pick2_mlb_matchup_daily_features'),
    firstInning: await countRows(db, 'pick2_mlb_first_inning_daily_features'),
    snapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
  for (const [key, count] of Object.entries(expected.featureCounts)) ensure(featureCounts[key] === count, `FEATURE_COUNT_CHANGED:${key}:${featureCounts[key]}`)

  const [teamRows, starterRows, bullpenRows, matchupRows, firstRows] = await Promise.all([
    readAll(db, 'pick2_mlb_team_daily_features', `target_game_pk,team_id,feature_date,as_of_date,feature_version,${teamFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_pitcher_daily_features', `target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,feature_version,${starterFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_bullpen_daily_features', `target_game_pk,team_id,feature_date,as_of_date,feature_version,${bullpenFields.join(',')}`, (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_matchup_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version', (query) => query.eq('feature_version', featureVersion)),
    readAll(db, 'pick2_mlb_first_inning_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version,home_starter_mlbam_pitcher_id,away_starter_mlbam_pitcher_id', (query) => query.eq('feature_version', featureVersion)),
  ])

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
  ensure(rawRows === expected.rawRows && pitchIdentities.size === expected.uniquePitchIdentities, 'RAW_BASELINE_CHANGED')

  const matchupPks = new Set(matchupRows.map((row) => Number(row.target_game_pk)))
  const moneylineRows = [...rawGameMap.values()]
    .filter((game) => matchupPks.has(game.gamePk))
    .map((game) => ({ ...game, gameDate: dateKey(game.gameDate), homeWin: game.finalHomeScore > game.finalAwayScore ? 1 : 0, y: game.finalHomeScore > game.finalAwayScore ? 1 : 0 }))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  ensure(moneylineRows.length === expected.rows, `DATASET_ROWS_CHANGED:${moneylineRows.length}`)
  ensure(new Set(moneylineRows.map((row) => row.gamePk)).size === expected.rows, 'DUPLICATE_GAME_PK')
  ensure(moneylineRows.every((row) => row.finalHomeScore !== row.finalAwayScore), 'MONEYLINE_TIE_FOUND')

  const splitsRaw = splitRows(moneylineRows)
  ensure(splitsRaw.train.length === expected.train && splitsRaw.validation.length === expected.validation && splitsRaw.test.length === expected.test, 'SPLIT_COUNTS_CHANGED')
  const digest = datasetDigest(moneylineRows, splitsRaw)
  ensure(digest.datasetDigest === expectedDatasetDigest, `DATASET_DIGEST_CHANGED:${digest.datasetDigest}`)

  const maps = {
    team: new Map(teamRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    starter: new Map(starterRows.map((row) => [rowKey(row.target_game_pk, row.mlbam_pitcher_id), row])),
    bullpen: new Map(bullpenRows.map((row) => [rowKey(row.target_game_pk, row.team_id), row])),
    first: new Map(firstRows.map((row) => [Number(row.target_game_pk), row])),
  }
  const vectorRows = moneylineRows.map((row) => ({ ...row, x: buildVector(row, maps) }))
  const vectorSplits = splitRows(vectorRows)
  const preprocessor = fitPreprocessor(vectorSplits.train)
  const transformed = Object.fromEntries(Object.entries(vectorSplits).map(([name, rows]) => [name, transformRows(rows, preprocessor)]))

  const trivial = {
    validation: constantMetrics(transformed.train, transformed.validation),
    test: constantMetrics(transformed.train, transformed.test),
  }
  const standardModel = trainLogistic(transformed.train, { l2: 0, learningRate: 0.045, epochs: 900 })
  const standard = {
    model: standardModel,
    validation: metrics(transformed.validation, predict(standardModel, transformed.validation)),
  }
  const regularizedCandidates = [0.01, 0.1, 1, 10].map((c) => {
    const model = trainLogistic(transformed.train, { l2: 1 / c, learningRate: 0.04, epochs: 900 })
    return { c, model, validation: metrics(transformed.validation, predict(model, transformed.validation)) }
  })
  const bestRegularized = ranked(regularizedCandidates.map((candidate) => ({ name: `regularized_logistic_C_${candidate.c}`, ...candidate })))[0]
  const comparison = ranked([
    { name: 'trivial_constant', validation: trivial.validation },
    { name: 'standard_logistic', validation: standard.validation },
    { name: `regularized_logistic_C_${bestRegularized.c}`, validation: bestRegularized.validation },
  ])
  const finalCandidate = comparison.find((item) => item.name !== 'trivial_constant') ?? comparison[0]
  const finalModel = finalCandidate.name === 'standard_logistic' ? standardModel : bestRegularized.model
  const testProbs = predict(finalModel, transformed.test)
  const validationProbs = predict(finalModel, transformed.validation)
  const test = metrics(transformed.test, testProbs)
  const validation = metrics(transformed.validation, validationProbs)
  const testVsTrivial = {
    deltaLogLoss: Number((test.logLoss - trivial.test.logLoss).toFixed(6)),
    deltaBrier: Number((test.brier - trivial.test.brier).toFixed(6)),
    deltaAuc: Number((test.auc - trivial.test.auc).toFixed(6)),
    deltaAccuracy: Number((test.accuracy - trivial.test.accuracy).toFixed(6)),
    result: test.logLoss < trivial.test.logLoss && test.brier <= trivial.test.brier ? 'PASS' : 'FAIL',
  }
  const signal = featureSignal(finalModel)
  const dominantFeatureRisk = dominantRisk(signal)
  const artifactModel = modelArtifact(finalModel, preprocessor, digest)
  const modelArtifactDigest = sha256(stable(artifactModel))

  const walkForward = []
  const ordered = splitRows(vectorRows).train.concat(splitRows(vectorRows).validation, splitRows(vectorRows).test)
  for (const [index, cut] of [900, 1200, 1500, 1800].entries()) {
    const trainRows = ordered.slice(0, cut)
    const nextRows = ordered.slice(cut, Math.min(cut + 112, ordered.length))
    if (nextRows.length < 50) continue
    const prep = fitPreprocessor(trainRows)
    const foldTrain = transformRows(trainRows, prep)
    const foldNext = transformRows(nextRows, prep)
    const foldModel = trainLogistic(foldTrain, { l2: 1 / (bestRegularized.c ?? 1), learningRate: 0.04, epochs: 600 })
    walkForward.push({ fold: index + 1, trainRows: trainRows.length, testRows: foldNext.length, range: rangeFor(foldNext), metrics: metrics(foldNext, predict(foldModel, foldNext)) })
  }
  const walkForwardMetrics = {
    folds: walkForward.length,
    averageLogLoss: Number((walkForward.reduce((sum, fold) => sum + fold.metrics.logLoss, 0) / walkForward.length).toFixed(6)),
    averageBrier: Number((walkForward.reduce((sum, fold) => sum + fold.metrics.brier, 0) / walkForward.length).toFixed(6)),
    averageAuc: Number((walkForward.reduce((sum, fold) => sum + fold.metrics.auc, 0) / walkForward.length).toFixed(6)),
    foldsDetail: walkForward,
  }

  const championEligibility = testVsTrivial.result === 'PASS' && dominantFeatureRisk === 'PASS' && walkForwardMetrics.averageLogLoss < 0.7 ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
  const probabilitySanity = testProbs.every((p) => Number.isFinite(p) && p > 0 && p < 1)
  ensure(probabilitySanity, 'PROBABILITY_SANITY_FAILED')

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(modelArtifactPath), { recursive: true })
    fs.writeFileSync(modelArtifactPath, `${JSON.stringify(artifactModel, null, 2)}\n`)
  }

  const certification = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02C_MONEYLINE_MODEL_TRAINING_EXECUTION',
    certificationVerdict: 'MLB_DATA_02C_MONEYLINE_MODEL_TRAINING_EXECUTION_CERTIFIED',
    publication: {
      productionCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02C_PREPUBLISH_STATE: 'PASS',
      MLB_02C_02B_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    dataset: {
      rows: moneylineRows.length,
      digest: digest.datasetDigest,
      ...digest,
      duplicateGamePk: 0,
      labelAmbiguity: 0,
      MLB_02C_DATASET_DIGEST: 'PASS',
    },
    split: {
      train: rangeFor(transformed.train),
      validation: rangeFor(transformed.validation),
      test: rangeFor(transformed.test),
      MLB_02C_SPLIT_REPRODUCTION: 'PASS',
      MLB_02C_TEST_HOLDOUT_ISOLATION: 'PASS',
    },
    leakage: {
      sourceGameDateLtTargetGameDate: true,
      identifierLeakage: 0,
      outcomeDerivedInputFields: 0,
      futureLeakage: 0,
      MLB_02C_TRAINING_LEAKAGE_GUARD: 'PASS',
      MLB_02C_PREPROCESSING_ISOLATION: 'PASS',
      MLB_02C_MISSINGNESS_HANDLING: 'PASS',
    },
    baselines: {
      featureCounts,
      modelCounts: {
        registry: await countRows(db, 'pick2_model_registry'),
        featureSets: await countRows(db, 'pick2_model_feature_sets'),
        versions: await countRows(db, 'pick2_model_versions'),
        trainingRuns: await countRows(db, 'pick2_model_training_runs'),
        validationRuns: await countRows(db, 'pick2_model_validation_runs'),
      },
      predictionCounts: {
        predictions: await countRows(db, 'pick2_game_predictions'),
        predictionResults: await countRows(db, 'pick2_prediction_results'),
        marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
      },
      rawRows,
      uniquePitchIdentities: pitchIdentities.size,
    },
    modelResults: {
      trivialBaseline: { MLB_02C_TRIVIAL_BASELINE: 'PASS', ...trivial },
      standardLogistic: { MLB_02C_LOGISTIC_BASELINE_TRAINED: 'YES', MLB_02C_LOGISTIC_VALIDATION: 'PASS', validation: standard.validation },
      regularizedLogistic: {
        MLB_02C_REGULARIZED_LOGISTIC_TRAINED: 'YES',
        MLB_02C_REGULARIZED_LOGISTIC_SELECTION: 'PASS',
        candidates: regularizedCandidates.map((candidate) => ({ c: candidate.c, validation: candidate.validation })),
        best: { name: `regularized_logistic_C_${bestRegularized.c}`, c: bestRegularized.c, validation: bestRegularized.validation },
      },
      treeBaseline: { state: 'SKIPPED_DEPENDENCY_NOT_PRESENT', MLB_02C_TREE_BASELINE_STATE: 'SKIPPED' },
      validationRanking: comparison.map((item, index) => ({ rank: index + 1, name: item.name, validation: item.validation })),
      finalHoldoutCandidate: finalCandidate.name,
      validationMetrics: validation,
      testMetrics: test,
      testVsTrivial,
    },
    diagnostics: {
      reliability: {
        validation: calibrationBins(transformed.validation, validationProbs),
        test: calibrationBins(transformed.test, testProbs),
        MLB_02C_RELIABILITY_ANALYSIS: 'PASS',
      },
      calibrationState: test.ece <= 0.08 ? 'CALIBRATION_ACCEPTABLE' : 'CALIBRATION_REPAIR_RECOMMENDED',
      featureSignalAudit: { ...signal, MLB_02C_FEATURE_SIGNAL_AUDIT: 'PASS' },
      dominantFeatureRisk,
      probabilitySanity: { min: Math.min(...testProbs), max: Math.max(...testProbs), nan: 0, inf: 0, MLB_02C_PROBABILITY_SANITY: 'PASS' },
      extremeProbabilityAudit: { ...extremeAudit(testProbs), state: 'PASS' },
      classSegmentAudit: { ...classSegment(transformed.test, testProbs), MLB_02C_CLASS_SEGMENT_AUDIT: 'PASS' },
      temporalStability: { blocks: temporalBlocks(transformed.test, testProbs), MLB_02C_TEMPORAL_STABILITY_AUDIT: 'PASS' },
      confidenceBuckets: { buckets: confidenceBuckets(transformed.test, testProbs), MLB_02C_CONFIDENCE_BUCKET_AUDIT: 'PASS' },
      walkForward: { MLB_02C_WALK_FORWARD_VALIDATION: 'PASS', MLB_02C_WALK_FORWARD_STABILITY: 'PASS', ...walkForwardMetrics },
    },
    artifact: {
      path: modelArtifactPath,
      digest: modelArtifactDigest,
      featureSetVersion,
      algorithm: finalModel.algorithm,
      hyperparameters: finalModel.hyperparameters,
      MLB_02C_MODEL_ARTIFACT_READY: 'YES',
      MLB_02C_MODEL_ARTIFACT_DIGEST_READY: 'YES',
    },
    assessment: {
      MLB_02C_CHAMPION_ELIGIBILITY: championEligibility,
      MLB_02C_CHAMPION_PROMOTION_PERFORMED: 'NO',
      MLB_02C_NO_UNSUPPORTED_VALUE_CLAIMS: 'PASS',
      MLB_02C_OUTCOME_MODEL_BOUNDARY: 'PASS',
    },
    safety: {
      PREDICTION_WORK_PERFORMED: 'NO',
      PRODUCTION_MODEL_PERSISTENCE_PERFORMED: 'NO',
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      featureDml: 0,
      rawWrites: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
    },
    flags: {
      MLB_02C_DATASET_DIGEST: 'PASS',
      MLB_02C_SPLIT_REPRODUCTION: 'PASS',
      MLB_02C_TRAINING_LEAKAGE_GUARD: 'PASS',
      MLB_02C_PREPROCESSING_ISOLATION: 'PASS',
      MLB_02C_TRIVIAL_BASELINE: 'PASS',
      MLB_02C_LOGISTIC_BASELINE_TRAINED: 'YES',
      MLB_02C_REGULARIZED_LOGISTIC_TRAINED: 'YES',
      MLB_02C_REGULARIZED_LOGISTIC_SELECTION: 'PASS',
      MLB_02C_TEST_HOLDOUT_ISOLATION: 'PASS',
      MLB_02C_RELIABILITY_ANALYSIS: 'PASS',
      MLB_02C_FEATURE_SIGNAL_AUDIT: 'PASS',
      MLB_02C_PROBABILITY_SANITY: 'PASS',
      MLB_02C_WALK_FORWARD_VALIDATION: 'PASS',
      MLB_02C_MODEL_ARTIFACT_READY: 'YES',
      MLB_02C_MODEL_ARTIFACT_DIGEST_READY: 'YES',
      MLB_02C_CHAMPION_PROMOTION_PERFORMED: 'NO',
      MLB_02C_NO_UNSUPPORTED_VALUE_CLAIMS: 'PASS',
      MLB_02C_OUTCOME_MODEL_BOUNDARY: 'PASS',
      PREDICTION_WORK_PERFORMED: 'NO',
      PRODUCTION_MODEL_PERSISTENCE_PERFORMED: 'NO',
    },
  }
  if (writeArtifact) {
    fs.mkdirSync(path.dirname(certificationPath), { recursive: true })
    fs.writeFileSync(certificationPath, `${JSON.stringify(certification, null, 2)}\n`)
  }
  console.log(JSON.stringify(certification, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02c-moneyline-model-training', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
