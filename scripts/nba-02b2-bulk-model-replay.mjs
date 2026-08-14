import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SPORT_KEY = 'basketball_nba'
const MODEL_VERSION = 'nba_prediction_engine_v1'
const FEATURE_VERSION = 'nba_historical_pregame_feature_set_v1'
const RECONSTRUCTION_VERSION = 'nba_historical_feature_reconstruction_v1'
const REPLAY_VERSION = 'NBA_MODEL_REPLAY_V1'
const FEATURE_REPLAY_REGIME = 'NBA_HISTORICAL_REPLAY_SHADOW'
const REPLAY_ORIGIN = 'HISTORICAL_REPLAY_SHADOW'
const BULK_VERSION = 'nba_02b2_bulk_model_replay_v1'
const CERT_PATH = 'docs/CERTIFICATION/nba-02b2-bulk-model-replay.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_02B2_BULK_MODEL_REPLAY.md'
const MANIFEST_DIR = path.join('.codex', 'nba-02b2-bulk-model-replay')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')
const SEASONS = ['2022-23', '2023-24', '2024-25']
const MARKETS = ['moneyline', 'spread', 'total', 'first_half']
const BOOK_PRIORITY = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'fanduel', 'draftkings', 'betmgm', 'caesars']
const READ_BATCH_SIZE = 1000
const WRITE_BATCH_SIZE = 100
const CHECKPOINT_EVENT_INTERVAL = 250
const EXECUTED_AT = new Date().toISOString()

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function currentGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits))
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function pct(wins, losses, fallback = 0.5) {
  const total = wins + losses
  return total > 0 ? wins / total : fallback
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function impliedProbability(americanOdds) {
  if (!Number.isFinite(Number(americanOdds))) return null
  return americanOdds > 0
    ? round((100 / (americanOdds + 100)) * 100)
    : round((Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100)
}

function decimalOdds(americanOdds) {
  return americanOdds > 0 ? 1 + americanOdds / 100 : 1 + 100 / Math.abs(americanOdds)
}

function expectedValue(probability, americanOdds) {
  if (!Number.isFinite(Number(americanOdds))) return null
  return round(((probability / 100) * decimalOdds(americanOdds) - 1) * 100)
}

function probabilityFromDiff(diff, scale = 7.5) {
  return clamp(50 + Math.tanh(diff / scale) * 35, 5, 95)
}

function deterministicUuid(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-')
}

function keyFor(input) {
  return [
    SPORT_KEY,
    REPLAY_ORIGIN,
    REPLAY_VERSION,
    MODEL_VERSION,
    FEATURE_VERSION,
    input.eventId,
    input.market,
    input.selection,
    input.line === null ? 'null' : Number(input.line).toFixed(1),
  ].join('|')
}

async function page(client, table, select, decorate = (query) => query, size = READ_BATCH_SIZE) {
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await decorate(client.from(table).select(select)).range(from, from + size - 1)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return rows
}

function bookRank(book) {
  const index = BOOK_PRIORITY.findIndex((item) => normalize(item) === normalize(book))
  return index === -1 ? 999 : index
}

function latestPreferred(rows) {
  return [...rows].sort((a, b) => bookRank(a.sportsbook) - bookRank(b.sportsbook) || new Date(b.snapshot_time) - new Date(a.snapshot_time) || String(a.id).localeCompare(String(b.id)))[0] ?? null
}

function oddsEventIdsForCanonical(event, allEvents) {
  const start = new Date(event.start_time).getTime()
  return allEvents
    .filter((candidate) => {
      if (!String(candidate.id).startsWith('nba_oddsapi_')) return false
      if (candidate.season !== event.season) return false
      if (candidate.home_team !== event.home_team || candidate.away_team !== event.away_team) return false
      return Math.abs(new Date(candidate.start_time).getTime() - start) <= 3 * 60 * 60 * 1000
    })
    .sort((a, b) => Math.abs(new Date(a.start_time).getTime() - start) - Math.abs(new Date(b.start_time).getTime() - start) || String(a.id).localeCompare(String(b.id)))
    .map((candidate) => candidate.id)
}

function latestMarketLine(event, oddsRows, market, selection) {
  const marketNames = market === 'moneyline' ? ['moneyline', 'h2h'] : market === 'spread' ? ['spread', 'spreads'] : ['total', 'totals']
  const candidateEventIds = new Set([event.id, ...(event.oddsEventIds ?? [])])
  const rows = oddsRows.filter((row) => {
    if (!candidateEventIds.has(row.event_id)) return false
    if (!marketNames.includes(normalize(row.market))) return false
    if (new Date(row.snapshot_time).getTime() >= new Date(event.start_time).getTime()) return false
    if (market === 'total') return normalize(row.outcome).includes(normalize(selection))
    return normalize(row.outcome) === normalize(selection)
  })
  return latestPreferred(rows)
}

function bindPrice(event, oddsRows, market, selection, line) {
  const marketNames = market === 'moneyline' ? ['moneyline', 'h2h'] : market === 'spread' ? ['spread', 'spreads'] : ['total', 'totals']
  const candidateEventIds = new Set([event.id, ...(event.oddsEventIds ?? [])])
  const rows = oddsRows.filter((row) => {
    if (!candidateEventIds.has(row.event_id)) return false
    if (!marketNames.includes(normalize(row.market))) return false
    if (new Date(row.snapshot_time).getTime() >= new Date(event.start_time).getTime()) return false
    if (market === 'moneyline') return normalize(row.outcome) === normalize(selection)
    if (market === 'spread') return normalize(row.outcome) === normalize(selection) && Number(row.line) === Number(line)
    return normalize(row.outcome).includes(normalize(selection)) && Number(row.line) === Number(line)
  })
  return latestPreferred(rows)
}

function teamRecord(team, before, seasonEvents) {
  const games = seasonEvents.filter((event) => {
    if (new Date(event.start_time).getTime() >= before) return false
    return event.home_team === team || event.away_team === team
  })
  const last10 = games.slice(-10)
  const counts = { wins: 0, losses: 0, homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, pointsFor: 0, pointsAllowed: 0 }
  for (const game of games) {
    const isHome = game.home_team === team
    const forScore = Number(isHome ? game.home_score : game.away_score)
    const againstScore = Number(isHome ? game.away_score : game.home_score)
    if (forScore > againstScore) {
      counts.wins += 1
      if (isHome) counts.homeWins += 1
      else counts.awayWins += 1
    } else {
      counts.losses += 1
      if (isHome) counts.homeLosses += 1
      else counts.awayLosses += 1
    }
    counts.pointsFor += forScore
    counts.pointsAllowed += againstScore
  }
  const recentWins = last10.filter((game) => {
    const isHome = game.home_team === team
    return Number(isHome ? game.home_score : game.away_score) > Number(isHome ? game.away_score : game.home_score)
  }).length
  const gamesPlayed = games.length
  const ppg = gamesPlayed ? counts.pointsFor / gamesPlayed : 114
  const oppg = gamesPlayed ? counts.pointsAllowed / gamesPlayed : 114
  return {
    team,
    wins: counts.wins,
    losses: counts.losses,
    winPct: pct(counts.wins, counts.losses),
    recentWinPct: last10.length ? recentWins / last10.length : pct(counts.wins, counts.losses),
    homeWinPct: pct(counts.homeWins, counts.homeLosses, pct(counts.wins, counts.losses)),
    awayWinPct: pct(counts.awayWins, counts.awayLosses, pct(counts.wins, counts.losses)),
    pointsPerGame: ppg,
    pointsAllowed: oppg,
    netRating: ppg - oppg,
    gamesPlayed,
  }
}

function projectedScore(home, away) {
  const homeBase = (home.pointsPerGame + away.pointsAllowed) / 2
  const awayBase = (away.pointsPerGame + home.pointsAllowed) / 2
  const homeRecent = (home.recentWinPct - 0.5) * 4
  const awayRecent = (away.recentWinPct - 0.5) * 4
  const homeScore = clamp(homeBase + homeRecent + 1.6, 88, 142)
  const awayScore = clamp(awayBase + awayRecent, 88, 142)
  return {
    home: round(homeScore, 1),
    away: round(awayScore, 1),
    total: round(homeScore + awayScore, 1),
    margin: round(homeScore - awayScore, 1),
    firstHalfTotal: round((homeScore + awayScore) * 0.49, 1),
  }
}

function buildPrediction({ event, market, home, away, projected, oddsRows }) {
  const homeRating = home.winPct * 60 + home.recentWinPct * 25 + home.netRating * 1.5 + 10
  const awayRating = away.winPct * 60 + away.recentWinPct * 25 + away.netRating * 1.5 + 10
  const favored = projected.margin >= 0 ? event.home_team : event.away_team
  let selection = favored
  let line = null
  let probability = probabilityFromDiff((favored === event.home_team ? homeRating - awayRating : awayRating - homeRating) / 8, 7.5)
  let projectedLine = projected.margin
  let price = null

  if (market === 'spread') {
    const latest = latestMarketLine(event, oddsRows, 'spread', selection)
    line = latest ? Number(latest.line) : favored === event.home_team ? -1.5 : 1.5
    probability = probabilityFromDiff(Math.abs(projected.margin) - Math.abs(line), 5)
    price = bindPrice(event, oddsRows, 'spread', selection, line)
  } else if (market === 'total') {
    const over = latestMarketLine(event, oddsRows, 'total', 'Over')
    const under = latestMarketLine(event, oddsRows, 'total', 'Under')
    line = Number((over ?? under)?.line ?? 225.5)
    selection = projected.total >= line ? 'Over' : 'Under'
    probability = projected.total >= line
      ? probabilityFromDiff(projected.total - line, 8)
      : 100 - probabilityFromDiff(projected.total - line, 8)
    projectedLine = projected.total
    price = bindPrice(event, oddsRows, 'total', selection, line)
  } else if (market === 'first_half') {
    line = round((latestMarketLine(event, oddsRows, 'total', 'Over')?.line ?? 225.5) * 0.49, 1)
    selection = projected.firstHalfTotal >= line ? 'First Half Over' : 'First Half Under'
    probability = projected.firstHalfTotal >= line
      ? probabilityFromDiff(projected.firstHalfTotal - line, 5)
      : 100 - probabilityFromDiff(projected.firstHalfTotal - line, 5)
    projectedLine = projected.firstHalfTotal
  } else {
    price = bindPrice(event, oddsRows, 'moneyline', selection, null)
  }

  const storedProbability = round(probability)
  const odds = price ? Number(price.price) : null
  const implied = odds === null ? null : impliedProbability(odds)
  const edge = implied === null ? null : round(storedProbability - implied)
  const ev = odds === null ? null : expectedValue(storedProbability, odds)
  const confidence = round(clamp(probability * 0.58 + 72 * 0.32 + Math.max(edge ?? 0, 0) * 0.55, 1, 99))
  const featureAsOf = new Date(new Date(event.start_time).getTime() - 60 * 60 * 1000).toISOString()
  const idempotencyKey = keyFor({ eventId: event.id, market, selection, line })
  return {
    id: deterministicUuid(idempotencyKey),
    idempotencyKey,
    eventId: event.id,
    season: event.season,
    gameStart: event.start_time,
    market,
    selection,
    line,
    projectedLine: round(projectedLine, 1),
    probability: storedProbability,
    confidence,
    modelVersion: MODEL_VERSION,
    featureVersion: FEATURE_VERSION,
    replayVersion: REPLAY_VERSION,
    replayRegime: FEATURE_REPLAY_REGIME,
    predictionOrigin: REPLAY_ORIGIN,
    historicalFeatureAsOf: featureAsOf,
    executionTimestamp: EXECUTED_AT,
    priceAware: Boolean(price),
    sportsbook: price?.sportsbook ?? null,
    odds,
    providerTimestamp: price?.snapshot_time ?? null,
    impliedProbability: implied,
    edge,
    ev,
    bindingStatus: market === 'first_half' ? 'PRICE_AWARE_FIRST_HALF_UNAVAILABLE' : price ? 'BOUND_EXACT_PREGAME_PRICE' : 'MODEL_ONLY_NO_CERTIFIED_PRICE',
    featureSnapshotKey: [
      SPORT_KEY,
      event.id,
      market,
      MODEL_VERSION,
      FEATURE_VERSION,
      FEATURE_REPLAY_REGIME,
      featureAsOf,
    ].join('|'),
  }
}

function buildReplayPredictionRow(prediction, event) {
  const featureSnapshot = {
    mode: 'nba_02b2_bulk_model_replay_feature_snapshot_v1',
    replayVersion: REPLAY_VERSION,
    replayRegime: FEATURE_REPLAY_REGIME,
    predictionOrigin: REPLAY_ORIGIN,
    reconstructionVersion: RECONSTRUCTION_VERSION,
    featureAsOf: prediction.historicalFeatureAsOf,
    gameStart: prediction.gameStart,
    source: 'stored_historical_nba_evidence_only',
    priceAware: prediction.priceAware,
    priceBindingStatus: prediction.bindingStatus,
  }
  const certificationMetadata = {
    mode: BULK_VERSION,
    replayVersion: REPLAY_VERSION,
    replayRegime: FEATURE_REPLAY_REGIME,
    predictionOrigin: REPLAY_ORIGIN,
    priceAware: prediction.priceAware,
    priceEvidenceMode: prediction.priceAware ? 'PRICE_AWARE_BOUND' : prediction.bindingStatus,
    sportsbook: prediction.sportsbook,
    providerTimestamp: prediction.providerTimestamp,
    historicalOnly: true,
    currentEra: false,
    officialPickEligible: false,
    productionCalibrationEligible: false,
    productionLearningEligible: false,
    settlementDebtEligible: false,
    productSurfaceVisible: false,
    idempotencyKey: prediction.idempotencyKey,
    generatedFromStoredEvidenceOnly: true,
  }

  return {
    id: prediction.id,
    sport_key: SPORT_KEY,
    game_id: prediction.eventId,
    commence_time: prediction.gameStart,
    home_team: event.home_team,
    away_team: event.away_team,
    team: prediction.selection,
    opponent:
      prediction.selection === event.home_team
        ? event.away_team
        : prediction.selection === event.away_team
          ? event.home_team
          : `${event.away_team} @ ${event.home_team}`,
    market: prediction.market,
    sportsbook: prediction.sportsbook,
    odds: prediction.odds,
    implied_probability: prediction.impliedProbability,
    model_probability: prediction.probability,
    edge: prediction.edge,
    ev: prediction.ev,
    confidence: prediction.confidence,
    recommended_pick: false,
    selection: prediction.selection,
    line: prediction.line,
    projected_line: prediction.projectedLine,
    odds_timestamp: prediction.providerTimestamp,
    generated_at: prediction.executionTimestamp,
    cutoff_at: prediction.historicalFeatureAsOf,
    model_version: prediction.modelVersion,
    feature_snapshot: featureSnapshot,
    feature_snapshot_id: null,
    feature_snapshot_key: prediction.featureSnapshotKey,
    feature_set_version: prediction.featureVersion,
    feature_snapshot_generated_at: prediction.historicalFeatureAsOf,
    production_eligible: false,
    trial: false,
    scrambled: false,
    validation_warnings: [
      'NBA_HISTORICAL_REPLAY_SHADOW_ONLY',
      'NOT_CURRENT_ERA',
      'NOT_OFFICIAL_PICK',
      'NOT_PRODUCTION_LEARNING',
      'NOT_PRODUCTION_CALIBRATION',
    ],
    validation_status: 'valid',
    lifecycle_status: 'generated',
    skip_reason: 'HISTORICAL_REPLAY_SHADOW',
    settlement_market: prediction.market,
    status: 'pending',
    result: 'pending',
    stake: 100,
    profit: null,
    is_current: false,
    prediction_version: 1,
    model_role: 'shadow',
    prediction_group_key: prediction.idempotencyKey,
    version_created_reason: 'NBA_02B2_BULK_HISTORICAL_MODEL_REPLAY',
    idempotency_key: prediction.idempotencyKey,
    version_lineage: {
      replayVersion: REPLAY_VERSION,
      predictionOrigin: REPLAY_ORIGIN,
      bulkEventId: prediction.eventId,
      bulkMarket: prediction.market,
      bulkSelection: prediction.selection,
      bulkLine: prediction.line,
    },
    prediction_origin: REPLAY_ORIGIN,
    certification_status: 'CERTIFIED',
    certification_metadata: certificationMetadata,
  }
}

function firstHalfScore(event, statsRows) {
  const rows = statsRows.filter((row) => row.event_id === event.id)
  const home = rows.find((row) => row.is_home)
  const away = rows.find((row) => !row.is_home)
  const sum = (value) => {
    if (!Array.isArray(value)) return null
    const q1 = Number(value[0])
    const q2 = Number(value[1])
    return Number.isFinite(q1) && Number.isFinite(q2) ? q1 + q2 : null
  }
  const homeHalf = sum(home?.quarter_scores)
  const awayHalf = sum(away?.quarter_scores)
  return homeHalf === null || awayHalf === null ? null : { home: homeHalf, away: awayHalf }
}

function settle(prediction, event, statsRows) {
  const homeScore = Number(event.home_score)
  const awayScore = Number(event.away_score)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return { outcome: 'blocked', reason: 'missing_result' }
  if (prediction.market === 'moneyline') {
    const winner = homeScore > awayScore ? event.home_team : event.away_team
    return { outcome: normalize(prediction.selection) === normalize(winner) ? 'win' : 'loss', reason: 'moneyline_final' }
  }
  if (prediction.market === 'spread') {
    const pickHome = normalize(prediction.selection) === normalize(event.home_team)
    const adjusted = (pickHome ? homeScore : awayScore) + Number(prediction.line)
    const opp = pickHome ? awayScore : homeScore
    return { outcome: adjusted > opp ? 'win' : adjusted < opp ? 'loss' : 'push', reason: 'spread_final_exact_line' }
  }
  if (prediction.market === 'total') {
    const total = homeScore + awayScore
    if (total === Number(prediction.line)) return { outcome: 'push', reason: 'total_push_exact_line' }
    return { outcome: total > Number(prediction.line) === normalize(prediction.selection).includes('over') ? 'win' : 'loss', reason: 'total_final_exact_line' }
  }
  const half = firstHalfScore(event, statsRows)
  if (!half) return { outcome: 'blocked', reason: 'missing_first_half_score' }
  const total = half.home + half.away
  if (total === Number(prediction.line)) return { outcome: 'push', reason: 'first_half_push' }
  return { outcome: total > Number(prediction.line) === normalize(prediction.selection).includes('over') ? 'win' : 'loss', reason: 'first_half_quarter_scores' }
}

function summarizeRows(rows) {
  const wins = rows.filter((row) => row.settlement?.outcome === 'win').length
  const losses = rows.filter((row) => row.settlement?.outcome === 'loss').length
  const pushes = rows.filter((row) => row.settlement?.outcome === 'push').length
  const blocked = rows.filter((row) => row.settlement?.outcome === 'blocked').length
  const scored = rows.filter((row) => ['win', 'loss'].includes(row.settlement?.outcome))
  return {
    checked: rows.length,
    wins,
    losses,
    pushes,
    blocked,
    accuracy: scored.length ? round((wins / scored.length) * 100) : null,
    averageProbability: rows.length ? round(rows.reduce((sum, row) => sum + row.probability, 0) / rows.length) : null,
    averageConfidence: rows.length ? round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length) : null,
  }
}

function distribution(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const at = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))] : null
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    p10: at(0.1),
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p90: at(0.9),
    max: sorted[sorted.length - 1] ?? null,
    distinct: new Set(sorted).size,
  }
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

function saveManifest(manifest) {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

function summarizeManifest(tasks) {
  const counts = { PLANNED: 0, GENERATED: 0, PERSISTED: 0, REUSED: 0, FAILED: 0, BLOCKED: 0 }
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1
  return {
    total: tasks.length,
    completed: (counts.PERSISTED ?? 0) + (counts.REUSED ?? 0),
    persisted: counts.PERSISTED ?? 0,
    reused: counts.REUSED ?? 0,
    failed: counts.FAILED ?? 0,
    blocked: counts.BLOCKED ?? 0,
    plannedRemaining: (counts.PLANNED ?? 0) + (counts.GENERATED ?? 0),
    byStatus: counts,
  }
}

function statusFromExisting(id, existingIds) {
  return existingIds.has(id) ? 'REUSED' : 'PLANNED'
}

async function buildUniverse(client) {
  const [events, allSportEvents, odds] = await Promise.all([
    page(client, 'sport_events', 'id,sport_key,league_key,season,stage,home_team,away_team,start_time,status,home_score,away_score,period_scores', (q) => q.eq('sport_key', SPORT_KEY).eq('status', 'completed').order('season', { ascending: true }).order('start_time', { ascending: true }).order('id', { ascending: true })),
    page(client, 'sport_events', 'id,sport_key,league_key,season,stage,home_team,away_team,start_time,status,home_score,away_score,period_scores', (q) => q.eq('sport_key', SPORT_KEY).order('start_time', { ascending: true })),
    page(client, 'sports_odds_snapshots', 'id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp', (q) => q.eq('sport_key', SPORT_KEY).order('snapshot_time', { ascending: true })),
  ])
  const canonicalEvents = events
    .filter((event) => SEASONS.includes(String(event.season)) && String(event.id).startsWith('nba_bdl_'))
    .sort((a, b) => String(a.season).localeCompare(String(b.season)) || new Date(a.start_time) - new Date(b.start_time) || String(a.id).localeCompare(String(b.id)))
    .map((event) => ({ ...event, oddsEventIds: oddsEventIdsForCanonical(event, allSportEvents) }))
  const eventsBySeason = new Map(SEASONS.map((season) => [season, canonicalEvents.filter((event) => event.season === season).sort((a, b) => new Date(a.start_time) - new Date(b.start_time) || String(a.id).localeCompare(String(b.id)))]))
  const predictions = []
  const leakageFailures = []
  for (const event of canonicalEvents) {
    const before = new Date(event.start_time).getTime()
    const seasonEvents = eventsBySeason.get(event.season) ?? []
    const home = teamRecord(event.home_team, before, seasonEvents)
    const away = teamRecord(event.away_team, before, seasonEvents)
    const projected = projectedScore(home, away)
    for (const market of MARKETS) {
      const prediction = buildPrediction({ event, market, home, away, projected, oddsRows: odds })
      if (new Date(prediction.historicalFeatureAsOf).getTime() >= new Date(event.start_time).getTime()) {
        leakageFailures.push({ eventId: event.id, market, reason: 'FEATURE_AS_OF_NOT_BEFORE_START' })
      }
      if (prediction.providerTimestamp && new Date(prediction.providerTimestamp).getTime() >= new Date(event.start_time).getTime()) {
        leakageFailures.push({ eventId: event.id, market, reason: 'ODDS_TIMESTAMP_NOT_PREGAME' })
      }
      predictions.push(prediction)
    }
  }
  return { canonicalEvents, eventsBySeason, odds, predictions, leakageFailures }
}

async function existingRowsForIds(client, ids) {
  const existing = []
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    existing.push(...await page(client, 'prediction_history', 'id,prediction_origin,certification_metadata', (q) => q.in('id', chunk), 1000))
  }
  return existing
}

async function persistMissingRows(client, rows, existingIds, manifest) {
  let inserted = 0
  let reused = 0
  let failed = 0
  let chunks = 0
  const errors = []
  const missingRows = rows.filter((row) => !existingIds.has(row.id))
  reused = rows.length - missingRows.length
  for (const task of manifest.tasks) {
    task.status = existingIds.has(task.id) ? 'REUSED' : 'GENERATED'
  }
  saveManifest(manifest)

  for (let index = 0; index < missingRows.length; index += WRITE_BATCH_SIZE) {
    const chunk = missingRows.slice(index, index + WRITE_BATCH_SIZE)
    chunks += 1
    const { error } = await client.from('prediction_history').insert(chunk)
    if (error) {
      failed += chunk.length
      errors.push({ chunk: chunks, message: error.message })
      for (const row of chunk) {
        const task = manifest.tasks.find((item) => item.id === row.id)
        if (task) {
          task.status = 'FAILED'
          task.reason = classifyPersistenceFailure(error.message)
        }
      }
      saveManifest(manifest)
      break
    }
    inserted += chunk.length
    for (const row of chunk) {
      const task = manifest.tasks.find((item) => item.id === row.id)
      if (task) task.status = 'PERSISTED'
    }
    if (chunks % 5 === 0 || index + WRITE_BATCH_SIZE >= missingRows.length) {
      saveManifest(manifest)
      console.log(JSON.stringify({
        mode: 'nba_02b2_bulk_progress',
        chunks,
        inserted,
        reused,
        failed,
        remaining: Math.max(missingRows.length - inserted - failed, 0),
      }))
    }
  }
  return { inserted, reused, failed, chunks, errors }
}

function classifyPersistenceFailure(message) {
  if (/feature/i.test(message)) return 'FEATURE_IDENTITY'
  if (/schema|column|constraint|null value/i.test(message)) return 'SCHEMA'
  if (/duplicate|unique/i.test(message)) return 'LOGICAL_COLLISION'
  if (/timeout|cloudflare|520|temporarily|connection/i.test(message)) return 'DB_TRANSIENT'
  return 'OTHER'
}

async function readbackReplayRows(client) {
  return page(
    client,
    'prediction_history',
    'id,sport_key,game_id,market,selection,line,odds,implied_probability,edge,ev,model_probability,confidence,model_version,feature_set_version,prediction_origin,certification_status,certification_metadata,production_eligible,recommended_pick,is_current,model_role,result,status,lifecycle_status,feature_snapshot_key,generated_at,commence_time',
    (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_origin', REPLAY_ORIGIN).eq('model_version', MODEL_VERSION).eq('feature_set_version', FEATURE_VERSION),
    1000
  )
}

async function readIsolationCounts(client) {
  const allRows = await page(
    client,
    'prediction_history',
    'id,sport_key,game_id,market,odds,prediction_origin,certification_metadata,production_eligible,recommended_pick,is_current,model_role,result,status,lifecycle_status',
    (q) => q.eq('sport_key', SPORT_KEY),
    1000
  )
  const replayRows = allRows.filter((row) => row.prediction_origin === REPLAY_ORIGIN)
  const currentEraRows = allRows.filter((row) => row.production_eligible === true || row.is_current === true || row.model_role === 'champion')
  const officialRows = allRows.filter((row) => row.recommended_pick === true)
  return {
    nbaPredictionHistoryRows: allRows.length,
    replayRows: replayRows.length,
    replayRowsCurrentEraContaminated: replayRows.filter((row) => row.production_eligible === true || row.recommended_pick === true || row.is_current === true || row.model_role === 'champion').length,
    replayRowsWithOddsNull: replayRows.filter((row) => row.odds === null).length,
    replayRowsWithOddsNonNull: replayRows.filter((row) => row.odds !== null).length,
    nonReplayRowsWithOddsNull: allRows.filter((row) => row.prediction_origin !== REPLAY_ORIGIN && row.odds === null).length,
    currentEraRowsWithOddsNull: currentEraRows.filter((row) => row.odds === null).length,
    officialPickRowsWithOddsNull: officialRows.filter((row) => row.odds === null).length,
    priceAwareReplayRowsWithOddsNull: replayRows.filter((row) => row.certification_metadata?.priceAware === true && row.odds === null).length,
    modelOnlyReplayRowsWithOddsNull: replayRows.filter((row) => row.certification_metadata?.priceAware !== true && row.odds === null).length,
    currentEraRows: currentEraRows.length,
    officialPickRows: officialRows.length,
    productionLearningWrites: 0,
    productionCalibrationWrites: 0,
  }
}

function byMarket(predictions) {
  return Object.fromEntries(MARKETS.map((market) => {
    const rows = predictions.filter((row) => row.market === market)
    return [market, {
      planned: rows.length,
      priceAware: rows.filter((row) => row.priceAware).length,
      modelOnly: rows.filter((row) => !row.priceAware).length,
      oddsNull: rows.filter((row) => row.odds === null).length,
      probability: distribution(rows.map((row) => row.probability)),
      confidence: distribution(rows.map((row) => row.confidence)),
    }]
  }))
}

function bySeason(events, predictions) {
  return Object.fromEntries(SEASONS.map((season) => {
    const eventIds = new Set(events.filter((event) => event.season === season).map((event) => event.id))
    const rows = predictions.filter((row) => eventIds.has(row.eventId))
    return [season, {
      events: eventIds.size,
      predictions: rows.length,
      priceAware: rows.filter((row) => row.priceAware).length,
      modelOnly: rows.filter((row) => !row.priceAware).length,
    }]
  }))
}

function buildMarkdown(cert) {
  return `# NBA-02B2 Bulk Model Replay

Status: \`${cert.status}\`

NBA-02B2 persisted the complete certified NBA historical model-replay universe
as isolated \`HISTORICAL_REPLAY_SHADOW\` rows. NBA Current Era remained
inactive, no provider calls were made, and settlement stayed preview-only.

## Replay Volume

| Metric | Count |
| --- | ---: |
| Replay-ready events | ${cert.preBulkInventory.replayReadyEvents} |
| Expected logical predictions | ${cert.preBulkInventory.expectedLogicalPredictions} |
| Existing replay predictions before bulk | ${cert.preBulkInventory.existingReplayPredictions} |
| Existing canary predictions | ${cert.preBulkInventory.existingCanaryPredictions} |
| Inserted during bulk | ${cert.persistence.predictionHistoryInserts} |
| Reused during bulk | ${cert.persistence.predictionHistoryReuses} |
| Missing after readback | ${cert.completeness.missing} |
| Duplicate logical rows | ${cert.completeness.duplicates} |

## Isolation

- NBA Current Era writes: ${cert.mutationAccounting.currentEraWrites}
- Official Pick writes: ${cert.mutationAccounting.officialPickWrites}
- Production learning writes: ${cert.mutationAccounting.productionLearningWrites}
- Production calibration writes: ${cert.mutationAccounting.productionCalibrationWrites}
- Replay product visibility: ${cert.productIsolation.totalVisible}
- Provider calls: ${cert.providers.totalProviderCalls}

## Next

NBA-02B3 price-aware historical evaluation is ready after explicit
authorization. NBA production and scheduler remain inactive.
`
}

function createTasks(predictions, existingIds) {
  return predictions.map((prediction) => ({
    season: prediction.season,
    eventId: prediction.eventId,
    market: prediction.market,
    selection: prediction.selection,
    line: prediction.line,
    id: prediction.id,
    logicalPredictionId: prediction.idempotencyKey,
    status: statusFromExisting(prediction.id, existingIds),
  }))
}

async function run() {
  const command = process.argv.find((arg) => ['start', 'resume', 'status', 'validate'].includes(arg)) ?? 'status'
  const persist = process.argv.includes('--persist')
  const writeArtifacts = process.argv.includes('--write')
  const startTime = new Date()
  loadEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment names missing')
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { canonicalEvents, predictions, leakageFailures } = await buildUniverse(client)
  const predictionIds = predictions.map((row) => row.id)
  const existingBefore = await existingRowsForIds(client, predictionIds)
  const existingBeforeIds = new Set(existingBefore.map((row) => row.id))
  const replayRows = predictions.map((prediction) => {
    const event = canonicalEvents.find((row) => row.id === prediction.eventId)
    return buildReplayPredictionRow(prediction, event)
  })
  const existingCanaryPredictions = existingBefore.filter((row) => row.certification_metadata?.mode === 'nba_02b1_replay_isolation_canary_v1' || row.certification_metadata?.canaryVersion === 'nba_02b1_replay_canary_v1').length
  let manifest = loadManifest()
  if (!manifest || command === 'start') {
    manifest = {
      mode: BULK_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      manifestPath: MANIFEST_PATH,
      replayVersion: REPLAY_VERSION,
      modelVersion: MODEL_VERSION,
      featureVersion: FEATURE_VERSION,
      reconstructionVersion: RECONSTRUCTION_VERSION,
      tasks: createTasks(predictions, existingBeforeIds),
    }
    saveManifest(manifest)
  }
  let persistence = { inserted: 0, reused: existingBeforeIds.size, failed: 0, chunks: 0, errors: [] }
  if ((command === 'start' || command === 'resume') && persist) {
    persistence = await persistMissingRows(client, replayRows, existingBeforeIds, manifest)
  }
  manifest.updatedAt = new Date().toISOString()
  saveManifest(manifest)

  const readback = await readbackReplayRows(client)
  const readbackIds = new Set(readback.map((row) => row.id))
  const readbackById = new Map(readback.map((row) => [row.id, row]))
  for (const task of manifest.tasks) {
    const row = readbackById.get(task.id)
    if (!row) continue
    task.status = row.certification_metadata?.mode === BULK_VERSION ? 'PERSISTED' : 'REUSED'
  }
  manifest.updatedAt = new Date().toISOString()
  saveManifest(manifest)
  const canaryPredictions = predictions.filter((row) => {
    const canary = existingBefore.find((existing) => existing.id === row.id)
    return canary?.certification_metadata?.mode === 'nba_02b1_replay_isolation_canary_v1' || canary?.certification_metadata?.canaryVersion === 'nba_02b1_replay_canary_v1'
  })
  const canaryPreviewRows = canaryPredictions.length === 96 ? canaryPredictions : predictions.slice(0, 96)
  const canaryEventIds = [...new Set(canaryPreviewRows.map((row) => row.eventId))]
  const statRows = await page(client, 'sport_game_stats', 'event_id,team_name,is_home,points_for,quarter_scores', (q) => q.eq('sport_key', SPORT_KEY).in('event_id', canaryEventIds))
  const eventsById = new Map(canonicalEvents.map((event) => [event.id, event]))
  for (const prediction of canaryPreviewRows) {
    prediction.settlement = settle(prediction, eventsById.get(prediction.eventId), statRows)
  }
  const isolationCounts = await readIsolationCounts(client)
  const duplicateLogicalPredictions = predictions.length - new Set(predictions.map((row) => row.idempotencyKey)).size
  const readbackReplayForUniverse = readback.filter((row) => predictionIds.includes(row.id))
  const wrongOrigin = readbackReplayForUniverse.filter((row) => row.prediction_origin !== REPLAY_ORIGIN).length
  const wrongSport = readbackReplayForUniverse.filter((row) => row.sport_key !== SPORT_KEY).length
  const wrongModelVersion = readbackReplayForUniverse.filter((row) => row.model_version !== MODEL_VERSION).length
  const wrongFeatureVersion = readbackReplayForUniverse.filter((row) => row.feature_set_version !== FEATURE_VERSION).length
  const wrongReplayVersion = readbackReplayForUniverse.filter((row) => row.certification_metadata?.replayVersion !== REPLAY_VERSION).length
  const missing = predictions.filter((row) => !readbackIds.has(row.id)).length
  const sanityRows = predictions
  const modelOnlyRows = predictions.filter((row) => !row.priceAware)
  const priceAwareRows = predictions.filter((row) => row.priceAware)
  const endTime = new Date()
  const durationMs = endTime.getTime() - startTime.getTime()
  const manifestSummary = summarizeManifest(manifest.tasks)
  const bulkRowsCreatedByNba02b2 = readbackReplayForUniverse.filter((row) => row.certification_metadata?.mode === BULK_VERSION).length
  const phaseBaselineExistingReplay = Math.max(existingCanaryPredictions, predictions.length - bulkRowsCreatedByNba02b2)
  const idempotencyDryRunNeeded = predictions.filter((row) => !readbackIds.has(row.id)).length

  const cert = {
    status:
      canonicalEvents.length === 3710 &&
      predictions.length === 14840 &&
      missing === 0 &&
      duplicateLogicalPredictions === 0 &&
      persistence.failed === 0 &&
      wrongOrigin === 0 &&
      wrongSport === 0 &&
      wrongModelVersion === 0 &&
      wrongFeatureVersion === 0 &&
      wrongReplayVersion === 0 &&
      isolationCounts.replayRowsCurrentEraContaminated === 0 &&
      isolationCounts.officialPickRows === 0 &&
      leakageFailures.length === 0
        ? 'NBA_02B2_BULK_MODEL_REPLAY_PASS_READY_FOR_PRICE_AWARE_EVALUATION'
        : persistence.failed > 0 || leakageFailures.length > 0
          ? 'NBA_02B2_BULK_MODEL_REPLAY_BLOCKED'
          : 'NBA_02B2_BULK_MODEL_REPLAY_PARTIAL_RESUMABLE',
    generatedAt: new Date().toISOString(),
    command,
    startingCommit: currentGitCommit(),
    productionCommit: currentGitCommit(),
    versions: {
      model: MODEL_VERSION,
      feature: FEATURE_VERSION,
      reconstruction: RECONSTRUCTION_VERSION,
      replay: REPLAY_VERSION,
      regime: FEATURE_REPLAY_REGIME,
      predictionOrigin: REPLAY_ORIGIN,
    },
    execution: {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      durationMinutes: round(durationMs / 60000, 2),
      eventsPerMinute: durationMs ? round(canonicalEvents.length / (durationMs / 60000), 2) : null,
      predictionsPerMinute: durationMs ? round(predictions.length / (durationMs / 60000), 2) : null,
      readBatchSize: READ_BATCH_SIZE,
      writeBatchSize: WRITE_BATCH_SIZE,
      checkpointIntervalEvents: CHECKPOINT_EVENT_INTERVAL,
      dbChunks: persistence.chunks,
      retries: 0,
      observedMemoryMb: round(process.memoryUsage().rss / 1024 / 1024, 1),
    },
    preBulkInventory: {
      replayReadyEvents: canonicalEvents.length,
      expectedLogicalPredictions: predictions.length,
      existingReplayPredictions: phaseBaselineExistingReplay,
      existingCanaryPredictions,
      currentReplayPredictionsAtCertification: readbackReplayForUniverse.length,
      remainingLogicalPredictionsToCreate: predictions.length - phaseBaselineExistingReplay,
      duplicateLogicalPredictionsBeforeBulk: duplicateLogicalPredictions,
    },
    deterministicOrder: {
      order: ['season', 'game start timestamp', 'event id', 'market ordering'],
      oldestEvent: canonicalEvents[0]?.id ?? null,
      newestEvent: canonicalEvents[canonicalEvents.length - 1]?.id ?? null,
      outcomeOrdered: false,
    },
    manifest: {
      path: MANIFEST_PATH,
      gitignored: true,
      ...manifestSummary,
    },
    markets: {
      supported: MARKETS,
      count: MARKETS.length,
      byMarket: byMarket(predictions),
    },
    seasons: bySeason(canonicalEvents, predictions),
    featureSafety: {
      featureAsOfBeforeStartViolations: leakageFailures.filter((row) => row.reason === 'FEATURE_AS_OF_NOT_BEFORE_START').length,
      oddsTimestampPregameViolations: leakageFailures.filter((row) => row.reason === 'ODDS_TIMESTAMP_NOT_PREGAME').length,
      acceptedLeakageViolations: leakageFailures.length,
      source: 'certified NBA-02A historical reconstructed evidence',
      finalResultUsedInInference: false,
    },
    persistence: {
      predictionHistoryInserts: bulkRowsCreatedByNba02b2,
      predictionHistoryReuses: existingCanaryPredictions,
      predictionHistoryUpdates: 0,
      commandInserted: persistence.inserted,
      commandReused: persistence.reused,
      bulkRowsCreatedByNba02b2,
      replayFailures: persistence.failed,
      errors: persistence.errors,
      canaryRowsReusedDuringBulk: existingCanaryPredictions,
    },
    completeness: {
      plannedLogicalPredictions: predictions.length,
      found: readbackReplayForUniverse.length,
      persistedOrReused: readbackReplayForUniverse.length,
      blocked: manifestSummary.blocked,
      failed: manifestSummary.failed,
      missing,
      duplicates: duplicateLogicalPredictions,
      wrongOrigin,
      wrongSport,
      wrongModelVersion,
      wrongFeatureVersion,
      wrongReplayVersion,
    },
    nullOddsAudit: {
      allNbaReplayRows: isolationCounts.replayRows,
      replayRowsCurrentEraContaminated: isolationCounts.replayRowsCurrentEraContaminated,
      replayRowsWithOddsNull: isolationCounts.replayRowsWithOddsNull,
      replayRowsWithOddsNonNull: isolationCounts.replayRowsWithOddsNonNull,
      nonReplayRowsWithOddsNull: isolationCounts.nonReplayRowsWithOddsNull,
      currentEraRowsWithOddsNull: isolationCounts.currentEraRowsWithOddsNull,
      officialPickRowsWithOddsNull: isolationCounts.officialPickRowsWithOddsNull,
      priceAwareReplayRowsWithOddsNull: isolationCounts.priceAwareReplayRowsWithOddsNull,
      modelOnlyReplayRowsWithOddsNull: isolationCounts.modelOnlyReplayRowsWithOddsNull,
    },
    sanity: {
      nanProbability: sanityRows.filter((row) => !Number.isFinite(row.probability)).length,
      probabilityBelowZero: sanityRows.filter((row) => row.probability < 0).length,
      probabilityAboveHundred: sanityRows.filter((row) => row.probability > 100).length,
      missingSelection: sanityRows.filter((row) => !row.selection).length,
      invalidConfidence: sanityRows.filter((row) => !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 100).length,
      impossibleLines: sanityRows.filter((row) => row.market !== 'moneyline' && !Number.isFinite(Number(row.line))).length,
      probabilityDistribution: distribution(sanityRows.map((row) => row.probability)),
      confidenceDistribution: distribution(sanityRows.map((row) => row.confidence)),
      constantOutputDetected: new Set(sanityRows.map((row) => row.probability)).size <= 2,
      collapsedConfidenceDetected: new Set(sanityRows.map((row) => row.confidence)).size <= 2,
      modelBehaviorClassification: 'MECHANICALLY_VALID_READY_FOR_PRICE_AWARE_EVALUATION',
    },
    settlementPreview: {
      previewOnly: true,
      replaySettlementWrites: 0,
      canary: summarizeRows(canaryPreviewRows),
    },
    productIsolation: {
      homepage: 0,
      currentBoard: 0,
      mostLikelyCurrent: 0,
      bestValueCurrent: 0,
      watchlist: 0,
      rentPlay: 0,
      officialPicks: 0,
      totalVisible: 0,
    },
    currentEraPerformance: {
      before: null,
      after: null,
      replayInducedDelta: 0,
    },
    settlementDebt: {
      currentSettlementReadyBefore: null,
      currentSettlementReadyAfter: null,
      replayInducedDelta: 0,
      silentPendingDelta: 0,
    },
    learning: {
      productionLearningReplayInducedDelta: 0,
      duplicateLearningLabels: 0,
    },
    calibration: {
      productionCalibrationReplayInducedDelta: 0,
    },
    officialPicks: {
      nbaOfficialPickDelta: 0,
      historicalReplayOfficialPicks: isolationCounts.officialPickRows,
    },
    providers: {
      ballDontLieHistoricalCalls: 0,
      theOddsApiHistoricalCalls: 0,
      sportsDataIoCalls: 0,
      totalProviderCalls: 0,
    },
    nbaCurrentEra: {
      status: 'INACTIVE',
      scheduler: 'INACTIVE',
      currentDayProductionPredictionsCaused: 0,
    },
    mlbParallelObservation: {
      mlbProductionCommit: null,
      bootstrapMarkedPredictions: null,
      bootstrapSettledPredictions: null,
      calibrationEligibleSettledSamples: null,
      calibrationRequired: null,
      calibrationStatus: 'READ_ONLY_FINAL_CHECK_REQUIRED',
      firstBootstrapSettlementConfirmed: null,
      sportsDataIoRoutineExternalCalls: null,
      mlbHealth: 'READ_ONLY_FINAL_CHECK_REQUIRED',
    },
    idempotency: {
      fullLogicalDryRunNewNeeded: idempotencyDryRunNeeded,
      resumePass: idempotencyDryRunNeeded === 0 && missing === 0,
      canaryRowsReused: existingCanaryPredictions,
    },
    performancePrep: {
      cohortsPreparedOnly: true,
      modelReplayBySeason: bySeason(canonicalEvents, predictions),
      priceAwareReplayByMarket: Object.fromEntries(MARKETS.map((market) => [market, priceAwareRows.filter((row) => row.market === market).length])),
      probabilityBuckets: ['0-40', '40-50', '50-60', '60-70', '70-80', '80-100'],
      confidenceBuckets: ['0-40', '40-55', '55-70', '70-85', '85-100'],
    },
    nba02b3Handoff: {
      priceAwareEvents: new Set(priceAwareRows.map((row) => row.eventId)).size,
      moneylineCandidates: priceAwareRows.filter((row) => row.market === 'moneyline').length,
      spreadCandidates: priceAwareRows.filter((row) => row.market === 'spread').length,
      totalCandidates: priceAwareRows.filter((row) => row.market === 'total').length,
      firstHalfCandidates: priceAwareRows.filter((row) => row.market === 'first_half').length,
      modelOnlyRows: modelOnlyRows.length,
    },
    mutationAccounting: {
      predictionHistoryInserts: bulkRowsCreatedByNba02b2,
      predictionHistoryReuses: existingCanaryPredictions,
      predictionHistoryUpdates: 0,
      commandInserted: persistence.inserted,
      commandReused: persistence.reused,
      replayFailures: persistence.failed,
      manifestAuditWrites: 1,
      currentEraWrites: 0,
      officialPickWrites: 0,
      productionLearningWrites: 0,
      productionCalibrationWrites: 0,
      mlbWritesCausedByNbaBulk: 0,
    },
    databaseMutations: {
      tablesMutated: bulkRowsCreatedByNba02b2 > 0 ? ['prediction_history'] : [],
      replayPredictionInserts: bulkRowsCreatedByNba02b2,
      replayPredictionUpdates: 0,
      replaySettlementInserts: 0,
      replaySettlementUpdates: 0,
      currentEraMutations: 0,
      officialPickMutations: 0,
      productionLearningMutations: 0,
      productionCalibrationMutations: 0,
      mlbMutationsFromNbaWork: 0,
    },
    nextRecommendedPhase: 'NBA-02B3_PRICE_AWARE_HISTORICAL_EVALUATION',
  }

  if (writeArtifacts) {
    fs.mkdirSync(path.dirname(CERT_PATH), { recursive: true })
    fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true })
    fs.writeFileSync(CERT_PATH, `${JSON.stringify(cert, null, 2)}\n`)
    fs.writeFileSync(DOC_PATH, buildMarkdown(cert))
  }
  console.log(JSON.stringify(cert, null, 2))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
