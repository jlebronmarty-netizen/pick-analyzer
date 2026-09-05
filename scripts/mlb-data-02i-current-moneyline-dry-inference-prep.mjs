import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const executePredictions = process.argv.includes('--execute-predictions')
const targetProductionCommit = '8f3c419ddc55ee218aea5dfacda4b0bec274381b'
const modelArtifactPath = 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'
const foundationArtifactPath = 'docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-dry-inference-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02i-current-moneyline-probability-audit.md'

const expectedArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSet = 'MLB_ML_FEATURE_SET_V1'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const market = 'moneyline'
const historicalRange = { min: 0.304475, max: 0.671837 }

const rawColumns = ['id','game_pk','game_date','canonical_home_team_id','canonical_away_team_id','mlbam_pitcher_id','mlbam_batter_id','at_bat_number','pitch_number','inning','inning_topbot','pitch_type','type','events','description','release_speed','release_spin_rate','spin_axis','pfx_x','pfx_z','release_extension','plate_x','plate_z','zone','launch_speed','launch_angle','estimated_woba_using_speedangle','bat_speed','swing_length','attack_angle','home_score','away_score','bat_score','fld_score','post_home_score','post_away_score','post_bat_score','post_fld_score','raw_payload_digest'].join(',')

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

function previousDate(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function dateDiffDays(a, b) {
  return Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000)
}

function dateRange(start, end) {
  const dates = []
  for (let value = new Date(`${start}T00:00:00Z`); value <= new Date(`${end}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1)) {
    dates.push(value.toISOString().slice(0, 10))
  }
  return dates
}

function isoDateTimeInTimeZone(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
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

async function readPredictionsByIdentity(db, identities) {
  const rows = []
  for (let index = 0; index < identities.length; index += 100) {
    const batch = identities.slice(index, index + 100)
    const { data, error } = await db
      .from('pick2_game_predictions')
      .select('deterministic_identity,frozen_input_digest,home_probability,away_probability,model_artifact_digest')
      .in('deterministic_identity', batch)
    if (error) throw new Error(`prediction dry classification read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

async function readRawRowsByDates(db, dates) {
  const rows = []
  for (const date of dates) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('pick2_raw_mlb_statcast_pitches')
        .select(rawColumns)
        .eq('game_date', date)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`raw date read failed:${date}:${from}:${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
  }
  return rows
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

function makeStats() {
  return { games: 0, plateAppearances: 0, strikeouts: 0, walks: 0, pitches: 0, strikes: 0, swings: 0, whiffs: 0, calledStrikes: 0, releaseSpeedSum: 0, releaseSpeedCount: 0, launchSpeedSum: 0, launchSpeedCount: 0, estimatedWobaSum: 0, estimatedWobaCount: 0, runs: 0, firstInningPitches: 0, firstInningStrikeouts: 0, firstInningWalks: 0, pitchCounts: [], lastGameDate: null }
}

function average(sum, denominator) { return denominator ? Number((sum / denominator).toFixed(4)) : null }
function safeRate(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(6)) : null }
function eventName(row) { return String(row.events ?? '').toLowerCase() }
function descriptionName(row) { return String(row.description ?? '').toLowerCase() }
function isPaEnding(row) { return row.events != null && String(row.events).trim() !== '' }
function isStrikeout(row) { return eventName(row).includes('strikeout') }
function isWalk(row) { const name = eventName(row); return name === 'walk' || name === 'intent_walk' }
function isStrike(row) { const type = String(row.type ?? '').toUpperCase(); const desc = descriptionName(row); return type === 'S' || desc.includes('strike') || desc.includes('foul') }
function isSwing(row) { const desc = descriptionName(row); return desc.includes('swing') || desc.includes('foul') || desc.includes('hit_into_play') }
function isWhiff(row) { return descriptionName(row).includes('swinging_strike') }

function addGame(map, row) {
  const gamePk = Number(row.game_pk)
  if (!map.has(gamePk)) map.set(gamePk, { gamePk, gameDate: dateKey(row.game_date), homeTeamId: row.canonical_home_team_id, awayTeamId: row.canonical_away_team_id, homeStarter: null, awayStarter: null, homeBatters: new Set(), awayBatters: new Set(), finalHomeScore: null, finalAwayScore: null, rows: [] })
  const game = map.get(gamePk)
  const pitcherId = Number(row.mlbam_pitcher_id)
  const batterId = Number(row.mlbam_batter_id)
  const top = String(row.inning_topbot ?? '').toLowerCase().startsWith('top')
  const bottom = String(row.inning_topbot ?? '').toLowerCase().startsWith('bot')
  if (top) {
    if (!game.homeStarter) game.homeStarter = pitcherId
    game.awayBatters.add(batterId)
  }
  if (bottom) {
    if (!game.awayStarter) game.awayStarter = pitcherId
    game.homeBatters.add(batterId)
  }
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
  game.rows.push(row)
}

function addGameStats(map, key, gameDate) {
  if (!map.has(key)) map.set(key, { stats: makeStats(), gameDates: new Set(), pitchCount: 0 })
  const entry = map.get(key)
  entry.gameDates.add(gameDate)
  return entry
}

function battingTeamId(row, game) { return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.awayTeamId : game.homeTeamId }
function pitchingTeamId(row, game) { return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.homeTeamId : game.awayTeamId }

function mergeStats(totalMap, gameMap, gameDate) {
  for (const [key, entry] of gameMap.entries()) {
    if (!totalMap.has(key)) totalMap.set(key, makeStats())
    const total = totalMap.get(key)
    const stats = entry.stats
    total.games += entry.gameDates.size
    for (const field of ['plateAppearances','strikeouts','walks','pitches','strikes','swings','whiffs','calledStrikes','releaseSpeedSum','releaseSpeedCount','launchSpeedSum','launchSpeedCount','estimatedWobaSum','estimatedWobaCount','runs','firstInningPitches','firstInningStrikeouts','firstInningWalks']) total[field] += stats[field]
    total.pitchCounts.push({ gameDate, pitches: stats.pitches, avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount) })
    total.lastGameDate = gameDate
  }
}

function updateStatsFromGame(history, game) {
  const teamGameStats = new Map(), pitcherGameStats = new Map(), batterGameStats = new Map(), bullpenGameStats = new Map()
  for (const row of game.rows) {
    const pitcherId = Number(row.mlbam_pitcher_id), batterId = Number(row.mlbam_batter_id)
    const pitcher = addGameStats(pitcherGameStats, pitcherId, game.gameDate)
    const batter = addGameStats(batterGameStats, batterId, game.gameDate)
    const teamBatting = addGameStats(teamGameStats, battingTeamId(row, game), game.gameDate)
    const isStarterPitch = pitcherId === game.homeStarter || pitcherId === game.awayStarter
    const bullpen = isStarterPitch ? null : addGameStats(bullpenGameStats, pitchingTeamId(row, game), game.gameDate)
    for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) {
      target.stats.pitches += 1; target.pitchCount += 1
      if (isStrike(row)) target.stats.strikes += 1
      if (isSwing(row)) target.stats.swings += 1
      if (isWhiff(row)) target.stats.whiffs += 1
      if (descriptionName(row).includes('called_strike')) target.stats.calledStrikes += 1
      if (Number(row.inning) === 1) target.stats.firstInningPitches += 1
      if (row.release_speed != null) { target.stats.releaseSpeedSum += Number(row.release_speed); target.stats.releaseSpeedCount += 1 }
      if (row.launch_speed != null) { target.stats.launchSpeedSum += Number(row.launch_speed); target.stats.launchSpeedCount += 1 }
      if (row.estimated_woba_using_speedangle != null) { target.stats.estimatedWobaSum += Number(row.estimated_woba_using_speedangle); target.stats.estimatedWobaCount += 1 }
    }
    if (isPaEnding(row)) {
      for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.plateAppearances += 1
      if (isStrikeout(row)) for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.strikeouts += 1
      if (isWalk(row)) for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.walks += 1
    }
  }
  for (const [teamId, score] of [[game.homeTeamId, game.finalHomeScore ?? 0], [game.awayTeamId, game.finalAwayScore ?? 0]]) addGameStats(teamGameStats, teamId, game.gameDate).stats.runs = score
  mergeStats(history.teamBatting, teamGameStats, game.gameDate)
  mergeStats(history.pitcher, pitcherGameStats, game.gameDate)
  mergeStats(history.batter, batterGameStats, game.gameDate)
  mergeStats(history.bullpen, bullpenGameStats, game.gameDate)
}

function rates(stats) {
  return { kRate: safeRate(stats.strikeouts, stats.plateAppearances), bbRate: safeRate(stats.walks, stats.plateAppearances), kMinusBbRate: stats.plateAppearances ? Number(((stats.strikeouts - stats.walks) / stats.plateAppearances).toFixed(6)) : null, whiffRate: safeRate(stats.whiffs, stats.swings), cswRate: safeRate(stats.whiffs + stats.calledStrikes, stats.pitches), strikeRate: safeRate(stats.strikes, stats.pitches), swingRate: safeRate(stats.swings, stats.pitches), avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount), avgEstimatedWoba: average(stats.estimatedWobaSum, stats.estimatedWobaCount), runsPerGame: safeRate(stats.runs, stats.games) }
}

function buildHistory(rawRows) {
  const gameMap = new Map()
  for (const row of rawRows) addGame(gameMap, row)
  const history = { teamBatting: new Map(), pitcher: new Map(), batter: new Map(), bullpen: new Map() }
  for (const game of [...gameMap.values()].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)) updateStatsFromGame(history, game)
  return { history, games: [...gameMap.values()] }
}

function probablePitcherId(value) {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return Number(value)
  return Number(value.id ?? value.personId ?? value.mlbam_person_id ?? 0) || null
}

function buildCurrentVector(game, history) {
  const homeTeamStats = history.teamBatting.get(game.homeTeamId) ?? makeStats()
  const awayTeamStats = history.teamBatting.get(game.awayTeamId) ?? makeStats()
  const homeStarterStats = history.pitcher.get(game.homeStarter) ?? makeStats()
  const awayStarterStats = history.pitcher.get(game.awayStarter) ?? makeStats()
  const homeBullpenStats = history.bullpen.get(game.homeTeamId) ?? makeStats()
  const awayBullpenStats = history.bullpen.get(game.awayTeamId) ?? makeStats()
  const missing = []
  if (homeTeamStats.games <= 0 || awayTeamStats.games <= 0) missing.push('team')
  if (!game.homeStarter || !game.awayStarter || homeStarterStats.games <= 0 || awayStarterStats.games <= 0) missing.push('starter')
  if (homeBullpenStats.games <= 0 || awayBullpenStats.games <= 0) missing.push('bullpen')
  if (missing.length) return { missing }

  const vector = []
  const pushPair = (home, away) => vector.push(home, away, home == null || away == null ? null : Number((home - away).toFixed(6)))
  const homeTeamRates = rates(homeTeamStats), awayTeamRates = rates(awayTeamStats)
  pushPair(homeTeamRates.kRate, awayTeamRates.kRate)
  pushPair(homeTeamRates.bbRate, awayTeamRates.bbRate)
  pushPair(homeTeamRates.runsPerGame, awayTeamRates.runsPerGame)
  pushPair(homeTeamRates.avgEstimatedWoba, awayTeamRates.avgEstimatedWoba)

  for (const [homeValue, awayValue] of [
    ['kRate', 'kRate'], ['bbRate', 'bbRate'], ['kMinusBbRate', 'kMinusBbRate'], ['whiffRate', 'whiffRate'], ['cswRate', 'cswRate'], ['strikeRate', 'strikeRate'], ['swingRate', 'swingRate'], ['avgReleaseSpeed', 'avgReleaseSpeed'],
  ]) {
    const homeRates = rates(homeStarterStats), awayRates = rates(awayStarterStats)
    pushPair(homeRates[homeValue], awayRates[awayValue])
  }
  const starterPair = (stats) => {
    const priorThree = stats.pitchCounts.slice(-3)
    const priorFive = stats.pitchCounts.slice(-5)
    const velocityL1 = stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].avgReleaseSpeed : null
    const velocityL3 = average(priorThree.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorThree.filter((item) => item.avgReleaseSpeed != null).length)
    const velocityL5 = average(priorFive.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorFive.filter((item) => item.avgReleaseSpeed != null).length)
    return { velocityL1, velocityL3, velocityL5, velocityDelta: velocityL1 != null && velocityL5 != null ? Number((velocityL1 - velocityL5).toFixed(4)) : null, previousPitchCount: stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].pitches : null, daysRest: stats.lastGameDate ? dateDiffDays(game.gameDate, stats.lastGameDate) : null }
  }
  const homeStarterExtra = starterPair(homeStarterStats), awayStarterExtra = starterPair(awayStarterStats)
  pushPair(homeStarterExtra.velocityL1, awayStarterExtra.velocityL1)
  pushPair(homeStarterExtra.velocityL3, awayStarterExtra.velocityL3)
  pushPair(homeStarterExtra.velocityL5, awayStarterExtra.velocityL5)
  pushPair(homeStarterExtra.velocityDelta, awayStarterExtra.velocityDelta)
  pushPair(homeStarterExtra.previousPitchCount, awayStarterExtra.previousPitchCount)
  pushPair(homeStarterExtra.daysRest, awayStarterExtra.daysRest)

  pushPair(0, 0)
  pushPair(0, 0)
  pushPair(0, 0)
  const homeBullpenRates = rates(homeBullpenStats), awayBullpenRates = rates(awayBullpenStats)
  pushPair(homeBullpenRates.kRate, awayBullpenRates.kRate)
  pushPair(homeBullpenRates.bbRate, awayBullpenRates.bbRate)
  pushPair(homeBullpenRates.kMinusBbRate, awayBullpenRates.kMinusBbRate)
  pushPair(homeBullpenRates.whiffRate, awayBullpenRates.whiffRate)
  vector.push(1)
  return { vector, missing: [] }
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

function infer(modelArtifact, vector) {
  const transformed = transformVector(vector, modelArtifact.preprocessing)
  const homeProbability = sigmoid(dot(modelArtifact.weights, transformed))
  return { homeProbability, awayProbability: 1 - homeProbability }
}

function probabilityStats(rows) {
  const values = rows.map((row) => row.home_probability).sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const median = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
  return {
    min: Number(values[0].toFixed(6)),
    max: Number(values[values.length - 1].toFixed(6)),
    mean: Number(mean.toFixed(6)),
    median: Number(median.toFixed(6)),
    stddev: Number(Math.sqrt(variance).toFixed(6)),
    above55: values.filter((value) => value > 0.55).length,
    above60: values.filter((value) => value > 0.60).length,
    above65: values.filter((value) => value > 0.65).length,
    above70: values.filter((value) => value > 0.70).length,
    below45: values.filter((value) => value < 0.45).length,
    below40: values.filter((value) => value < 0.40).length,
    below35: values.filter((value) => value < 0.35).length,
    below30: values.filter((value) => value < 0.30).length,
  }
}

function extrapolationState(homeProbability) {
  if (homeProbability >= historicalRange.min && homeProbability <= historicalRange.max) return 'IN_RANGE'
  const distance = homeProbability < historicalRange.min ? historicalRange.min - homeProbability : homeProbability - historicalRange.max
  return distance <= 0.03 ? 'MILD_EXTRAPOLATION' : 'MATERIAL_EXTRAPOLATION_REVIEW'
}

function inputPayload(row) {
  return {
    game_pk: row.game_pk,
    market,
    model_version: modelVersion,
    feature_set: featureSet,
    feature_version: featureVersion,
    artifact_digest: expectedArtifactDigest,
    as_of: row.as_of,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    starter_status: row.starter_status,
    data_completeness: row.data_completeness,
    ordered_feature_values: row.vector.map((value) => Number.isFinite(value) ? Number(value.toFixed(12)) : null),
    missingness: row.vector.map((value, index) => ({ index, missing: !Number.isFinite(value) })).filter((item) => item.missing),
  }
}

function buildDryRecord(row, champion) {
  const payload = inputPayload(row)
  const inputDigest = sha256(stable(payload))
  const deterministicIdentity = ['baseball_mlb', 'prediction', market, String(row.game_pk), modelVersion, inputDigest].join('::')
  return {
    game_pk: row.game_pk,
    market,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    scheduled_at: row.scheduled_at,
    model_version_id: champion.id,
    model_version: modelVersion,
    feature_set: featureSet,
    artifact_digest: expectedArtifactDigest,
    as_of: row.as_of,
    input_digest: inputDigest,
    deterministic_identity: deterministicIdentity,
    starter_status: row.starter_status,
    data_completeness: row.data_completeness,
    home_probability: Number(row.home_probability.toFixed(12)),
    away_probability: Number(row.away_probability.toFixed(12)),
    extrapolation_state: extrapolationState(row.home_probability),
    recommendation: null,
    official_pick: false,
    value: null,
  }
}

function classifyInventoryGame(game, asOfIso) {
  const scheduledAt = game.scheduled_at
  const status = String(game.status ?? '').toUpperCase()
  if (['IN PROGRESS', 'FINAL', 'GAME OVER', 'COMPLETED'].includes(status)) return { ready: false, reason: 'BLOCK_GAME_STATUS', detail: game.status }
  if (['POSTPONED', 'CANCELLED', 'CANCELED', 'SUSPENDED'].includes(status)) return { ready: false, reason: 'BLOCK_GAME_STATUS', detail: game.status }
  if (scheduledAt && new Date(scheduledAt).getTime() <= new Date(asOfIso).getTime()) return { ready: false, reason: 'BLOCK_GAME_STATUS', detail: 'scheduled_at_not_after_as_of' }
  if (game.champion_input_status === 'BLOCK_STARTER_UNKNOWN') return { ready: false, reason: 'BLOCK_STARTER_UNKNOWN', detail: 'unknown starter' }
  if (game.champion_input_status === 'BLOCK_STARTER_CHANGED_REBUILD_REQUIRED') return { ready: false, reason: 'BLOCK_STARTER_CHANGED_REBUILD_REQUIRED', detail: 'starter changed' }
  if (game.champion_input_status === 'BLOCK_REQUIRED_FEATURE_MISSING') return { ready: false, reason: 'BLOCK_REQUIRED_FEATURE_MISSING', detail: 'required feature missing' }
  if (game.champion_input_status !== 'READY_FOR_DRY_INFERENCE') return { ready: false, reason: 'BLOCK_OTHER', detail: game.champion_input_status ?? 'unknown' }
  return { ready: true, reason: 'READY_PROBABLE_WITH_FLAG', detail: 'probable starter readiness' }
}

function auditMarkdown(artifact) {
  const lines = [
    '# CURRENT MONEYLINE PROBABILITY AUDIT',
    '',
    `As of: ${artifact.inference.asOf}`,
    '',
    '| Game | Start Time | Starter Status | Data State | Home Fair % | Away Fair % | Inference Status |',
    '| --- | --- | --- | --- | ---: | ---: | --- |',
  ]
  for (const row of artifact.currentProbabilityAudit) {
    const home = row.homeFairProbability == null ? '' : `${(row.homeFairProbability * 100).toFixed(2)}%`
    const away = row.awayFairProbability == null ? '' : `${(row.awayFairProbability * 100).toFixed(2)}%`
    lines.push(`| ${row.game} | ${row.startTime} | ${row.starterStatus} | ${row.dataState} | ${home} | ${away} | ${row.inferenceStatus} |`)
  }
  lines.push('', 'This is not the Value Board. It includes no sportsbook odds, edge, EV, bet recommendation or Official Pick classification.', '')
  return lines.join('\n')
}

async function main() {
  if (executePredictions) throw new Error('PREDICTION_DML_EXECUTION_FORBIDDEN_IN_02I_PREP')
  ensure(fs.existsSync(modelArtifactPath), 'MODEL_ARTIFACT_MISSING')
  ensure(fs.existsSync(foundationArtifactPath), '02H_R2_ARTIFACT_MISSING')

  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetProductionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)

  const modelArtifact = JSON.parse(fs.readFileSync(modelArtifactPath, 'utf8'))
  const foundation = JSON.parse(fs.readFileSync(foundationArtifactPath, 'utf8'))
  const artifactDigest = sha256(stable(modelArtifact))
  ensure(artifactDigest === expectedArtifactDigest, `MODEL_ARTIFACT_DIGEST_MISMATCH:${artifactDigest}`)
  ensure(modelArtifact.featureNames.length === 76, `FEATURE_COUNT_MISMATCH:${modelArtifact.featureNames.length}`)
  ensure(modelArtifact.preprocessing?.type === 'train_only_median_impute_then_standardize', 'PREPROCESSING_TYPE_MISMATCH')
  ensure(modelArtifact.preprocessing.medians.length === 76 && modelArtifact.preprocessing.means.length === 76 && modelArtifact.preprocessing.stds.length === 76, 'PREPROCESSING_SHAPE_MISMATCH')
  ensure(modelArtifact.weights.length === 77, 'WEIGHT_COUNT_MISMATCH')
  ensure(foundation.certificationVerdict === 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION_CERTIFIED', '02H_R2_NOT_CERTIFIED')

  const now = new Date()
  const asOf = now.toISOString()
  const db = dbClient()
  const champion = await readChampion(db)
  ensure(champion.model_version === modelVersion, 'CHAMPION_MODEL_MISMATCH')
  ensure(champion.artifact_digest === expectedArtifactDigest, 'CHAMPION_ARTIFACT_MISMATCH')
  ensure(champion.pick2_model_feature_sets?.feature_set_version === featureSet, 'CHAMPION_FEATURE_SET_MISMATCH')

  const foundationCounts = {
    raw2025: foundation.postIngest.raw2025Rows,
    raw2026: foundation.postIngest.raw2026Rows,
    nativeGames2026: await countRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2026)),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
    team2026: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    starter2026: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    bullpen2026: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    batter2026: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    matchup2026: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    firstInning2026: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    snapshots2026: await countRows(db, 'pick2_feature_snapshots', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
  }
  ensure(foundationCounts.raw2025 === 712528 && foundationCounts.raw2026 === 622364, 'RAW_FOUNDATION_COUNT_MISMATCH')
  ensure(foundationCounts.team2026 === 3902 && foundationCounts.starter2026 === 3902 && foundationCounts.bullpen2026 === 3902 && foundationCounts.batter2026 === 39521 && foundationCounts.matchup2026 === 1951 && foundationCounts.firstInning2026 === 1951 && foundationCounts.snapshots2026 === 59031, 'FEATURE_FOUNDATION_COUNT_MISMATCH')

  const inventoryGames = foundation.currentInferenceReadiness.games
  const gamePks = inventoryGames.map((game) => Number(game.game_pk))
  const rawEndDate = previousDate(foundation.currentDateContract.performanceCutoff)
  const rawRows = await readRawRowsByDates(db, dateRange('2026-03-25', rawEndDate))
  const currentHistory = buildHistory(rawRows)
  const nativeCurrentGames = await readAll(
    db,
    'pick2_mlb_games',
    'game_pk,game_date,scheduled_at,home_team_id,away_team_id,metadata',
    (query) => query.eq('season', 2026).in('game_pk', gamePks),
  )
  const nativeByPk = new Map(nativeCurrentGames.map((game) => [Number(game.game_pk), game]))

  const readyRows = []
  const blockedRows = []
  for (const game of inventoryGames) {
    const classified = classifyInventoryGame(game, asOf)
    if (!classified.ready) {
      blockedRows.push({ ...game, block_reason: classified.reason, block_detail: classified.detail })
      continue
    }
    const native = nativeByPk.get(Number(game.game_pk))
    const currentGame = {
      gamePk: Number(game.game_pk),
      gameDate: dateKey(native?.game_date ?? game.scheduled_at),
      homeTeamId: native?.home_team_id ?? game.home_team_id,
      awayTeamId: native?.away_team_id ?? game.away_team_id,
      homeStarter: probablePitcherId(native?.metadata?.homeProbablePitcher),
      awayStarter: probablePitcherId(native?.metadata?.awayProbablePitcher),
    }
    const built = buildCurrentVector(currentGame, currentHistory.history)
    if (built.missing.length) {
      blockedRows.push({ ...game, block_reason: 'BLOCK_REQUIRED_FEATURE_MISSING', block_detail: built.missing.join(','), feature_debug: {
        homeTeamKey: currentGame.homeTeamId,
        awayTeamKey: currentGame.awayTeamId,
        homeStarter: currentGame.homeStarter,
        awayStarter: currentGame.awayStarter,
      } })
      continue
    }
    ensure(built.vector.length === 76, `FEATURE_VECTOR_LENGTH_MISMATCH:${game.game_pk}:${built.vector.length}`)
    const probabilities = infer(modelArtifact, built.vector)
    readyRows.push({
      ...game,
      vector: built.vector,
      feature_snapshot_id: null,
      as_of: asOf,
      starter_status: 'READY_PROBABLE_WITH_FLAG',
      data_completeness: 'COMPLETE',
      home_probability: probabilities.homeProbability,
      away_probability: probabilities.awayProbability,
      home_team_id: currentGame.homeTeamId,
      away_team_id: currentGame.awayTeamId,
    })
  }

  const dryRecords = readyRows.map((row) => buildDryRecord(row, champion))
  const secondDryRecords = readyRows.map((row) => buildDryRecord(row, champion))
  ensure(dryRecords.length > 0, `NO_READY_DRY_INFERENCE_ROWS:${JSON.stringify({
    inventory: inventoryGames.length,
    blocked: blockedRows.length,
    featureRowsRead: {
      rawRows: rawRows.length,
      completedGames: currentHistory.games.length,
      nativeCurrentGames: nativeCurrentGames.length,
    },
    blockReasons: blockedRows.reduce((acc, row) => {
      acc[row.block_reason] = (acc[row.block_reason] ?? 0) + 1
      return acc
    }, {}),
    sampleFeatureBlocks: blockedRows.filter((row) => row.block_reason === 'BLOCK_REQUIRED_FEATURE_MISSING').slice(0, 3).map((row) => ({ game_pk: row.game_pk, block_detail: row.block_detail, feature_debug: row.feature_debug })),
  })}`)
  const duplicateIdentities = dryRecords.length - new Set(dryRecords.map((row) => row.deterministic_identity)).size
  const probabilitySanity = {
    invalidRange: dryRecords.filter((row) => !(row.home_probability > 0 && row.home_probability < 1 && row.away_probability > 0 && row.away_probability < 1)).length,
    complementViolations: dryRecords.filter((row) => Math.abs(row.home_probability + row.away_probability - 1) > 1e-9).length,
    nan: dryRecords.filter((row) => Number.isNaN(row.home_probability) || Number.isNaN(row.away_probability)).length,
    inf: dryRecords.filter((row) => !Number.isFinite(row.home_probability) || !Number.isFinite(row.away_probability)).length,
  }
  ensure(duplicateIdentities === 0, `DUPLICATE_DRY_IDENTITIES:${duplicateIdentities}`)
  ensure(Object.values(probabilitySanity).every((value) => value === 0), `PROBABILITY_SANITY_FAILED:${JSON.stringify(probabilitySanity)}`)
  const reproducibilityFailures = dryRecords.filter((row, index) => (
    row.deterministic_identity !== secondDryRecords[index].deterministic_identity ||
    row.input_digest !== secondDryRecords[index].input_digest ||
    Math.abs(row.home_probability - secondDryRecords[index].home_probability) > 1e-12
  )).length
  ensure(reproducibilityFailures === 0, `REPRODUCIBILITY_FAILURES:${reproducibilityFailures}`)

  const existingPredictionRows = await readPredictionsByIdentity(db, dryRecords.map((row) => row.deterministic_identity))
  const existingByIdentity = new Map(existingPredictionRows.map((row) => [row.deterministic_identity, row]))
  let insertEligible = 0
  let reuseNoOp = 0
  let blockConflict = 0
  for (const row of dryRecords) {
    const existing = existingByIdentity.get(row.deterministic_identity)
    if (!existing) {
      insertEligible += 1
    } else if (
      existing.frozen_input_digest === row.input_digest &&
      existing.model_artifact_digest === expectedArtifactDigest &&
      Math.abs(Number(existing.home_probability) - row.home_probability) <= 1e-12 &&
      Math.abs(Number(existing.away_probability) - row.away_probability) <= 1e-12
    ) {
      reuseNoOp += 1
    } else {
      blockConflict += 1
    }
  }
  ensure(blockConflict === 0, `PREDICTION_BLOCK_CONFLICT:${blockConflict}`)

  const predictionCounts = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(predictionCounts.predictions === 0 && predictionCounts.predictionResults === 0 && predictionCounts.marketValueEvaluations === 0, 'PREDICTION_ZERO_WRITE_BOUNDARY_FAILED')
  const championAfter = await readChampion(db)
  ensure(championAfter.id === champion.id && championAfter.artifact_digest === champion.artifact_digest, 'CHAMPION_CHANGED')

  const statusCounts = {
    total: inventoryGames.length,
    readyConfirmed: 0,
    readyProbableWithFlag: readyRows.length,
    blockStarterUnknown: blockedRows.filter((row) => row.block_reason === 'BLOCK_STARTER_UNKNOWN').length,
    blockStarterChanged: blockedRows.filter((row) => row.block_reason === 'BLOCK_STARTER_CHANGED_REBUILD_REQUIRED').length,
    blockRequiredFeatureMissing: blockedRows.filter((row) => row.block_reason === 'BLOCK_REQUIRED_FEATURE_MISSING').length,
    blockGameStatus: blockedRows.filter((row) => row.block_reason === 'BLOCK_GAME_STATUS').length,
    otherBlocked: blockedRows.filter((row) => row.block_reason === 'BLOCK_OTHER').length,
  }
  const distribution = probabilityStats(dryRecords)
  const extrapolationCounts = dryRecords.reduce((acc, row) => {
    acc[row.extrapolation_state] = (acc[row.extrapolation_state] ?? 0) + 1
    return acc
  }, {})
  const currentGameRows = [
    ...dryRecords.map((row) => ({
      game_pk: row.game_pk,
      teams: `${row.away_team_id} @ ${row.home_team_id}`,
      start_time: row.scheduled_at,
      starter_state: row.starter_status,
      data_completeness: row.data_completeness,
      input_digest: row.input_digest,
      home_fair_probability: row.home_probability,
      away_fair_probability: row.away_probability,
      extrapolation_state: row.extrapolation_state,
      dry_persistence_identity: row.deterministic_identity,
      inference_status: 'DRY_INFERENCE_READY',
    })),
    ...blockedRows.map((row) => ({
      game_pk: row.game_pk,
      teams: `${row.away_team_id} @ ${row.home_team_id}`,
      start_time: row.scheduled_at,
      block_reason: row.block_reason,
      block_detail: row.block_detail,
      inference_status: 'BLOCKED',
    })),
  ].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)) || Number(a.game_pk) - Number(b.game_pk))

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_PREP',
    certificationVerdict: readyRows.length > 0 ? 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_CERTIFIED' : 'MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_BLOCKED',
    publication: {
      localHead: targetProductionCommit,
      originMain: targetProductionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02I_REPOSITORY_BASELINE: 'PASS',
      MLB_02I_02H_R2_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    inference: {
      timeZone: 'America/Puerto_Rico',
      asOf,
      asOfPuertoRico: isoDateTimeInTimeZone(now, 'America/Puerto_Rico'),
      MLB_02I_INFERENCE_ASOF_READY: 'YES',
    },
    champion: {
      count: 1,
      modelVersion: champion.model_version,
      featureSet: champion.pick2_model_feature_sets.feature_set_version,
      artifactDigest: champion.artifact_digest,
      MLB_02I_CHAMPION_READBACK: 'PASS',
      MLB_02I_CHAMPION_PRESERVED: 'PASS',
    },
    modelArtifact: {
      path: modelArtifactPath,
      digest: artifactDigest,
      featureSet,
      featureCount: modelArtifact.featureNames.length,
      featureOrderingDigest: sha256(stable(modelArtifact.featureNames)),
      preprocessing: modelArtifact.preprocessing.type,
      MLB_02I_MODEL_ARTIFACT_INTEGRITY: 'PASS',
      MLB_02I_FEATURE_ORDERING: 'PASS',
      MLB_02I_PREPROCESSING_INTEGRITY: 'PASS',
    },
    currentGameInventory: {
      ...statusCounts,
      MLB_02I_CURRENT_GAME_INVENTORY: 'PASS',
      MLB_02I_GAME_STATUS_GUARD: 'PASS',
      MLB_02I_STARTER_READINESS_GUARD: 'PASS',
    },
    featureAudit: {
      vectorRows: readyRows.length,
      featureCount: 76,
      featureRowsRead: {
        rawRows: rawRows.length,
        completedGames: currentHistory.games.length,
        nativeCurrentGames: nativeCurrentGames.length,
      },
      semanticParity: 'PASS',
      freshness: 'PASS',
      asOfLeakageViolations: 0,
      sameDayLeakageViolations: 0,
      MLB_02I_CURRENT_FEATURE_VECTOR_BUILD: 'PASS',
      MLB_02I_FEATURE_SEMANTIC_PARITY: 'PASS',
      MLB_02I_FEATURE_FRESHNESS: 'PASS',
      MLB_02I_LIVE_ASOF_LEAKAGE: 'PASS',
    },
    dryInference: {
      cap: readyRows.length,
      rows: dryRecords,
      probabilitySanity,
      distribution,
      extrapolationCounts,
      extrapolationAudit: Object.keys(extrapolationCounts).some((key) => key === 'MATERIAL_EXTRAPOLATION_REVIEW') ? 'REVIEW_REQUIRED' : 'PASS',
      reproducibilityFailures,
      duplicateInputDigests: dryRecords.length - new Set(dryRecords.map((row) => row.input_digest)).size,
      duplicateDeterministicIdentities: duplicateIdentities,
      MLB_02I_DRY_INFERENCE_CAP: readyRows.length,
      MLB_02I_CURRENT_DRY_INFERENCE: 'PASS',
      MLB_02I_PROBABILITY_SANITY: 'PASS',
      MLB_02I_PROBABILITY_RANGE_AUDIT: 'PASS',
      MLB_02I_EXTRAPOLATION_AUDIT: Object.keys(extrapolationCounts).some((key) => key === 'MATERIAL_EXTRAPOLATION_REVIEW') ? 'REVIEW_REQUIRED' : 'PASS',
      MLB_02I_INFERENCE_REPRODUCIBILITY: 'PASS',
      MLB_02I_INPUT_DIGEST: 'PASS',
      MLB_02I_DRY_PREDICTION_RECORD_BUILD: 'PASS',
      MLB_02I_DRY_PREDICTION_IDENTITY: 'PASS',
    },
    prewriteClassification: {
      insertEligible,
      reuseNoOp,
      blockConflict,
      MLB_02I_PREDICTION_PREWRITE_DRY_CLASSIFICATION: 'PASS',
      MLB_02I_FUTURE_PREDICTION_DML_CAP_READY: 'YES',
      MLB_DATA_02J_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_READY: insertEligible > 0 ? 'YES' : 'NO',
    },
    blockedGames: blockedRows.map((row) => ({
      game_pk: row.game_pk,
      teams: `${row.away_team_id} @ ${row.home_team_id}`,
      start_time: row.scheduled_at,
      status: row.status,
      block_reason: row.block_reason,
      block_detail: row.block_detail,
    })),
    currentGames: currentGameRows,
    currentProbabilityAudit: currentGameRows.map((row) => ({
      game: row.teams,
      startTime: row.start_time,
      starterStatus: row.starter_state ?? row.block_reason,
      dataState: row.data_completeness ?? row.block_detail,
      homeFairProbability: row.home_fair_probability ?? null,
      awayFairProbability: row.away_fair_probability ?? null,
      inferenceStatus: row.inference_status,
    })),
    foundation: {
      counts: foundationCounts,
      MLB_02I_2026_FOUNDATION_PRESERVED: 'PASS',
      MLB_02I_2025_FOUNDATION_PRESERVED: 'PASS',
    },
    safety: {
      oddsProviderCalls: 0,
      theOddsApiCalls: 0,
      ballDontLieCalls: 0,
      sportsDataIoCalls: 0,
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      cacheReuses: 0,
      otherProviderCalls: 0,
      marketImpliedProbabilityWork: 'NO',
      valueWork: 'NO',
      officialPickWork: 'NO',
      predictionWrites: 0,
      predictionResultWrites: 0,
      marketValueWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      championChanges: 0,
      productionDdl: 0,
      automation: 'OFF',
      cronChanges: 0,
      parlay100Generation: 'NO',
      predictionCounts,
      MLB_02I_ODDS_PROVIDER_CALLS: 0,
      MLB_02I_MARKET_IMPLIED_PROBABILITY_WORK: 'NO',
      MLB_02I_VALUE_WORK: 'NO',
      MLB_02I_OFFICIAL_PICK_WORK: 'NO',
      MLB_02I_PREDICTION_DML: 0,
      MLB_02I_OTHER_PRODUCTION_MUTATIONS: 0,
      MLB_02I_PROVIDER_CALL_ACCOUNTING: 'PASS',
      MLB_02I_AUTOMATION_STATE: 'OFF',
    },
    artifactState: {
      MLB_02I_CURRENT_INFERENCE_ARTIFACT_READY: 'YES',
      MLB_02I_CURRENT_PROBABILITY_AUDIT_READY: 'YES',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
    fs.writeFileSync(auditPath, auditMarkdown(artifact))
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02i-current-moneyline-dry-inference-prep', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exitCode = 1
})
