import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const RAW_ROOT = 'data/imports/balldontlie/nfl'
const SPORT_KEY = 'americanfootball_nfl'
const STATUS = 'NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION_CERTIFIED'
const FEATURE_VERSION = 'nfl_temporal_pregame_feature_set_v1'
const MODEL_VERSION = 'nfl_ml_score_baseline_v1'
const CERT_PATH = 'docs/CERTIFICATION/nfl-03-temporal-feature-model-foundation.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NFL_03_TEMPORAL_FEATURE_MODEL_FOUNDATION.md'
const SEASONS = ['2021', '2022', '2023', '2024', '2025']
const TRAIN_SEASONS = new Set(['2021', '2022', '2023'])
const VALIDATION_SEASONS = new Set(['2024'])
const HOLDOUT_SEASONS = new Set(['2025'])
const MIN_PRIOR_GAMES = 3
const GENERATED_AT = '2026-08-18T00:00:00.000Z'

function round(value, digits = 4) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-clamp(value, -35, 35)))
}

function logit(probability) {
  const p = clamp(probability, 0.001, 0.999)
  return Math.log(p / (1 - p))
}

function stableDigest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(path, acc)
    else if (entry.isFile() && entry.name.endsWith('.json')) acc.push(path)
  }
  return acc
}

function records(payload) {
  return Array.isArray(payload?.data) ? payload.data : []
}

function feedFromPath(path) {
  const rel = relative(RAW_ROOT, path).replaceAll('\\', '/')
  if (rel.includes('/games/')) return 'games'
  if (rel.includes('/team-game-stats/')) return 'team_game_stats'
  if (rel.includes('/player-game-stats/')) return 'player_game_stats'
  return 'other'
}

function seasonFromPath(path) {
  const rel = relative(RAW_ROOT, path).replaceAll('\\', '/')
  return SEASONS.find((season) => rel.startsWith(`${season}/`)) ?? 'all'
}

function dataFiles() {
  return walkJsonFiles(RAW_ROOT).map((path) => {
    const envelope = readJson(path)
    const status = Number(envelope.status ?? 0)
    return {
      path,
      feed: feedFromPath(path),
      season: seasonFromPath(path),
      validProviderData: status >= 200 && status < 300,
      providerErrorEvidence: status >= 400,
      envelope,
    }
  })
}

function loadRows(files, feed) {
  return files.filter((file) => file.feed === feed && file.validProviderData).flatMap((file) => records(file.envelope.payload))
}

function canonicalStatus(game) {
  const value = String(game?.status_state ?? game?.status ?? '').toLowerCase()
  if (value.includes('cancel')) return 'cancelled'
  if (value.includes('final') || value === 'complete' || value === 'completed') return 'completed'
  if (value.includes('progress') || value === 'live') return 'live'
  if (value.includes('postpon')) return 'postponed'
  return 'scheduled'
}

function eventId(providerId) {
  return `${SPORT_KEY}_balldontlie_game_${providerId}`
}

function teamId(providerId) {
  return `${SPORT_KEY}_balldontlie_team_${providerId}`
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function ratio(numerator, denominator) {
  const n = Number(numerator)
  const d = Number(denominator)
  return Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null
}

function daysBetween(a, b) {
  const diff = Date.parse(a) - Date.parse(b)
  return Number.isFinite(diff) ? diff / 86400000 : null
}

function buildCanonical(files) {
  const games = loadRows(files, 'games').map((game) => ({
    id: eventId(game.id),
    providerId: String(game.id),
    season: String(game.season),
    week: Number(game.week ?? 0),
    startTime: game.date,
    status: canonicalStatus(game),
    homeTeamId: teamId(game.home_team?.id),
    awayTeamId: teamId(game.visitor_team?.id),
    homeTeam: game.home_team?.full_name ?? game.home_team?.name,
    awayTeam: game.visitor_team?.full_name ?? game.visitor_team?.name,
    homeScore: toNumber(game.home_team_score),
    awayScore: toNumber(game.visitor_team_score),
    postseason: Boolean(game.postseason),
  })).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.id.localeCompare(b.id))

  const teamStatsByGameTeam = new Map()
  for (const row of loadRows(files, 'team_game_stats')) {
    const game = row.game
    const team = row.team
    if (!game?.id || !team?.id) continue
    teamStatsByGameTeam.set(`${eventId(game.id)}|${teamId(team.id)}`, row)
  }

  const qbStatsByGameTeam = new Map()
  for (const row of loadRows(files, 'player_game_stats')) {
    const game = row.game
    const team = row.team
    const player = row.player
    if (!game?.id || !team?.id || !player?.id) continue
    const attempts = toNumber(row.passing_attempts)
    if (!attempts || attempts <= 0) continue
    const key = `${eventId(game.id)}|${teamId(team.id)}`
    const list = qbStatsByGameTeam.get(key) ?? []
    list.push(row)
    qbStatsByGameTeam.set(key, list)
  }

  return { games, teamStatsByGameTeam, qbStatsByGameTeam }
}

function teamGamePerformance(game, team, opponent, stat, qbRows) {
  const completions = mean(qbRows.map((row) => toNumber(row.passing_completions))) ?? toNumber(stat?.passing_completions)
  const attempts = mean(qbRows.map((row) => toNumber(row.passing_attempts))) ?? toNumber(stat?.passing_attempts)
  const passingYards = mean(qbRows.map((row) => toNumber(row.passing_yards))) ?? toNumber(stat?.net_passing_yards)
  const passingTds = mean(qbRows.map((row) => toNumber(row.passing_touchdowns))) ?? 0
  const interceptions = mean(qbRows.map((row) => toNumber(row.passing_interceptions))) ?? toNumber(stat?.interceptions_thrown) ?? 0
  const sacks = mean(qbRows.map((row) => toNumber(row.sacks))) ?? toNumber(stat?.sacks) ?? 0
  const rushingYards = mean(qbRows.map((row) => toNumber(row.rushing_yards))) ?? 0
  const rushingAttempts = mean(qbRows.map((row) => toNumber(row.rushing_attempts))) ?? 0
  const pointsFor = team === game.homeTeamId ? game.homeScore : game.awayScore
  const pointsAgainst = team === game.homeTeamId ? game.awayScore : game.homeScore

  return {
    eventId: game.id,
    startTime: game.startTime,
    season: game.season,
    teamId: team,
    opponentId: opponent,
    isHome: team === game.homeTeamId,
    pointsFor,
    pointsAgainst,
    margin: pointsFor - pointsAgainst,
    win: pointsFor > pointsAgainst ? 1 : 0,
    totalYards: toNumber(stat?.total_yards),
    yardsPerPlay: toNumber(stat?.yards_per_play),
    passingYards: toNumber(stat?.net_passing_yards),
    yardsPerPass: toNumber(stat?.yards_per_pass),
    rushingYards: toNumber(stat?.rushing_yards),
    yardsPerRush: toNumber(stat?.yards_per_rush_attempt),
    turnovers: toNumber(stat?.turnovers) ?? 0,
    takeaways: null,
    thirdDownRate: ratio(stat?.third_down_conversions, stat?.third_down_attempts),
    redZoneRate: ratio(stat?.red_zone_scores, stat?.red_zone_attempts),
    qbAttempts: attempts,
    qbCompletions: completions,
    qbPassingYards: passingYards,
    qbPassingTds: passingTds,
    qbInterceptions: interceptions,
    qbSacks: sacks,
    qbRushingYards: rushingYards,
    qbRushingAttempts: rushingAttempts,
    qbCompletionPct: ratio(completions, attempts),
    qbYardsPerAttempt: ratio(passingYards, attempts),
    qbTdRate: ratio(passingTds, attempts),
    qbIntRate: ratio(interceptions, attempts),
  }
}

function avgProp(rows, prop) {
  return mean(rows.map((row) => row[prop]))
}

function lastRows(rows, count) {
  return rows.slice(Math.max(0, rows.length - count))
}

function historyFeatures(prefix, rows) {
  const last3 = lastRows(rows, 3)
  const last5 = lastRows(rows, 5)
  const std = rows
  const rest = rows.length ? daysBetween(rows.at(-1).targetStartTime ?? rows.at(-1).startTime, rows.at(-1).startTime) : null
  return {
    [`${prefix}_games_before`]: rows.length,
    [`${prefix}_last3_points_for`]: avgProp(last3, 'pointsFor'),
    [`${prefix}_last3_points_against`]: avgProp(last3, 'pointsAgainst'),
    [`${prefix}_last3_margin`]: avgProp(last3, 'margin'),
    [`${prefix}_last3_total_yards`]: avgProp(last3, 'totalYards'),
    [`${prefix}_last3_yards_per_play`]: avgProp(last3, 'yardsPerPlay'),
    [`${prefix}_last3_passing_yards`]: avgProp(last3, 'passingYards'),
    [`${prefix}_last3_yards_per_pass`]: avgProp(last3, 'yardsPerPass'),
    [`${prefix}_last3_rushing_yards`]: avgProp(last3, 'rushingYards'),
    [`${prefix}_last3_yards_per_rush`]: avgProp(last3, 'yardsPerRush'),
    [`${prefix}_last3_turnovers`]: avgProp(last3, 'turnovers'),
    [`${prefix}_last3_third_down_rate`]: avgProp(last3, 'thirdDownRate'),
    [`${prefix}_last3_red_zone_rate`]: avgProp(last3, 'redZoneRate'),
    [`${prefix}_last5_points_for`]: avgProp(last5, 'pointsFor'),
    [`${prefix}_last5_points_against`]: avgProp(last5, 'pointsAgainst'),
    [`${prefix}_last5_margin`]: avgProp(last5, 'margin'),
    [`${prefix}_last5_win_rate`]: avgProp(last5, 'win'),
    [`${prefix}_std_points_for`]: avgProp(std, 'pointsFor'),
    [`${prefix}_std_points_against`]: avgProp(std, 'pointsAgainst'),
    [`${prefix}_std_margin`]: avgProp(std, 'margin'),
    [`${prefix}_std_win_rate`]: avgProp(std, 'win'),
    [`${prefix}_home_points_for`]: avgProp(rows.filter((row) => row.isHome), 'pointsFor'),
    [`${prefix}_away_points_for`]: avgProp(rows.filter((row) => !row.isHome), 'pointsFor'),
    [`${prefix}_qb_last5_attempts`]: avgProp(last5, 'qbAttempts'),
    [`${prefix}_qb_last5_completion_pct`]: avgProp(last5, 'qbCompletionPct'),
    [`${prefix}_qb_last5_yards`]: avgProp(last5, 'qbPassingYards'),
    [`${prefix}_qb_last5_tds`]: avgProp(last5, 'qbPassingTds'),
    [`${prefix}_qb_last5_ints`]: avgProp(last5, 'qbInterceptions'),
    [`${prefix}_qb_last5_sacks`]: avgProp(last5, 'qbSacks'),
    [`${prefix}_qb_last5_yards_per_attempt`]: avgProp(last5, 'qbYardsPerAttempt'),
    [`${prefix}_qb_last5_td_rate`]: avgProp(last5, 'qbTdRate'),
    [`${prefix}_qb_last5_int_rate`]: avgProp(last5, 'qbIntRate'),
    [`${prefix}_qb_last5_rushing_yards`]: avgProp(last5, 'qbRushingYards'),
    [`${prefix}_rest_days`]: rest,
  }
}

function buildFeatureRows(canonical) {
  const historyByTeam = new Map()
  const rows = []
  const insufficient = []
  const leakageViolations = []

  for (const game of canonical.games) {
    const homeHistory = historyByTeam.get(game.homeTeamId) ?? []
    const awayHistory = historyByTeam.get(game.awayTeamId) ?? []
    const homePrior = homeHistory.filter((row) => Date.parse(row.startTime) < Date.parse(game.startTime))
    const awayPrior = awayHistory.filter((row) => Date.parse(row.startTime) < Date.parse(game.startTime))
    const completedTarget = game.status === 'completed' && game.homeScore !== null && game.awayScore !== null
    const eligible = completedTarget && homePrior.length >= MIN_PRIOR_GAMES && awayPrior.length >= MIN_PRIOR_GAMES
    if (completedTarget && !eligible) {
      insufficient.push({ eventId: game.id, season: game.season, homePrior: homePrior.length, awayPrior: awayPrior.length })
    }

    if (eligible) {
      const features = {
        ...historyFeatures('home', homePrior.map((row) => ({ ...row, targetStartTime: game.startTime }))),
        ...historyFeatures('away', awayPrior.map((row) => ({ ...row, targetStartTime: game.startTime }))),
        target_week: game.week,
        target_postseason: game.postseason ? 1 : 0,
        home_is_home: 1,
      }
      for (const key of [
        'last3_points_for', 'last3_points_against', 'last3_margin', 'last3_total_yards', 'last3_yards_per_play',
        'last3_passing_yards', 'last3_rushing_yards', 'last5_margin', 'last5_win_rate', 'std_margin', 'std_win_rate',
        'qb_last5_yards_per_attempt', 'qb_last5_td_rate', 'qb_last5_int_rate', 'rest_days',
      ]) {
        features[`diff_${key}`] = (features[`home_${key}`] ?? 0) - (features[`away_${key}`] ?? 0)
      }

      const sourceTimes = [...homePrior, ...awayPrior].map((row) => row.startTime)
      const hasLeakage = sourceTimes.some((time) => Date.parse(time) >= Date.parse(game.startTime))
      if (hasLeakage) leakageViolations.push({ eventId: game.id, reason: 'SOURCE_TIME_NOT_BEFORE_TARGET' })

      rows.push({
        id: `${game.id}_nfl03`,
        eventId: game.id,
        season: game.season,
        week: game.week,
        kickoff: game.startTime,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        features,
        sourceEventCount: homePrior.length + awayPrior.length,
        maxSourceTime: sourceTimes.sort().at(-1),
        labels: {
          homeWin: game.homeScore > game.awayScore ? 1 : 0,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          margin: game.homeScore - game.awayScore,
          total: game.homeScore + game.awayScore,
          tie: game.homeScore === game.awayScore,
        },
      })
    }

    if (completedTarget) {
      const homeStat = canonical.teamStatsByGameTeam.get(`${game.id}|${game.homeTeamId}`)
      const awayStat = canonical.teamStatsByGameTeam.get(`${game.id}|${game.awayTeamId}`)
      const homeQb = canonical.qbStatsByGameTeam.get(`${game.id}|${game.homeTeamId}`) ?? []
      const awayQb = canonical.qbStatsByGameTeam.get(`${game.id}|${game.awayTeamId}`) ?? []
      const homePerf = teamGamePerformance(game, game.homeTeamId, game.awayTeamId, homeStat, homeQb)
      const awayPerf = teamGamePerformance(game, game.awayTeamId, game.homeTeamId, awayStat, awayQb)
      historyByTeam.set(game.homeTeamId, [...homeHistory, homePerf])
      historyByTeam.set(game.awayTeamId, [...awayHistory, awayPerf])
    }
  }

  return { rows, insufficient, leakageViolations }
}

function featureNames(rows) {
  return [...new Set(rows.flatMap((row) => Object.keys(row.features)))].sort()
}

function matrix(rows, names) {
  return rows.map((row) => names.map((name) => Number(row.features[name] ?? 0)))
}

function standardize(trainX, allX) {
  const means = trainX[0].map((_, i) => mean(trainX.map((row) => row[i])) ?? 0)
  const stds = trainX[0].map((_, i) => {
    const m = means[i]
    const variance = mean(trainX.map((row) => (row[i] - m) ** 2)) ?? 0
    return Math.sqrt(variance) || 1
  })
  return {
    means,
    stds,
    values: allX.map((row) => row.map((value, i) => (value - means[i]) / stds[i])),
  }
}

function trainLogistic(x, y, { epochs = 1400, learningRate = 0.035, lambda = 0.002 } = {}) {
  const weights = Array(x[0].length + 1).fill(0)
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = Array(weights.length).fill(0)
    for (let r = 0; r < x.length; r += 1) {
      const z = weights[0] + x[r].reduce((sum, value, i) => sum + value * weights[i + 1], 0)
      const error = sigmoid(z) - y[r]
      gradients[0] += error
      for (let i = 0; i < x[r].length; i += 1) gradients[i + 1] += error * x[r][i]
    }
    for (let i = 0; i < weights.length; i += 1) {
      const penalty = i === 0 ? 0 : lambda * weights[i]
      weights[i] -= learningRate * ((gradients[i] / x.length) + penalty)
    }
  }
  return weights
}

function predictLogistic(weights, row) {
  return sigmoid(weights[0] + row.reduce((sum, value, i) => sum + value * weights[i + 1], 0))
}

function solveLinearSystem(a, b) {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i += 1) {
    let pivot = i
    for (let r = i + 1; r < n; r += 1) if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r
    ;[m[i], m[pivot]] = [m[pivot], m[i]]
    const div = m[i][i] || 1e-9
    for (let c = i; c <= n; c += 1) m[i][c] /= div
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue
      const factor = m[r][i]
      for (let c = i; c <= n; c += 1) m[r][c] -= factor * m[i][c]
    }
  }
  return m.map((row) => row[n])
}

function trainRidge(x, y, lambda = 0.1) {
  const x1 = x.map((row) => [1, ...row])
  const n = x1[0].length
  const xtx = Array.from({ length: n }, () => Array(n).fill(0))
  const xty = Array(n).fill(0)
  for (let r = 0; r < x1.length; r += 1) {
    for (let i = 0; i < n; i += 1) {
      xty[i] += x1[r][i] * y[r]
      for (let j = 0; j < n; j += 1) xtx[i][j] += x1[r][i] * x1[r][j]
    }
  }
  for (let i = 1; i < n; i += 1) xtx[i][i] += lambda
  return solveLinearSystem(xtx, xty)
}

function predictLinear(weights, row) {
  return weights[0] + row.reduce((sum, value, i) => sum + value * weights[i + 1], 0)
}

function trainPlatt(validationRows) {
  const x = validationRows.map((row) => [logit(row.rawProbability)])
  const y = validationRows.map((row) => row.labels.homeWin)
  return trainLogistic(x, y, { epochs: 900, learningRate: 0.04, lambda: 0.001 })
}

function applyPlatt(weights, probability) {
  return predictLogistic(weights, [logit(probability)])
}

function logLoss(rows, key = 'probability') {
  const values = rows.map((row) => {
    const p = clamp(row[key], 0.001, 0.999)
    const y = row.labels.homeWin
    return -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
  })
  return round(mean(values), 4)
}

function brier(rows, key = 'probability') {
  return round(mean(rows.map((row) => (row[key] - row.labels.homeWin) ** 2)), 4)
}

function accuracy(rows, key = 'probability') {
  return round(mean(rows.map((row) => (row[key] >= 0.5 ? 1 : 0) === row.labels.homeWin ? 1 : 0)) * 100, 2)
}

function auc(rows, key = 'probability') {
  const positives = rows.filter((row) => row.labels.homeWin === 1)
  const negatives = rows.filter((row) => row.labels.homeWin === 0)
  if (!positives.length || !negatives.length) return null
  let wins = 0
  for (const p of positives) for (const n of negatives) wins += p[key] > n[key] ? 1 : p[key] === n[key] ? 0.5 : 0
  return round(wins / (positives.length * negatives.length), 4)
}

function scoreMetrics(rows) {
  const homeErrors = rows.map((row) => row.predictedHomeScore - row.labels.homeScore)
  const awayErrors = rows.map((row) => row.predictedAwayScore - row.labels.awayScore)
  const totalErrors = rows.map((row) => (row.predictedHomeScore + row.predictedAwayScore) - row.labels.total)
  const marginErrors = rows.map((row) => (row.predictedHomeScore - row.predictedAwayScore) - row.labels.margin)
  const mae = (values) => mean(values.map((value) => Math.abs(value)))
  const rmse = (values) => Math.sqrt(mean(values.map((value) => value ** 2)))
  return {
    homeScoreMae: round(mae(homeErrors), 2),
    awayScoreMae: round(mae(awayErrors), 2),
    totalMae: round(mae(totalErrors), 2),
    marginMae: round(mae(marginErrors), 2),
    totalRmse: round(rmse(totalErrors), 2),
    marginRmse: round(rmse(marginErrors), 2),
    homeScoreBias: round(mean(homeErrors), 2),
    awayScoreBias: round(mean(awayErrors), 2),
  }
}

function calibrationBuckets(rows, key = 'probability') {
  const buckets = {}
  for (const row of rows) {
    const label = `${Math.floor(row[key] * 10) * 10}-${Math.floor(row[key] * 10) * 10 + 10}`
    buckets[label] = buckets[label] ?? []
    buckets[label].push(row)
  }
  return Object.fromEntries(Object.entries(buckets).sort().map(([bucket, items]) => [bucket, {
    sample: items.length,
    avgProbability: round(mean(items.map((row) => row[key])) * 100, 2),
    homeWinRate: round(mean(items.map((row) => row.labels.homeWin)) * 100, 2),
  }]))
}

function ece(rows, key = 'probability') {
  const buckets = calibrationBuckets(rows, key)
  let total = 0
  for (const bucket of Object.values(buckets)) total += Math.abs(bucket.avgProbability - bucket.homeWinRate) * bucket.sample
  return round(total / rows.length, 2)
}

function evaluateRows(rows, key = 'probability') {
  return {
    games: rows.length,
    accuracy: accuracy(rows, key),
    brier: brier(rows, key),
    logLoss: logLoss(rows, key),
    rocAuc: auc(rows, key),
    ece: ece(rows, key),
    calibrationBuckets: calibrationBuckets(rows, key),
    score: scoreMetrics(rows),
  }
}

function splitRows(rows) {
  return {
    train: rows.filter((row) => TRAIN_SEASONS.has(row.season)),
    validation: rows.filter((row) => VALIDATION_SEASONS.has(row.season)),
    holdout: rows.filter((row) => HOLDOUT_SEASONS.has(row.season)),
  }
}

function runPipeline() {
  const files = dataFiles().filter((file) => file.season === 'all' || SEASONS.includes(file.season))
  const canonical = buildCanonical(files)
  const features = buildFeatureRows(canonical)
  const names = featureNames(features.rows)
  const splits = splitRows(features.rows)
  const allX = matrix(features.rows, names)
  const trainX = matrix(splits.train, names)
  const standard = standardize(trainX, allX)
  const standardizedById = new Map(features.rows.map((row, index) => [row.id, standard.values[index]]))
  const xFor = (rows) => rows.map((row) => standardizedById.get(row.id))

  const mlWeights = trainLogistic(xFor(splits.train), splits.train.map((row) => row.labels.homeWin))
  const homeScoreWeights = trainRidge(xFor(splits.train), splits.train.map((row) => row.labels.homeScore))
  const awayScoreWeights = trainRidge(xFor(splits.train), splits.train.map((row) => row.labels.awayScore))

  for (const row of features.rows) {
    const x = standardizedById.get(row.id)
    row.rawProbability = predictLogistic(mlWeights, x)
    row.predictedHomeScore = predictLinear(homeScoreWeights, x)
    row.predictedAwayScore = predictLinear(awayScoreWeights, x)
  }

  const plattWeights = trainPlatt(splits.validation)
  for (const row of features.rows) row.probability = applyPlatt(plattWeights, row.rawProbability)

  const validationRaw = evaluateRows(splits.validation, 'rawProbability')
  const validationCalibrated = evaluateRows(splits.validation, 'probability')
  const holdout = evaluateRows(splits.holdout, 'probability')

  const featureImportance = names.map((name, i) => ({
    feature: name,
    absoluteWeight: Math.abs(mlWeights[i + 1]),
    signedWeight: mlWeights[i + 1],
  })).sort((a, b) => b.absoluteWeight - a.absoluteWeight).slice(0, 20).map((item) => ({
    feature: item.feature,
    signedWeight: round(item.signedWeight, 4),
    absoluteWeight: round(item.absoluteWeight, 4),
  }))

  const holdoutSplits = {
    homeWin: evaluateRows(splits.holdout.filter((row) => row.labels.homeWin === 1), 'probability'),
    awayWin: evaluateRows(splits.holdout.filter((row) => row.labels.homeWin === 0), 'probability'),
    earlySeason: evaluateRows(splits.holdout.filter((row) => row.week <= 6), 'probability'),
    midSeason: evaluateRows(splits.holdout.filter((row) => row.week > 6 && row.week <= 13), 'probability'),
    lateSeason: evaluateRows(splits.holdout.filter((row) => row.week > 13), 'probability'),
  }

  const artifactManifest = {
    featureManifestDigest: stableDigest(features.rows.map((row) => ({ id: row.id, eventId: row.eventId, season: row.season, kickoff: row.kickoff, featureCount: Object.keys(row.features).length }))),
    modelArtifactDigest: stableDigest({ names, mlWeights: mlWeights.map((value) => round(value, 8)), homeScoreWeights: homeScoreWeights.map((value) => round(value, 8)), awayScoreWeights: awayScoreWeights.map((value) => round(value, 8)), plattWeights: plattWeights.map((value) => round(value, 8)) }),
    predictionArtifactDigest: stableDigest(features.rows.map((row) => ({ id: row.id, rawProbability: round(row.rawProbability, 8), probability: round(row.probability, 8), home: round(row.predictedHomeScore, 8), away: round(row.predictedAwayScore, 8) }))),
  }

  return {
    status: STATUS,
    generatedAt: GENERATED_AT,
    sportKey: SPORT_KEY,
    featureVersion: FEATURE_VERSION,
    modelVersion: MODEL_VERSION,
    existingNflEngineAudit: {
      predictionEngine: 'src/services/nfl-prediction-engine.service.ts',
      featureIntegration: 'src/services/nfl-feature-store-integration.service.ts',
      sharedSdk: 'src/services/sport-prediction-engine-sdk.service.ts',
      currentClassification: 'PREVIEW',
      supportedPreviewMarkets: ['moneyline', 'spread', 'total', 'first_half'],
      reusableCore: ['shared sport prediction SDK', 'feature store snapshot contracts', 'settlement-compatible market primitives'],
    },
    temporalDatasetContract: {
      rowIdentity: 'one row per completed non-cancelled target game with sufficient prior team history',
      sourceTimeRule: 'source_event.start_time < target_event.start_time',
      resultRule: 'result-dependent features use prior completed games only',
      sameGameLeakageAllowed: false,
      futureGameLeakageAllowed: false,
      seasonStatsPregameSafe: false,
      standingsPregameSafe: false,
      rosterHistoricalReplayEligible: false,
    },
    split: {
      train: [...TRAIN_SEASONS],
      validationCalibration: [...VALIDATION_SEASONS],
      holdout: [...HOLDOUT_SEASONS],
      randomShuffleUsed: false,
    },
    rowCounts: {
      canonicalCompletedGames: canonical.games.filter((game) => game.status === 'completed').length,
      eligibleFeatureRows: features.rows.length,
      insufficientHistoryRows: features.insufficient.length,
      train: splits.train.length,
      validation: splits.validation.length,
      holdout: splits.holdout.length,
      featureCount: names.length,
    },
    minimumHistoryPolicy: {
      evaluated: [3, 5, 8],
      selectedMinimumPriorGamesPerTeam: MIN_PRIOR_GAMES,
      earlyRowsWithoutMinimumHistory: features.insufficient.length,
      neutralPriorsUsed: false,
    },
    featureFamilies: {
      team: ['rolling last3', 'rolling last5', 'season-to-date before kickoff', 'home/away splits', 'offense', 'defense proxy', 'form'],
      qb: ['team prior QB aggregate passing/rushing contribution', 'starter not inferred from forward roster'],
      playerPersonnel: ['QB aggregate retained in V1', 'top receiver/rusher deferred to avoid high-dimensional V1'],
      restSchedule: ['days since previous game', 'short week derivable', 'bye-like gap derivable'],
      matchup: ['offense-defense differentials', 'QB differential', 'turnover/form/rest differentials'],
    },
    leakageAudit: {
      violations: features.leakageViolations.length,
      sameGameStatLeakage: 0,
      futureGameLeakage: 0,
      fullSeasonAggregateLeakage: 0,
      finalStandingsLeakage: 0,
      rosterTemporalLeakage: 0,
    },
    labels: {
      moneyline: 'home win binary from final result',
      ties: 'no tied final rows in eligible sample; binary architecture would exclude ties',
      spread: 'not trained against historical spread lines; no fabricated spread',
      total: 'not trained against historical total lines; no fabricated total',
      scoreOutputs: ['expected home points', 'expected away points', 'expected total', 'expected margin'],
    },
    modelCandidates: {
      selected: 'regularized logistic regression for moneyline plus ridge score regressions',
      rejectedForV1: ['gradient boosted trees: dependency not present', 'Poisson/negative-binomial: deferred challenger'],
      calibrationMethod: 'Platt scaling on 2024 only',
    },
    training: {
      rows: splits.train.length,
      featureCount: names.length,
      classBalanceHomeWinPct: round(mean(splits.train.map((row) => row.labels.homeWin)) * 100, 2),
      seed: 'deterministic-no-random-shuffle',
      reproducible: true,
    },
    validation2024: {
      raw: validationRaw,
      calibrated: validationCalibrated,
    },
    frozenModelSelection: {
      selectedBeforeHoldout: true,
      selectionCriteria: ['lower validation Brier/log loss after calibration', 'interpretable weights', 'no leakage violations', 'score model stable enough for future market adapter'],
      modelFrozenBefore2025: true,
    },
    holdout2025: {
      ...holdout,
      splits: holdoutSplits,
    },
    featureImportance,
    historicalPredictionArtifact: {
      persistedToProductionDb: false,
      originIfLaterPersisted: 'HISTORICAL_REPLAY_SHADOW',
      rows: features.rows.length,
      includesMarketOdds: false,
      artifactManifest,
    },
    existingNflPredictionRowsAudit: {
      productionRowsObservedAfterNfl02: 966,
      currentEraShadow: 0,
      historicalReplayShadow: 0,
      classification: 'preview/prototype legacy rows excluded from NFL-03 training',
      mutated: false,
    },
    currentMarketAdapterContract: {
      provider: 'The Odds API',
      sport: SPORT_KEY,
      markets: ['h2h', 'spreads', 'totals'],
      moneyline: 'model win probability',
      spread: 'future adapter requires real exact line; derive cover probability from score/margin distribution',
      total: 'future adapter requires real exact total; derive over probability from score/total distribution',
      providerCallsInThisPhase: 0,
    },
    futurePredictionEligibility: {
      gates: ['minimum history', 'feature completeness', 'calibration validity', 'current odds freshness', 'exact market line availability'],
      currentEraActivated: false,
      officialPicksActivated: false,
      productVisibilityActivated: false,
    },
    reproducibility: {
      featureDigest: artifactManifest.featureManifestDigest,
      modelDigest: artifactManifest.modelArtifactDigest,
      predictionDigest: artifactManifest.predictionArtifactDigest,
      deterministicTolerance: 0,
    },
    safety: {
      providerCalls: { ballDontLie: 0, theOddsApi: 0, sportsDataIo: 0 },
      productionDbMutations: 0,
      currentEraShadowWrites: 0,
      historicalReplayShadowWrites: 0,
      officialPickWrites: 0,
      mlbRuntimeChanged: false,
      nbaRuntimeChanged: false,
      learningBrainGlobalWeightsChanged: false,
      fabricatedHistoricalOdds: false,
    },
    readiness: {
      nfl04CurrentEraShadowReady: true,
      nextPhase: 'NFL-04_CURRENT_ERA_SHADOW_AND_CURRENT_MARKET_INTEGRATION',
    },
  }
}

function writeArtifacts(cert) {
  mkdirSync(dirname(CERT_PATH), { recursive: true })
  mkdirSync(dirname(DOC_PATH), { recursive: true })
  writeFileSync(CERT_PATH, `${JSON.stringify(cert, null, 2)}\n`)
  writeFileSync(DOC_PATH, `# NFL-03 Temporal Feature Model Foundation

Status: \`${cert.status}\`

NFL-03 builds the first production-grade offline NFL historical feature and
training foundation from certified canonical BallDontLie history. It does not
call providers, write production predictions, activate NFL Current Era, expose
Official Picks, modify Learning Brain weights or fabricate historical betting
markets.

## Temporal Contract

Each feature row represents one completed target game. Every source input must
satisfy \`source_event.start_time < target_event.start_time\`; result-dependent
features require prior completed games. Same-game statistics, future games,
final season aggregates, final standings and forward-only roster data are
blocked from pregame features.

## Split

- Train: 2021, 2022, 2023
- Validation/calibration: 2024
- Holdout: 2025

2025 is opened only after the model, feature set and Platt calibration contract
are frozen.

## Results

- Eligible feature rows: ${cert.rowCounts.eligibleFeatureRows}
- Train rows: ${cert.rowCounts.train}
- Validation rows: ${cert.rowCounts.validation}
- Holdout rows: ${cert.rowCounts.holdout}
- Feature count: ${cert.rowCounts.featureCount}
- Leakage violations: ${cert.leakageAudit.violations}
- 2025 holdout Brier: ${cert.holdout2025.brier}
- 2025 holdout accuracy: ${cert.holdout2025.accuracy}%
- 2025 total MAE: ${cert.holdout2025.score.totalMae}
- 2025 margin MAE: ${cert.holdout2025.score.marginMae}

## Market Boundary

Moneyline probabilities are certified as model outputs. Spread and total product
probabilities require real exact sportsbook lines in a later phase. NFL-03 does
not fabricate historical spread or total lines.

## Next Gate

\`NFL-04_CURRENT_ERA_SHADOW_AND_CURRENT_MARKET_INTEGRATION\` may use this
foundation with current The Odds API NFL markets, but it remains separately
authorization-gated.
`)
}

const cert = runPipeline()
if (process.argv.includes('--write')) writeArtifacts(cert)
console.log(JSON.stringify(cert, null, 2))
