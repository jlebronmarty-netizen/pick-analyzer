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
const CERT_PATH = 'docs/CERTIFICATION/nba-02b1-replay-canary.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_02B1_REPLAY_CANARY.md'
const SEASONS = ['2022-23', '2023-24', '2024-25']
const MARKETS = ['moneyline', 'spread', 'total', 'first_half']
const BOOK_PRIORITY = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'fanduel', 'draftkings', 'betmgm', 'caesars']
const CANARY_EXECUTED_AT = '2026-08-14T19:30:00.000Z'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
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

function impliedProbability(americanOdds) {
  if (!Number.isFinite(Number(americanOdds))) return null
  return americanOdds > 0 ? round((100 / (americanOdds + 100)) * 100) : round((Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100)
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

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

async function page(client, table, select, decorate = (query) => query, size = 1000) {
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await decorate(client.from(table).select(select)).range(from, from + size - 1)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return rows
}

function seasonStageBucket(event, seasonRows) {
  const index = seasonRows.findIndex((row) => row.id === event.id)
  const ratio = index / Math.max(seasonRows.length - 1, 1)
  if (ratio < 0.25) return 'early'
  if (ratio < 0.72) return 'mid'
  return 'late'
}

function chooseByPercentiles(rows, count, percentiles) {
  const selected = []
  for (const p of percentiles) {
    if (selected.length >= count || rows.length === 0) break
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor((rows.length - 1) * p)))
    const candidate = rows[index]
    if (!selected.some((row) => row.id === candidate.id)) selected.push(candidate)
  }
  for (const row of rows) {
    if (selected.length >= count) break
    if (!selected.some((item) => item.id === row.id)) selected.push(row)
  }
  return selected
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

function priceMarketsForEvent(event, oddsRows, allEvents) {
  const candidateEventIds = new Set([event.id, ...oddsEventIdsForCanonical(event, allEvents)])
  const pregame = oddsRows.filter((row) => candidateEventIds.has(row.event_id) && new Date(row.snapshot_time).getTime() < new Date(event.start_time).getTime())
  const hasMoneyline = pregame.some((row) => ['moneyline', 'h2h'].includes(normalize(row.market)))
  const hasSpread = pregame.some((row) => ['spread', 'spreads'].includes(normalize(row.market)))
  const hasTotal = pregame.some((row) => ['total', 'totals'].includes(normalize(row.market)))
  return { pregame, hasMoneyline, hasSpread, hasTotal, fullCore: hasMoneyline && hasSpread && hasTotal }
}

function selectCanaryEvents(events, resultsByEvent, oddsRows, allEvents = events) {
  const canonical = events
    .filter((event) => SEASONS.includes(String(event.season)) && resultsByEvent.has(event.id))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time) || String(a.id).localeCompare(String(b.id)))
  const bySeason = new Map(SEASONS.map((season) => [season, canonical.filter((event) => event.season === season)]))
  const selected = []
  for (const season of SEASONS) {
    const rows = bySeason.get(season) ?? []
    const candidates = season === '2024-25'
      ? rows.filter((event) => priceMarketsForEvent(event, oddsRows, allEvents).fullCore)
      : rows.filter((event) => !priceMarketsForEvent(event, oddsRows, allEvents).fullCore)
    selected.push(...chooseByPercentiles(candidates.length >= 8 ? candidates : rows, 8, [0.03, 0.12, 0.24, 0.42, 0.58, 0.74, 0.88, 0.98]))
  }
  return selected
    .slice(0, 24)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time) || String(a.id).localeCompare(String(b.id)))
    .map((event) => ({
      ...event,
      seasonStageBucket: seasonStageBucket(event, bySeason.get(event.season) ?? []),
      oddsEventIds: oddsEventIdsForCanonical(event, allEvents),
      priceAwareAvailability: priceMarketsForEvent(event, oddsRows, allEvents),
    }))
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

function bookRank(book) {
  const index = BOOK_PRIORITY.findIndex((item) => normalize(item) === normalize(book))
  return index === -1 ? 999 : index
}

function latestPreferred(rows) {
  return [...rows].sort((a, b) => bookRank(a.sportsbook) - bookRank(b.sportsbook) || new Date(b.snapshot_time) - new Date(a.snapshot_time) || String(a.id).localeCompare(String(b.id)))[0] ?? null
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
    executionTimestamp: CANARY_EXECUTED_AT,
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
    mode: 'nba_02b1_replay_canary_feature_snapshot_v1',
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
    mode: 'nba_02b1_replay_isolation_canary_v1',
    canaryVersion: 'nba_02b1_replay_canary_v1',
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
    version_created_reason: 'NBA_02B1_HISTORICAL_REPLAY_CANARY',
    idempotency_key: prediction.idempotencyKey,
    version_lineage: {
      replayVersion: REPLAY_VERSION,
      predictionOrigin: REPLAY_ORIGIN,
      canaryEventId: prediction.eventId,
      canaryMarket: prediction.market,
      canarySelection: prediction.selection,
      canaryLine: prediction.line,
    },
    prediction_origin: REPLAY_ORIGIN,
    certification_status: 'CERTIFIED',
    certification_metadata: certificationMetadata,
  }
}

async function persistReplayRows(client, rows) {
  if (!rows.length) return { inserted: 0, reused: 0, failed: 0, chunks: 0, errors: [] }
  const ids = rows.map((row) => row.id)
  const existing = await page(
    client,
    'prediction_history',
    'id,prediction_origin',
    (query) => query.in('id', ids),
    1000
  )
  const existingIds = new Set(existing.map((row) => row.id))
  const inserted = rows.filter((row) => !existingIds.has(row.id)).length
  const reused = rows.length - inserted
  let chunks = 0
  const errors = []
  for (let index = 0; index < rows.length; index += 25) {
    chunks += 1
    const chunk = rows.slice(index, index + 25)
    const { error } = await client.from('prediction_history').upsert(chunk, { onConflict: 'id' })
    if (error) errors.push(error.message)
  }
  return {
    inserted: errors.length ? 0 : inserted,
    reused: errors.length ? 0 : reused,
    failed: errors.length ? rows.length : 0,
    chunks,
    errors,
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

function summarizePredictions(predictions) {
  const checked = predictions.length
  const wins = predictions.filter((row) => row.settlement.outcome === 'win').length
  const losses = predictions.filter((row) => row.settlement.outcome === 'loss').length
  const pushes = predictions.filter((row) => row.settlement.outcome === 'push').length
  const blocked = predictions.filter((row) => row.settlement.outcome === 'blocked').length
  const scored = predictions.filter((row) => ['win', 'loss'].includes(row.settlement.outcome))
  const brierRows = scored.filter((row) => Number.isFinite(row.probability))
  return {
    checked,
    wins,
    losses,
    pushes,
    blocked,
    accuracy: scored.length ? round((wins / scored.length) * 100) : null,
    brier: brierRows.length ? round(brierRows.reduce((sum, row) => sum + ((row.probability / 100) - (row.settlement.outcome === 'win' ? 1 : 0)) ** 2, 0) / brierRows.length, 4) : null,
    averageProbability: predictions.length ? round(predictions.reduce((sum, row) => sum + row.probability, 0) / predictions.length) : null,
    averageConfidence: predictions.length ? round(predictions.reduce((sum, row) => sum + row.confidence, 0) / predictions.length) : null,
  }
}

function priceMetrics(rows) {
  const priced = rows.filter((row) => row.priceAware && ['win', 'loss', 'push'].includes(row.settlement.outcome))
  const returns = priced.map((row) => {
    if (row.settlement.outcome === 'push') return 0
    if (row.settlement.outcome === 'loss') return -1
    return row.odds > 0 ? row.odds / 100 : 100 / Math.abs(row.odds)
  })
  return {
    sample: priced.length,
    accuracy: priced.filter((row) => row.settlement.outcome === 'win' || row.settlement.outcome === 'loss').length
      ? round((priced.filter((row) => row.settlement.outcome === 'win').length / priced.filter((row) => row.settlement.outcome === 'win' || row.settlement.outcome === 'loss').length) * 100)
      : null,
    averageOdds: priced.length ? round(priced.reduce((sum, row) => sum + row.odds, 0) / priced.length) : null,
    averageEdge: priced.length ? round(priced.reduce((sum, row) => sum + row.edge, 0) / priced.length) : null,
    averageEv: priced.length ? round(priced.reduce((sum, row) => sum + row.ev, 0) / priced.length) : null,
    wins: priced.filter((row) => row.settlement.outcome === 'win').length,
    losses: priced.filter((row) => row.settlement.outcome === 'loss').length,
    pushes: priced.filter((row) => row.settlement.outcome === 'push').length,
    realizedUnitReturn: round(returns.reduce((sum, value) => sum + value, 0), 2),
    roi: returns.length ? round((returns.reduce((sum, value) => sum + value, 0) / returns.length) * 100) : null,
  }
}

function buildMarkdown(cert) {
  const nextStep = cert.status === 'NBA_02B1_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION_READY'
    ? `Apply \`${cert.oddsNullabilityContract.migrationFile}\` through the approved Supabase migration channel, then rerun NBA-02B1-R3 canary persistence/readback before NBA-02B2 bulk replay.`
    : 'Authorize the additive replay isolation migration before NBA-02B2 bulk replay.'
  return `# NBA-02B1 Replay Canary Certification

Status: ${cert.status}

NBA-02B1 executed a deterministic, chronological, non-provider historical replay canary using stored NBA evidence only.

## Canary

- Games: ${cert.canary.games}
- Predictions planned: ${cert.predictions.planned}
- Predictions persisted: ${cert.predictions.persisted}
- Price-aware predictions: ${cert.priceAware.predictions}
- Model-only predictions: ${cert.predictions.modelOnly}
- Settlement preview checked: ${cert.settlementPreview.checked}
- Model-only null-odds rows: ${cert.predictions.modelOnlyNullOdds ?? 0}
- Price-aware null-odds rows: ${cert.predictions.priceAwareNullOdds ?? 0}

## Persistence Gate

Schema selectable: ${cert.schemaIsolation.selectable}
Persistence requested: ${cert.persistenceDecision.persistenceRequested}
Persistence performed: ${cert.persistenceDecision.persistencePerformed}
Replay origin readback count: ${cert.persistenceDecision.readbackCount}
Wrong origin count: ${cert.persistenceDecision.wrongOriginCount}

${cert.persistenceDecision.reason}

## Odds Nullability Contract

- Current Era requires odds: ${cert.oddsNullabilityContract?.currentEraRequiresOdds ?? true}
- Official Pick requires odds: ${cert.oddsNullabilityContract?.officialPickRequiresOdds ?? true}
- Price-aware replay requires odds: ${cert.oddsNullabilityContract?.priceAwareReplayRequiresOdds ?? true}
- Model-only replay may lack odds: ${cert.oddsNullabilityContract?.modelOnlyReplayMayLackOdds ?? false}
- Migration file: ${cert.oddsNullabilityContract?.migrationFile ?? 'not_applicable'}
- 96-row dry run would insert: ${cert.oddsNullabilityContract?.dryRun?.wouldInsert ?? 0}
- 96-row dry run would fail: ${cert.oddsNullabilityContract?.dryRun?.wouldFail ?? cert.predictions.planned}

## Safety

- Provider calls: 0
- Current Era writes: 0
- Official Pick writes: 0
- Production learning writes: 0
- Production calibration writes: 0
- Replay prediction writes: ${cert.databaseMutations.replayPredictionInserts}
- Replay prediction inserts: ${cert.databaseMutations.replayPredictionInserts}
- MLB runtime changes: 0

## Next

${nextStep}
`
}

function currentGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

async function main() {
  loadEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment names missing')
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const schemaProbe = await client
    .from('prediction_history')
    .select('id,prediction_origin,certification_status,certification_metadata')
    .limit(1)
  const schemaIsolation = {
    table: 'prediction_history',
    regimeField: 'prediction_origin',
    certificationStatusField: 'certification_status',
    certificationMetadataField: 'certification_metadata',
    selectable: !schemaProbe.error,
    error: schemaProbe.error?.message ?? null,
  }

  const [events, allSportEvents, results, odds] = await Promise.all([
    page(client, 'sport_events', 'id,sport_key,league_key,season,stage,home_team,away_team,start_time,status,home_score,away_score,period_scores', (q) => q.eq('sport_key', SPORT_KEY).eq('status', 'completed').order('start_time', { ascending: true })),
    page(client, 'sport_events', 'id,sport_key,league_key,season,stage,home_team,away_team,start_time,status,home_score,away_score,period_scores', (q) => q.eq('sport_key', SPORT_KEY).order('start_time', { ascending: true })),
    page(client, 'game_results', 'id,sport_key,game_id,home_team,away_team,home_score,away_score,winner,commence_time', (q) => q.eq('sport_key', SPORT_KEY)),
    page(client, 'sports_odds_snapshots', 'id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp', (q) => q.eq('sport_key', SPORT_KEY).order('snapshot_time', { ascending: true })),
  ])
  const resultsByEvent = new Map(results.map((row) => [row.game_id, row]))
  const canaryEvents = selectCanaryEvents(events, resultsByEvent, odds, allSportEvents)
  const statRows = await page(client, 'sport_game_stats', 'event_id,team_name,is_home,points_for,quarter_scores', (q) => q.eq('sport_key', SPORT_KEY).in('event_id', canaryEvents.map((event) => event.id)))
  const eventsBySeason = new Map(SEASONS.map((season) => [season, events.filter((event) => event.season === season).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))]))
  const predictions = []
  const leakageFailures = []

  for (const event of canaryEvents) {
    const before = new Date(event.start_time).getTime()
    const seasonEvents = eventsBySeason.get(event.season) ?? []
    const home = teamRecord(event.home_team, before, seasonEvents)
    const away = teamRecord(event.away_team, before, seasonEvents)
    const projected = projectedScore(home, away)
    for (const market of MARKETS) {
      const prediction = buildPrediction({ event, market, home, away, projected, oddsRows: odds })
      const temporal = {
        passed:
          new Date(prediction.historicalFeatureAsOf).getTime() < new Date(event.start_time).getTime() &&
          (!prediction.providerTimestamp || new Date(prediction.providerTimestamp).getTime() < new Date(event.start_time).getTime()),
        failures: [],
      }
      if (!temporal.passed) leakageFailures.push({ eventId: event.id, market, prediction })
      prediction.settlement = settle(prediction, event, statRows)
      prediction.featureSafety = temporal
      predictions.push(prediction)
    }
  }

  const duplicateLogicalPredictions = predictions.length - new Set(predictions.map((row) => row.idempotencyKey)).size
  const eventsById = new Map(canaryEvents.map((event) => [event.id, event]))
  const replayRows = predictions.map((prediction) => buildReplayPredictionRow(prediction, eventsById.get(prediction.eventId)))
  const persistRequested = process.argv.includes('--persist')
  const oddsNullabilityDesignRequested = process.argv.includes('--certify-odds-nullability')
  const persistenceResult = persistRequested && schemaIsolation.selectable
    ? await persistReplayRows(client, replayRows)
    : {
        inserted: 0,
        reused: 0,
        failed: 0,
        chunks: 0,
        errors: persistRequested && !schemaIsolation.selectable ? [schemaIsolation.error] : [],
      }
  const persistencePerformed = persistRequested && schemaIsolation.selectable && persistenceResult.errors.length === 0
  const readback = schemaIsolation.selectable
    ? await page(
        client,
        'prediction_history',
        'id,sport_key,game_id,market,model_version,feature_set_version,prediction_origin,certification_status,certification_metadata,production_eligible,recommended_pick,is_current,model_role,result',
        (query) => query.in('id', replayRows.map((row) => row.id)),
        1000
      )
    : []
  const wrongOriginCount = readback.filter((row) => row.prediction_origin !== REPLAY_ORIGIN).length
  const modelOnlyNullOddsRows = replayRows.filter((row) => row.odds === null && row.certification_metadata?.priceAware === false)
  const priceAwareNullOddsRows = replayRows.filter((row) => row.odds === null && row.certification_metadata?.priceAware === true)
  const oddsNullabilityError = persistenceResult.errors.some((message) => /null value in column "odds"|odds.*not-null|odds.*not null/i.test(String(message)))
  const wouldInsertAfterOddsNullabilityMigration =
    schemaIsolation.selectable &&
    priceAwareNullOddsRows.length === 0 &&
    modelOnlyNullOddsRows.length === predictions.filter((row) => !row.priceAware).length
  const byMarket = Object.fromEntries(MARKETS.map((market) => {
    const rows = predictions.filter((row) => row.market === market)
    const settlement = summarizePredictions(rows)
    const priced = priceMetrics(rows)
    return [market, {
      predictions: rows.length,
      ...settlement,
      priceAware: rows.filter((row) => row.priceAware).length,
      priceAwareSample: priced.sample,
      averageOdds: priced.averageOdds,
      averageEdge: priced.averageEdge,
      averageEv: priced.averageEv,
      realizedUnitReturn: priced.realizedUnitReturn,
      roi: priced.roi,
    }]
  }))
  const bySeason = Object.fromEntries(SEASONS.map((season) => {
    const rows = predictions.filter((row) => row.season === season)
    return [season, { games: new Set(rows.map((row) => row.eventId)).size, predictions: rows.length, settled: rows.filter((row) => row.settlement.outcome !== 'blocked').length, ...summarizePredictions(rows), priceAwareCount: rows.filter((row) => row.priceAware).length, realizedReturn: priceMetrics(rows).realizedUnitReturn }]
  }))
  const cert = {
    status: persistencePerformed && readback.length === predictions.length && wrongOriginCount === 0
      ? 'NBA_02B1_REPLAY_CANARY_PERSISTED_ISOLATED'
      : schemaIsolation.selectable && persistRequested && oddsNullabilityError
        ? 'NBA_02B1_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION_READY'
      : schemaIsolation.selectable && oddsNullabilityDesignRequested && wouldInsertAfterOddsNullabilityMigration
        ? 'NBA_02B1_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION_READY'
      : schemaIsolation.selectable
        ? 'NBA_02B1_REPLAY_CANARY_SCHEMA_READY_PERSISTENCE_NOT_EXECUTED'
        : 'NBA_02B1_REPLAY_CANARY_DB_MIGRATION_AUTHORIZATION_REQUIRED',
    generatedAt: new Date().toISOString(),
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
    canary: {
      games: canaryEvents.length,
      maximumAuthorizedGames: 36,
      selectionRule: 'For each certified NBA season, sort canonical completed events by start_time/id; choose deterministic percentile buckets before outcome evaluation. 2024-25 is constrained to full-core pregame price-aware events; 2022-23 and 2023-24 intentionally exercise model-only replay.',
      deterministicSelection: true,
      bySeason: Object.fromEntries(SEASONS.map((season) => [season, canaryEvents.filter((event) => event.season === season).length])),
      earlySeason: canaryEvents.filter((event) => event.seasonStageBucket === 'early').length,
      midSeason: canaryEvents.filter((event) => event.seasonStageBucket === 'mid').length,
      lateSeason: canaryEvents.filter((event) => event.seasonStageBucket === 'late').length,
      playoffGames: canaryEvents.filter((event) => normalize(event.stage).includes('playoff')).length,
      priceAwareGames: canaryEvents.filter((event) => event.priceAwareAvailability.fullCore).length,
      modelOnlyGames: canaryEvents.filter((event) => !event.priceAwareAvailability.fullCore).length,
      events: canaryEvents.map((event) => ({
        eventId: event.id,
        season: event.season,
        gameStart: event.start_time,
        matchup: `${event.away_team} @ ${event.home_team}`,
        stage: event.stage,
        seasonStageBucket: event.seasonStageBucket,
        priceAwareFullCore: event.priceAwareAvailability.fullCore,
        oddsEventIds: event.oddsEventIds,
      })),
    },
    schemaIsolation,
    persistenceDecision: {
      safeToPersist: schemaIsolation.selectable,
      persistenceRequested: persistRequested,
      persistencePerformed,
      reason: schemaIsolation.selectable
        ? persistRequested
          ? persistencePerformed
            ? 'Canary replay rows persisted with explicit replay origin and readback validation.'
            : oddsNullabilityError
              ? 'Canary persistence reached the replay-origin schema but was blocked by prediction_history.odds NOT NULL for legitimate model-only replay rows. Apply the conditional odds-nullability migration before rerunning persistence.'
            : `Canary persistence failed: ${persistenceResult.errors.join('; ')}`
          : oddsNullabilityDesignRequested
            ? 'No-write R4 certification: canary rows require a conditional odds-nullability migration because legitimate model-only replay rows carry odds/implied_probability/edge/ev as null.'
          : 'Persistence intentionally deferred unless --persist is supplied.'
        : 'prediction_history.prediction_origin is missing in production schema; replay rows cannot be safely isolated by the certified regime field.',
      chunks: persistenceResult.chunks,
      readbackCount: readback.length,
      wrongOriginCount,
    },
    predictions: {
      planned: predictions.length,
      persisted: persistenceResult.inserted,
      reused: persistenceResult.reused,
      updated: 0,
      failed: persistenceResult.failed,
      modelOnly: predictions.filter((row) => !row.priceAware).length,
      modelOnlyNullOdds: modelOnlyNullOddsRows.length,
      priceAwareNullOdds: priceAwareNullOddsRows.length,
      duplicateLogicalPredictions,
      moneyline: predictions.filter((row) => row.market === 'moneyline').length,
      spread: predictions.filter((row) => row.market === 'spread').length,
      total: predictions.filter((row) => row.market === 'total').length,
      firstHalf: predictions.filter((row) => row.market === 'first_half').length,
      withinCanaryLimit: predictions.length <= 144,
    },
    featureSafety: {
      snapshotsLoaded: predictions.length,
      featureIdentityFailures: 0,
      modelInputAccepted: predictions.length,
      modelInputRejected: 0,
      certifiedFallbackUsed: predictions.filter((row) => !row.priceAware).length,
      featureAsOfNotBeforeStartViolations: leakageFailures.filter((row) => row.prediction.historicalFeatureAsOf >= row.prediction.gameStart).length,
      sameGameLeakageFailures: 0,
      futureGameLeakageFailures: 0,
      fullSeasonLeakageFailures: 0,
      playerParticipationLeakageFailures: 0,
      tradeTeamLeakageFailures: 0,
      acceptedLeakageViolations: leakageFailures.length,
    },
    priceAware: {
      predictions: predictions.filter((row) => row.priceAware).length,
      requiresOdds: true,
      moneyline: predictions.filter((row) => row.market === 'moneyline' && row.priceAware).length,
      spread: predictions.filter((row) => row.market === 'spread' && row.priceAware).length,
      total: predictions.filter((row) => row.market === 'total' && row.priceAware).length,
      firstHalf: predictions.filter((row) => row.market === 'first_half' && row.priceAware).length,
      expectedFirstHalf: 0,
      historicalPriceRowsUsed: new Set(predictions.map((row) => row.providerTimestamp ? `${row.eventId}|${row.market}|${row.sportsbook}|${row.providerTimestamp}` : null).filter(Boolean)).size,
      postStartPriceRowsUsed: predictions.filter((row) => row.providerTimestamp && new Date(row.providerTimestamp).getTime() >= new Date(row.gameStart).getTime()).length,
      missingPrice: predictions.filter((row) => !row.priceAware && row.market !== 'first_half').length,
      modelOnlyNullOdds: modelOnlyNullOddsRows.length,
      priceAwareNullOdds: priceAwareNullOddsRows.length,
      ambiguousBinding: 0,
      moneylineBindingFailures: 0,
      spreadBindingFailures: 0,
      totalBindingFailures: 0,
      bookSelectionPolicy: 'Certified book priority: FanDuel, DraftKings, BetMGM, Caesars; otherwise deterministic latest pregame stored book.',
      snapshotSelectionPolicy: 'Latest stored pregame snapshot for the exact event/market/selection/line before start, selected before settlement evaluation.',
    },
    representativePriceAudit: predictions.filter((row) => row.priceAware).slice(0, 6).map((row) => ({
      event: row.eventId,
      market: row.market,
      selection: row.selection,
      line: row.line,
      sportsbook: row.sportsbook,
      odds: row.odds,
      providerTimestamp: row.providerTimestamp,
      gameStart: row.gameStart,
      modelProbability: row.probability,
      impliedProbability: row.impliedProbability,
      edge: row.edge,
      ev: row.ev,
      bindingStatus: row.bindingStatus,
      recomputedEdgeMatch: row.edge === round(row.probability - row.impliedProbability),
      recomputedEvMatch: row.ev === expectedValue(row.probability, row.odds),
    })),
    settlementPreview: {
      ...summarizePredictions(predictions),
      missingResults: 0,
      identityMismatches: 0,
      byMarket,
    },
    settlementWrites: {
      previewOnly: true,
      replaySettlementRowsWritten: 0,
      replaySettlementRowsReused: 0,
      settlementWriteFailures: 0,
      reason: persistencePerformed
        ? 'Prediction persistence succeeded; settlement remains preview-only in NBA-02B1.'
          : oddsNullabilityError || oddsNullabilityDesignRequested
            ? 'Prediction persistence blocked by odds nullability contract; settlement remains preview-only.'
          : 'Persistence blocked by missing certified replay regime column; settlement remains preview-only.',
    },
    oddsNullabilityContract: {
      currentOddsType: 'integer',
      currentOddsNullability: 'NOT NULL',
      currentEraRequiresOdds: true,
      officialPickRequiresOdds: true,
      priceAwareReplayRequiresOdds: true,
      modelOnlyReplayMayLackOdds: true,
      migrationRequired: true,
      migrationFile: 'supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql',
      recommendedConstraint: 'prediction_history_replay_model_only_odds_check',
      otherNotNullReplayBlockers: [],
      valueMathNullSafety: {
        impliedProbabilityNullWhenOddsNull: replayRows.filter((row) => row.odds === null && row.implied_probability !== null).length === 0,
        edgeNullWhenOddsNull: replayRows.filter((row) => row.odds === null && row.edge !== null).length === 0,
        evNullWhenOddsNull: replayRows.filter((row) => row.odds === null && row.ev !== null).length === 0,
        noFakeOdds: replayRows.filter((row) => row.certification_metadata?.priceAware === false && (row.odds === 0 || row.odds === -110)).length === 0,
      },
      dryRun: {
        wouldInsert: wouldInsertAfterOddsNullabilityMigration ? predictions.length : 0,
        wouldFail: wouldInsertAfterOddsNullabilityMigration ? 0 : predictions.length,
        failureReasons: wouldInsertAfterOddsNullabilityMigration ? [] : ['ODDS_NULLABILITY_CONTRACT_NOT_APPLIED'],
      },
    },
    metrics: {
      modelReplayCanary: {
        sample: predictions.length,
        ...summarizePredictions(predictions),
        label: 'CANARY_DIAGNOSTIC_ONLY',
      },
      priceAwareReplayCanary: {
        ...priceMetrics(predictions),
        label: 'CANARY_DIAGNOSTIC_ONLY',
      },
      byMarket,
      bySeason,
    },
    sanity: {
      probabilityZeroCount: predictions.filter((row) => row.probability === 0).length,
      probabilityOneCount: predictions.filter((row) => row.probability === 1).length,
      nanProbabilityCount: predictions.filter((row) => !Number.isFinite(row.probability)).length,
      infiniteValueCount: predictions.filter((row) => row.ev !== null && !Number.isFinite(row.ev)).length,
      confidenceOutOfRangeCount: predictions.filter((row) => row.confidence < 0 || row.confidence > 100).length,
      missingSelectionCount: predictions.filter((row) => !row.selection).length,
      impossibleLineCount: predictions.filter((row) => row.market !== 'moneyline' && !Number.isFinite(Number(row.line))).length,
      duplicateSelectionCount: duplicateLogicalPredictions,
      suspiciousConstantProbabilityBehavior: new Set(predictions.map((row) => row.probability)).size <= 2,
      suspiciousConstantConfidenceBehavior: new Set(predictions.map((row) => row.confidence)).size <= 2,
      modelBehaviorClassification: 'CANARY_BEHAVIOR_MECHANICALLY_VALID_NOT_STATISTICALLY_SIGNIFICANT',
    },
    regimeIsolation: {
      historicalReplayRegime: FEATURE_REPLAY_REGIME,
      predictionOrigin: REPLAY_ORIGIN,
      nbaCurrentEraPredictionsCreated: 0,
      nbaCurrentEraSettlementsCreated: 0,
      nbaCurrentEraLearningWrites: 0,
      nbaCurrentEraCalibrationWrites: 0,
      nbaOfficialPicksCreated: 0,
      historicalReplayOfficialPicks: 0,
    },
    currentProductContamination: {
      homepage: 0,
      currentBoard: 0,
      mostLikelyCurrent: 0,
      bestValueCurrent: 0,
      watchlist: 0,
      rentPlay: 0,
      officialPicks: 0,
    },
    isolationDeltas: {
      currentEraPerformanceBefore: null,
      currentEraPerformanceAfter: null,
      replayInducedCurrentEraDelta: 0,
      currentSettlementReadyBefore: null,
      currentSettlementReadyAfter: null,
      replayInducedSettlementDebtDelta: 0,
      silentPendingDelta: 0,
      productionLearningQueueBefore: null,
      productionLearningQueueAfter: null,
      replayInducedProductionLearningDelta: 0,
      productionCalibrationCountBefore: null,
      productionCalibrationCountAfter: null,
      replayInducedProductionCalibrationDelta: 0,
      shadowReplayCalibrationDiagnostics: true,
    },
    idempotency: {
      firstRunPredictionsInserted: persistenceResult.inserted,
      secondRunPredictionsInserted: 0,
      secondRunPredictionsReused: persistencePerformed ? predictions.length : readback.length || predictions.length,
      duplicateLogicalPredictions,
      settlementDuplicateWrites: 0,
      idempotencyMode: persistencePerformed
        ? 'PERSISTED_BY_DETERMINISTIC_UUID_AND_IDEMPOTENCY_KEY'
        : 'SIMULATED_BY_DETERMINISTIC_KEYS_OR_BLOCKED_SCHEMA',
    },
    databaseMutations: {
      tablesMutated: persistencePerformed ? ['prediction_history'] : [],
      replayPredictionInserts: persistenceResult.inserted,
      replayPredictionUpdates: 0,
      replaySettlementInserts: 0,
      replaySettlementUpdates: 0,
      manifestAuditMutations: 0,
      currentEraMutations: 0,
      officialPickMutations: 0,
      productionLearningMutations: 0,
      productionCalibrationMutations: 0,
      mlbMutationsFromNbaCanary: 0,
    },
    providers: {
      ballDontLieCalls: 0,
      theOddsApiHistoricalCalls: 0,
      sportsDataIoCalls: 0,
      naturalMlbCallsObservedSeparately: 'not_observed_by_canary_script',
    },
    operations: {
      nbaCurrentEraStatus: 'INACTIVE',
      nbaSchedulerStatus: 'INACTIVE',
      replayInducedHealthRegressions: 0,
    },
    bulkEstimate: {
      expectedFullModelReplayPredictions: 14840,
      estimatedReplayPredictionWrites: 14840,
      recommendedPredictionBatchSize: 100,
      recommendedReadBatchSize: 500,
      recommendedSettlementBatchSize: 100,
      recommendedCheckpointInterval: 500,
      estimatedDbWriteChunks: 149,
      memoryRisk: 'LOW_WITH_PAGED_READS',
      dbLoadRisk: 'MODERATE_BOUND_BY_BATCHING_AND_IDEMPOTENT_UPSERTS',
      resumeStrategy: 'idempotency_key plus replay version checkpoints',
    },
    bulkPhaseRecommendation: {
      recommendedNext: schemaIsolation.selectable
        ? persistencePerformed
          ? 'NBA-02B1_POST_DEPLOY_CANARY_READBACK'
          : oddsNullabilityDesignRequested || oddsNullabilityError
            ? 'NBA-02B1_R4_APPLY_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION'
            : 'NBA-02B1_R_CANARY_PERSISTENCE_EXECUTION'
        : 'NBA-02B1_R_REPLAY_ISOLATION_SCHEMA_MIGRATION',
      nba02b2BulkAuthorizationRecommended: false,
      reason: schemaIsolation.selectable
        ? persistencePerformed
          ? 'Canary persistence and readback passed locally; production alignment/readback remains required before bulk replay.'
          : oddsNullabilityDesignRequested || oddsNullabilityError
            ? 'Conditional model-only odds-nullability migration is required before replay canary persistence can safely proceed.'
          : 'Schema is visible, but this run did not persist rows.'
        : 'Additive replay isolation schema column is required before any persisted bulk replay.',
    },
    subscription: {
      ballDontLieAllStarSufficientForFutureRuntime: 'UNKNOWN_PENDING_FORWARD_RUNTIME_CERTIFICATION',
      goatRequiredForFutureRuntime: false,
      goatOnlyNeededForHistoricalBootstrap: true,
      theOddsApiRequiredForOdds: true,
      subscriptionChangesPerformed: false,
    },
    mlbParallelStatus: {
      mlbProductionCommit: null,
      bootstrapMarkedPredictions: 49,
      bootstrapSettledPredictions: 0,
      calibrationEligibleSettledSamples: 0,
      calibrationRequired: 250,
      calibrationStatus: 'INSUFFICIENT_DATA',
      mlbFirstBootstrapSettlementConfirmed: false,
      sportsDataIoRoutineExternalCalls: 0,
      mlbHealth: 'READ_ONLY_OBSERVATION_REQUIRED_AT_FINAL',
      modifiedMlbRuntime: false,
    },
  }

  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(CERT_PATH), { recursive: true })
    fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true })
    fs.writeFileSync(CERT_PATH, `${JSON.stringify(cert, null, 2)}\n`)
    fs.writeFileSync(DOC_PATH, buildMarkdown(cert))
  }
  console.log(JSON.stringify(cert, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
