import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard, type CurrentBoardCandidate, type CurrentBoardResponse } from '@/services/current-board.service'
import {
  PICK_EDGE_CONSUMER_CONTRACT_VERSION,
  type ConsumerBookQuote,
  type ConsumerEnvelope,
  type ConsumerFreshness,
  type ConsumerGame,
  type ConsumerGameStatus,
  type ConsumerHealth,
  type ConsumerMainLine,
  type ConsumerMarketFamily,
  type ConsumerMeta,
  type ConsumerOpportunity,
  type ConsumerRecommendationMetadata,
  type ConsumerSort,
  type ConsumerStarter,
  type ConsumerTeamRef,
} from '@/types/pick-edge-consumer-v1'

const TIMEZONE = 'America/Puerto_Rico' as const
const WATCH_STATUSES = new Set(['WATCH', 'QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'])

const MLB_TEAMS: Record<number, { name: string; abbreviation: string }> = {
  108: { name: 'Los Angeles Angels', abbreviation: 'LAA' },
  109: { name: 'Arizona Diamondbacks', abbreviation: 'ARI' },
  110: { name: 'Baltimore Orioles', abbreviation: 'BAL' },
  111: { name: 'Boston Red Sox', abbreviation: 'BOS' },
  112: { name: 'Chicago Cubs', abbreviation: 'CHC' },
  113: { name: 'Cincinnati Reds', abbreviation: 'CIN' },
  114: { name: 'Cleveland Guardians', abbreviation: 'CLE' },
  115: { name: 'Colorado Rockies', abbreviation: 'COL' },
  116: { name: 'Detroit Tigers', abbreviation: 'DET' },
  117: { name: 'Houston Astros', abbreviation: 'HOU' },
  118: { name: 'Kansas City Royals', abbreviation: 'KC' },
  119: { name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
  120: { name: 'Washington Nationals', abbreviation: 'WSH' },
  121: { name: 'New York Mets', abbreviation: 'NYM' },
  133: { name: 'Athletics', abbreviation: 'ATH' },
  134: { name: 'Pittsburgh Pirates', abbreviation: 'PIT' },
  135: { name: 'San Diego Padres', abbreviation: 'SD' },
  136: { name: 'Seattle Mariners', abbreviation: 'SEA' },
  137: { name: 'San Francisco Giants', abbreviation: 'SF' },
  138: { name: 'St. Louis Cardinals', abbreviation: 'STL' },
  139: { name: 'Tampa Bay Rays', abbreviation: 'TB' },
  140: { name: 'Texas Rangers', abbreviation: 'TEX' },
  141: { name: 'Toronto Blue Jays', abbreviation: 'TOR' },
  142: { name: 'Minnesota Twins', abbreviation: 'MIN' },
  143: { name: 'Philadelphia Phillies', abbreviation: 'PHI' },
  144: { name: 'Atlanta Braves', abbreviation: 'ATL' },
  145: { name: 'Chicago White Sox', abbreviation: 'CWS' },
  146: { name: 'Miami Marlins', abbreviation: 'MIA' },
  147: { name: 'New York Yankees', abbreviation: 'NYY' },
  158: { name: 'Milwaukee Brewers', abbreviation: 'MIL' },
}

type CanonicalGameRow = {
  game_pk: number
  game_date: string
  scheduled_at: string | null
  official_status: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type SportEventRow = {
  id: string
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
}

type OddsRow = {
  id: string
  event_id: string
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  provider_timestamp: string | null
}

type OfficialPickRow = {
  official_pick_identity: string
  game_pk: number
  market: string
  side: string
  bookmaker_key: string | null
  bookmaker_name: string | null
  american_odds: number | null
  model_version: string | null
  model_probability: number | string | null
  consensus_probability: number | string | null
  consensus_edge: number | string | null
  unit_ev: number | string | null
  decision_status: string | null
  reason_codes: unknown
  risk_flags: unknown
  prediction_as_of: string | null
  market_acquired_at: string | null
  decision_at: string | null
}

type GameContext = {
  gamePk: number
  row: CanonicalGameRow
  event: SportEventRow
  away: ConsumerTeamRef
  home: ConsumerTeamRef
  awayStarter: ConsumerStarter | null
  homeStarter: ConsumerStarter | null
}

type Snapshot = {
  meta: ConsumerMeta
  games: ConsumerGame[]
  opportunities: ConsumerOpportunity[]
  health: ConsumerHealth
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function validateConsumerDate(value: string | null | undefined) {
  const date = value ?? localToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`INVALID_CONSUMER_DATE:${date}`)
  return date
}

function normalizeAbbreviation(value: string | null | undefined) {
  const upper = String(value ?? '').trim().toUpperCase()
  if (upper === 'CHW') return 'CWS'
  if (upper === 'OAK') return 'ATH'
  return upper
}

function isoMinute(value: string | null | undefined) {
  if (!value) return ''
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return ''
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString()
}

function gameKey(start: string | null, away: string | null, home: string | null) {
  return `${isoMinute(start)}|${normalizeAbbreviation(away)}|${normalizeAbbreviation(home)}`
}

function teamId(metadata: Record<string, unknown>, side: 'away' | 'home') {
  const direct = asNumber(metadata[`${side}MlbTeamId`])
  if (direct !== null) return Math.round(direct)
  const identity = asRecord(metadata.mlb_official_identity)
  const nested = asNumber(identity[`${side}_mlb_team_id`])
  return nested === null ? null : Math.round(nested)
}

function teamRef(mlbTeamId: number | null, fallback: string | null): ConsumerTeamRef {
  const known = mlbTeamId === null ? null : MLB_TEAMS[mlbTeamId]
  const abbreviation = known?.abbreviation ?? (normalizeAbbreviation(fallback) || null)
  return {
    id: mlbTeamId === null ? null : `mlb:${mlbTeamId}`,
    mlbTeamId,
    name: known?.name ?? abbreviation ?? 'Unknown team',
    abbreviation,
    logoUrl: null,
  }
}

function starter(metadata: Record<string, unknown>, side: 'away' | 'home', observedAt: string | null): ConsumerStarter | null {
  const pitcher = asRecord(metadata[`${side}ProbablePitcher`])
  const id = asNumber(pitcher.id)
  const name = typeof pitcher.fullName === 'string' ? pitcher.fullName.trim() : ''
  if (id === null && !name) return null
  return {
    player: {
      id: id === null ? null : `mlbam:${Math.round(id)}`,
      mlbamPersonId: id === null ? null : Math.round(id),
      name: name || 'Probable starter',
      teamId: null,
    },
    status: 'PROBABLE',
    confidence: null,
    observedAt,
  }
}

function gameStatus(value: string | null | undefined): ConsumerGameStatus {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.includes('final') || normalized.includes('complete')) return 'FINAL'
  if (normalized.includes('live') || normalized.includes('progress')) return 'LIVE'
  if (normalized.includes('postpon')) return 'POSTPONED'
  if (normalized.includes('cancel')) return 'CANCELLED'
  if (normalized.includes('preview') || normalized.includes('pregame')) return 'PREGAME'
  if (normalized.includes('scheduled')) return 'SCHEDULED'
  return 'UNKNOWN'
}

function freshness(board: CurrentBoardResponse): ConsumerFreshness {
  if (board.dataFreshness.status === 'fresh') return 'FRESH'
  if (board.dataFreshness.status === 'partial') return 'AGING'
  if (board.dataFreshness.status === 'stale') return 'STALE'
  return 'UNKNOWN'
}

function family(market: string | null | undefined): ConsumerMarketFamily {
  const value = String(market ?? '').toLowerCase()
  if (value === 'moneyline') return 'MONEYLINE'
  if (value === 'spread' || value === 'run_line') return 'RUN_LINE'
  if (value === 'total') return 'TOTAL'
  return value.toUpperCase() || 'UNKNOWN'
}

function familyMarket(value: ConsumerMarketFamily) {
  if (value === 'MONEYLINE') return 'moneyline'
  if (value === 'RUN_LINE') return 'spread'
  if (value === 'TOTAL') return 'total'
  return String(value).toLowerCase()
}

function confidenceTier(value: number | null): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRATED' {
  if (value === null) return 'UNRATED'
  if (value >= 70) return 'HIGH'
  if (value >= 55) return 'MEDIUM'
  return 'LOW'
}

function impliedProbability(odds: number | null) {
  if (odds === null || odds === 0) return null
  return odds < 0 ? (-odds / (-odds + 100)) * 100 : (100 / (odds + 100)) * 100
}

function fairOdds(probabilityPercent: number | null) {
  if (probabilityPercent === null || probabilityPercent <= 0 || probabilityPercent >= 100) return null
  const p = probabilityPercent / 100
  return Math.round(p >= 0.5 ? (-100 * p) / (1 - p) : (100 * (1 - p)) / p)
}

function candidateSide(candidate: CurrentBoardCandidate, game: GameContext): 'HOME' | 'AWAY' | 'OVER' | 'UNDER' | null {
  const selection = String(candidate.canonicalOutcome?.selection ?? candidate.selection ?? '').toUpperCase()
  const home = game.home.abbreviation ?? ''
  const away = game.away.abbreviation ?? ''
  if (home && (selection === home || selection.includes(`${home} `))) return 'HOME'
  if (away && (selection === away || selection.includes(`${away} `))) return 'AWAY'
  if (selection.includes('OVER')) return 'OVER'
  if (selection.includes('UNDER')) return 'UNDER'
  return null
}

function officialKey(gamePk: number, market: string, side: string) {
  return `${gamePk}|${market.toUpperCase()}|${side.toUpperCase()}`
}

function recommendation(candidate: CurrentBoardCandidate, official: OfficialPickRow | null): ConsumerRecommendationMetadata {
  const status = official
    ? 'RECOMMENDED'
    : WATCH_STATUSES.has(candidate.recommendationPolicyStatus)
      ? 'WATCH'
      : 'NO_PLAY'
  return {
    status,
    label: status === 'RECOMMENDED' ? 'Official Pick' : status === 'WATCH' ? 'Value Watch' : 'Analysis Only',
    confidenceTier: confidenceTier(asNumber(candidate.confidence)),
    confidenceScore: asNumber(candidate.confidence),
    reasonCodes: official ? stringArray(official.reason_codes) : [],
    riskFlags: official ? stringArray(official.risk_flags) : candidate.blockers.map(String),
    explanation: candidate.summary || candidate.canonicalReason || 'Pick Analyzer model output.',
    productAction: 'ANALYSIS_ONLY',
  }
}

function quote(row: OddsRow, status: ConsumerFreshness, best = false): ConsumerBookQuote {
  const price = asNumber(row.price)
  return {
    quoteId: row.id,
    bookKey: String(row.sportsbook ?? 'unknown').toLowerCase(),
    bookName: row.sportsbook ?? 'Unknown book',
    line: asNumber(row.line),
    americanOdds: price,
    impliedProbability: impliedProbability(price),
    noVigProbability: null,
    acquiredAt: row.snapshot_time,
    providerLastUpdate: row.provider_timestamp,
    freshness: status,
    isBestPrice: best,
  }
}

function fallbackQuote(candidate: CurrentBoardCandidate, status: ConsumerFreshness): ConsumerBookQuote | null {
  const price = asNumber(candidate.canonicalPrice?.americanOdds ?? candidate.americanOdds)
  if (price === null) return null
  return {
    quoteId: candidate.canonicalPrice?.oddsSnapshotId ?? candidate.oddsSnapshotId,
    bookKey: String(candidate.canonicalPrice?.sportsbook ?? candidate.sportsbook ?? 'unknown').toLowerCase(),
    bookName: candidate.canonicalPrice?.sportsbook ?? candidate.sportsbook ?? 'Unknown book',
    line: asNumber(candidate.canonicalOutcome?.line ?? candidate.line),
    americanOdds: price,
    impliedProbability: asNumber(candidate.canonicalPrice?.impliedProbability ?? candidate.impliedProbability),
    noVigProbability: null,
    acquiredAt: candidate.canonicalPrice?.timestamp ?? candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp,
    providerLastUpdate: candidate.providerSourceUpdatedAt,
    freshness: status,
    isBestPrice: true,
  }
}

function exactQuotes(candidate: CurrentBoardCandidate, game: GameContext, odds: OddsRow[], status: ConsumerFreshness) {
  const marketFamily = family(candidate.market)
  const market = familyMarket(marketFamily)
  const side = candidateSide(candidate, game)
  if (!side || !['moneyline', 'spread', 'total'].includes(market)) {
    const fallback = fallbackQuote(candidate, status)
    return fallback ? [fallback] : []
  }
  const wantedLine = asNumber(candidate.canonicalOutcome?.line ?? candidate.line)
  const perBook = new Map<string, OddsRow>()
  for (const row of odds) {
    if (row.event_id !== game.event.id) continue
    if (String(row.market ?? '').toLowerCase() !== market) continue
    if (String(row.outcome ?? '').toUpperCase() !== side) continue
    if ((market === 'spread' || market === 'total') && wantedLine !== null && asNumber(row.line) !== wantedLine) continue
    const book = String(row.sportsbook ?? 'unknown').toLowerCase()
    if (!perBook.has(book)) perBook.set(book, row)
  }
  const rows = [...perBook.values()].sort((a, b) => (asNumber(b.price) ?? -Infinity) - (asNumber(a.price) ?? -Infinity))
  if (!rows.length) {
    const fallback = fallbackQuote(candidate, status)
    return fallback ? [fallback] : []
  }
  return rows.map((row, index) => quote(row, status, index === 0))
}

function officialQuote(row: OfficialPickRow, line: number | null, status: ConsumerFreshness): ConsumerBookQuote {
  const odds = asNumber(row.american_odds)
  return {
    quoteId: row.official_pick_identity,
    bookKey: String(row.bookmaker_key ?? row.bookmaker_name ?? 'unknown').toLowerCase(),
    bookName: row.bookmaker_name ?? row.bookmaker_key ?? 'Unknown book',
    line,
    americanOdds: odds,
    impliedProbability: impliedProbability(odds),
    noVigProbability: asNumber(row.consensus_probability) === null ? null : asNumber(row.consensus_probability)! * 100,
    acquiredAt: row.market_acquired_at,
    providerLastUpdate: row.market_acquired_at,
    freshness: status,
    isBestPrice: true,
  }
}

function opportunity(
  candidate: CurrentBoardCandidate,
  game: GameContext,
  odds: OddsRow[],
  officials: Map<string, OfficialPickRow>,
  status: ConsumerFreshness
): ConsumerOpportunity {
  const marketFamily = family(candidate.market)
  const side = candidateSide(candidate, game)
  const official = side ? officials.get(officialKey(game.gamePk, marketFamily, side)) ?? null : null
  const quotes = exactQuotes(candidate, game, odds, status)
  const line = asNumber(candidate.canonicalOutcome?.line ?? candidate.line)
  const bestQuote = official ? officialQuote(official, line, status) : (quotes[0] ?? fallbackQuote(candidate, status))
  const selectedTeam = side === 'HOME' ? game.home : side === 'AWAY' ? game.away : null
  const modelProbability = asNumber(candidate.canonicalOutcome?.probability ?? candidate.modelProbability)
  return {
    opportunityId: candidate.predictionId,
    sport: 'MLB',
    gamePk: game.gamePk,
    family: marketFamily,
    market: candidate.marketLabel || String(candidate.market),
    subjectType: selectedTeam ? 'TEAM' : 'GAME',
    subjectId: selectedTeam?.id ?? null,
    subjectName: selectedTeam?.name ?? candidate.matchup,
    selection: String(candidate.canonicalOutcome?.selection ?? candidate.selection),
    line,
    projection: {
      value: null,
      unit: null,
      modelVersion: candidate.modelVersion ?? null,
      generatedAt: candidate.predictionGeneratedAt ?? null,
    },
    modelProbability,
    impliedProbability: bestQuote?.impliedProbability ?? asNumber(candidate.impliedProbability),
    noVigProbability: official && asNumber(official.consensus_probability) !== null ? asNumber(official.consensus_probability)! * 100 : null,
    fairAmericanOdds: fairOdds(modelProbability),
    edge: official && asNumber(official.consensus_edge) !== null
      ? asNumber(official.consensus_edge)! * 100
      : asNumber(candidate.canonicalEv?.actionableEdge ?? candidate.edgePercentagePoints ?? candidate.edge),
    expectedValue: official && asNumber(official.unit_ev) !== null
      ? asNumber(official.unit_ev)! * 100
      : asNumber(candidate.canonicalEv?.actionableExpectedValue ?? candidate.expectedValuePercent ?? candidate.expectedValue),
    consensusProbability: official && asNumber(official.consensus_probability) !== null ? asNumber(official.consensus_probability)! * 100 : null,
    consensusEdge: official && asNumber(official.consensus_edge) !== null ? asNumber(official.consensus_edge)! * 100 : null,
    marketDispersion: null,
    bestQuote,
    quotes,
    recommendation: recommendation(candidate, official),
    freshness: candidate.stale ? 'STALE' : status,
    dataAsOf: candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp ?? candidate.predictionGeneratedAt ?? null,
    dataQualityScore: asNumber(candidate.featureQuality),
    sourceLineageAvailable: Boolean(candidate.snapshotId || candidate.oddsSnapshotId),
  }
}

function syntheticOfficial(row: OfficialPickRow, game: GameContext, status: ConsumerFreshness): ConsumerOpportunity | null {
  if (row.market.toUpperCase() !== 'MONEYLINE') return null
  const selectedTeam = row.side.toUpperCase() === 'HOME' ? game.home : row.side.toUpperCase() === 'AWAY' ? game.away : null
  if (!selectedTeam) return null
  const probability = asNumber(row.model_probability)
  const modelProbability = probability === null ? null : probability * 100
  const consensus = asNumber(row.consensus_probability)
  const edge = asNumber(row.consensus_edge)
  const ev = asNumber(row.unit_ev)
  const bestQuote = officialQuote(row, null, status)
  return {
    opportunityId: `official:${row.official_pick_identity}`,
    sport: 'MLB',
    gamePk: game.gamePk,
    family: 'MONEYLINE',
    market: 'Moneyline',
    subjectType: 'TEAM',
    subjectId: selectedTeam.id,
    subjectName: selectedTeam.name,
    selection: selectedTeam.abbreviation ?? selectedTeam.name,
    line: null,
    projection: { value: null, unit: null, modelVersion: row.model_version, generatedAt: row.prediction_as_of },
    modelProbability,
    impliedProbability: bestQuote.impliedProbability,
    noVigProbability: consensus === null ? null : consensus * 100,
    fairAmericanOdds: fairOdds(modelProbability),
    edge: edge === null ? null : edge * 100,
    expectedValue: ev === null ? null : ev * 100,
    consensusProbability: consensus === null ? null : consensus * 100,
    consensusEdge: edge === null ? null : edge * 100,
    marketDispersion: null,
    bestQuote,
    quotes: [bestQuote],
    recommendation: {
      status: 'RECOMMENDED',
      label: 'Official Pick',
      confidenceTier: confidenceTier(modelProbability),
      confidenceScore: modelProbability,
      reasonCodes: stringArray(row.reason_codes),
      riskFlags: stringArray(row.risk_flags),
      explanation: 'Certified Pick Analyzer Policy V1 official recommendation.',
      productAction: 'ANALYSIS_ONLY',
    },
    freshness: status,
    dataAsOf: row.decision_at ?? row.market_acquired_at,
    dataQualityScore: null,
    sourceLineageAvailable: true,
  }
}

function latestQuote(odds: OddsRow[], eventId: string, market: string, outcome: string, status: ConsumerFreshness) {
  const rows = odds.filter((row) =>
    row.event_id === eventId &&
    String(row.market ?? '').toLowerCase() === market &&
    String(row.outcome ?? '').toLowerCase() === outcome
  )
  const selected = rows.find((row) => String(row.sportsbook ?? '').toLowerCase() === 'fanduel') ?? rows[0]
  return selected ? quote(selected, status) : null
}

function mainLines(odds: OddsRow[], eventId: string, status: ConsumerFreshness): ConsumerMainLine[] {
  return [
    {
      family: 'MONEYLINE',
      away: latestQuote(odds, eventId, 'moneyline', 'away', status),
      home: latestQuote(odds, eventId, 'moneyline', 'home', status),
    },
    {
      family: 'RUN_LINE',
      away: latestQuote(odds, eventId, 'spread', 'away', status),
      home: latestQuote(odds, eventId, 'spread', 'home', status),
    },
    {
      family: 'TOTAL',
      away: null,
      home: null,
      over: latestQuote(odds, eventId, 'total', 'over', status),
      under: latestQuote(odds, eventId, 'total', 'under', status),
    },
  ]
}

function sortOpportunities(items: ConsumerOpportunity[], sort: ConsumerSort, gameTimes: Map<number, number>) {
  return [...items].sort((a, b) => {
    if (sort === 'edge') return (b.edge ?? -Infinity) - (a.edge ?? -Infinity)
    if (sort === 'ev') return (b.expectedValue ?? -Infinity) - (a.expectedValue ?? -Infinity)
    if (sort === 'game_time') return (gameTimes.get(a.gamePk) ?? Infinity) - (gameTimes.get(b.gamePk) ?? Infinity)
    return (b.modelProbability ?? -Infinity) - (a.modelProbability ?? -Infinity)
  })
}

async function buildContexts(board: CurrentBoardResponse, date: string) {
  const gameResult = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk, game_date, scheduled_at, official_status, metadata, updated_at')
    .eq('game_date', date)
    .order('scheduled_at', { ascending: true })
  if (gameResult.error) throw new Error(`consumer canonical games read failed: ${gameResult.error.message}`)
  const canonicalRows = (gameResult.data ?? []) as CanonicalGameRow[]

  const eventIds = board.games.map((game) => game.eventId).filter(Boolean)
  let events: SportEventRow[] = []
  if (eventIds.length) {
    const eventResult = await supabaseAdmin
      .from('sport_events')
      .select('id, home_team, away_team, start_time, status')
      .in('id', eventIds)
    if (eventResult.error) throw new Error(`consumer sport events read failed: ${eventResult.error.message}`)
    events = (eventResult.data ?? []) as SportEventRow[]
  }

  const canonicalByKey = new Map<string, CanonicalGameRow>()
  for (const row of canonicalRows) {
    const metadata = asRecord(row.metadata)
    const awayId = teamId(metadata, 'away')
    const homeId = teamId(metadata, 'home')
    canonicalByKey.set(
      gameKey(row.scheduled_at, awayId === null ? null : MLB_TEAMS[awayId]?.abbreviation ?? null, homeId === null ? null : MLB_TEAMS[homeId]?.abbreviation ?? null),
      row
    )
  }

  const byEventId = new Map<string, GameContext>()
  const byGamePk = new Map<number, GameContext>()
  const warnings: string[] = []
  for (const event of events) {
    const row = canonicalByKey.get(gameKey(event.start_time, event.away_team, event.home_team))
    if (!row) {
      warnings.push(`UNMAPPED_CANONICAL_GAME:${event.id}`)
      continue
    }
    const metadata = asRecord(row.metadata)
    const game: GameContext = {
      gamePk: Number(row.game_pk),
      row,
      event,
      away: teamRef(teamId(metadata, 'away'), event.away_team),
      home: teamRef(teamId(metadata, 'home'), event.home_team),
      awayStarter: starter(metadata, 'away', row.updated_at),
      homeStarter: starter(metadata, 'home', row.updated_at),
    }
    byEventId.set(event.id, game)
    byGamePk.set(game.gamePk, game)
  }
  return { canonicalRows, byEventId, byGamePk, warnings }
}

async function readOdds(eventIds: string[]) {
  if (!eventIds.length) return [] as OddsRow[]
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp')
    .in('event_id', eventIds)
    .in('market', ['moneyline', 'spread', 'total'])
    .order('snapshot_time', { ascending: false })
    .limit(2000)
  if (result.error) throw new Error(`consumer odds read failed: ${result.error.message}`)
  return (result.data ?? []) as OddsRow[]
}

async function readOfficialPicks(gamePks: number[]) {
  if (!gamePks.length) return [] as OfficialPickRow[]
  const result = await supabaseAdmin
    .from('pick2_mlb_official_picks')
    .select('official_pick_identity, game_pk, market, side, bookmaker_key, bookmaker_name, american_odds, model_version, model_probability, consensus_probability, consensus_edge, unit_ev, decision_status, reason_codes, risk_flags, prediction_as_of, market_acquired_at, decision_at')
    .in('game_pk', gamePks)
    .eq('decision_status', 'OFFICIAL_PICK')
    .order('decision_at', { ascending: false })
  if (result.error) throw new Error(`consumer official picks read failed: ${result.error.message}`)
  const latest = new Map<string, OfficialPickRow>()
  for (const row of (result.data ?? []) as OfficialPickRow[]) {
    const key = officialKey(Number(row.game_pk), row.market, row.side)
    if (!latest.has(key)) latest.set(key, row)
  }
  return [...latest.values()]
}

export async function buildPickEdgeConsumerSnapshot(dateInput?: string | null): Promise<Snapshot> {
  const date = validateConsumerDate(dateInput)
  const board = await getCurrentBoard({
    sportKey: 'baseball_mlb',
    mode: 'CURRENT',
    limit: 200,
    modelRole: 'champion',
    includeMlbContext: true,
    slateDate: date,
  })
  const status = freshness(board)
  const contexts = await buildContexts(board, date)
  const [odds, officialRows] = await Promise.all([
    readOdds([...contexts.byEventId.keys()]),
    readOfficialPicks([...contexts.byGamePk.keys()]),
  ])
  const officials = new Map<string, OfficialPickRow>()
  for (const row of officialRows) officials.set(officialKey(Number(row.game_pk), row.market, row.side), row)

  const opportunities: ConsumerOpportunity[] = []
  for (const candidate of board.candidates) {
    const game = contexts.byEventId.get(candidate.eventId)
    if (game) opportunities.push(opportunity(candidate, game, odds, officials, status))
  }

  for (const row of officialRows) {
    const game = contexts.byGamePk.get(Number(row.game_pk))
    if (!game) continue
    const side = row.side.toUpperCase()
    const abbreviation = side === 'HOME' ? game.home.abbreviation : side === 'AWAY' ? game.away.abbreviation : null
    const alreadyPresent = opportunities.some((item) =>
      item.gamePk === game.gamePk &&
      item.family === family(row.market) &&
      item.recommendation.status === 'RECOMMENDED' &&
      Boolean(abbreviation && item.selection.toUpperCase().includes(abbreviation))
    )
    if (!alreadyPresent) {
      const item = syntheticOfficial(row, game, status)
      if (item) opportunities.push(item)
    }
  }

  const byGame = new Map<number, ConsumerOpportunity[]>()
  for (const item of opportunities) {
    const items = byGame.get(item.gamePk) ?? []
    items.push(item)
    byGame.set(item.gamePk, items)
  }

  const games: ConsumerGame[] = []
  for (const game of contexts.byGamePk.values()) {
    const ranked = sortOpportunities(byGame.get(game.gamePk) ?? [], 'probability', new Map())
    const bestByFamily = new Map<string, ConsumerOpportunity>()
    for (const item of ranked) if (!bestByFamily.has(item.family)) bestByFamily.set(item.family, item)
    const moneyline = bestByFamily.get('MONEYLINE')
    let awayWinProbability: number | null = null
    let homeWinProbability: number | null = null
    if (moneyline?.modelProbability !== null && moneyline?.modelProbability !== undefined) {
      const selected = moneyline.selection.toUpperCase()
      if (game.home.abbreviation && selected.includes(game.home.abbreviation)) {
        homeWinProbability = moneyline.modelProbability
        awayWinProbability = 100 - moneyline.modelProbability
      } else if (game.away.abbreviation && selected.includes(game.away.abbreviation)) {
        awayWinProbability = moneyline.modelProbability
        homeWinProbability = 100 - moneyline.modelProbability
      }
    }
    const metadata = asRecord(game.row.metadata)
    games.push({
      sport: 'MLB',
      gamePk: game.gamePk,
      officialDate: game.row.game_date,
      startTime: game.row.scheduled_at,
      status: gameStatus(game.row.official_status ?? String(metadata.abstractGameState ?? game.event.status ?? '')),
      venue: null,
      away: game.away,
      home: game.home,
      awayStarter: game.awayStarter,
      homeStarter: game.homeStarter,
      projectedAwayRuns: null,
      projectedHomeRuns: null,
      awayWinProbability,
      homeWinProbability,
      mainLines: mainLines(odds, game.event.id, status),
      smartPlay: ranked.find((item) => item.recommendation.status === 'RECOMMENDED' && ['MONEYLINE', 'RUN_LINE', 'TOTAL'].includes(item.family)) ?? null,
      bestByMarket: [...bestByFamily.values()],
      dataAsOf: board.latestVisibleMarketSnapshotTimestamp ?? board.latestOddsTimestamp,
      freshness: status,
    })
  }
  games.sort((a, b) => Date.parse(a.startTime ?? '') - Date.parse(b.startTime ?? ''))

  const warnings = [...new Set([...contexts.warnings, ...board.boardHealth.warnings])]
  const meta: ConsumerMeta = {
    contractVersion: PICK_EDGE_CONSUMER_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    dataAsOf: board.latestVisibleMarketSnapshotTimestamp ?? board.latestOddsTimestamp,
    timezone: TIMEZONE,
    source: 'pick-analyzer',
    stale: status === 'STALE' || status === 'UNKNOWN',
    warnings,
  }
  const gamesAsOf = contexts.canonicalRows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  const projectionsAsOf = opportunities
    .map((item) => item.projection.generatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  const health: ConsumerHealth = {
    gamesAsOf,
    oddsAsOf: meta.dataAsOf,
    projectionsAsOf,
    lineupsAsOf: null,
    statcastThrough: null,
    modelReadiness: board.boardHealth.status,
    freshness: status,
    staleComponents: status === 'STALE' || status === 'UNKNOWN' ? ['odds'] : [],
    warnings,
  }
  return { meta, games, opportunities, health }
}

export async function getPickEdgeGames(date?: string | null): Promise<ConsumerEnvelope<ConsumerGame[]>> {
  const snapshot = await buildPickEdgeConsumerSnapshot(date)
  return { meta: snapshot.meta, data: snapshot.games }
}

export async function getPickEdgeGame(gamePk: number, date?: string | null): Promise<ConsumerEnvelope<ConsumerGame | null>> {
  const snapshot = await buildPickEdgeConsumerSnapshot(date)
  return { meta: snapshot.meta, data: snapshot.games.find((game) => game.gamePk === gamePk) ?? null }
}

export async function getPickEdgeOpportunities({
  date,
  family: familyFilter,
  gamePk,
  sort = 'probability',
  limit = 100,
}: {
  date?: string | null
  family?: string | null
  gamePk?: number | null
  sort?: ConsumerSort
  limit?: number
}): Promise<ConsumerEnvelope<ConsumerOpportunity[]>> {
  const snapshot = await buildPickEdgeConsumerSnapshot(date)
  const gameTimes = new Map(snapshot.games.map((game) => [game.gamePk, Date.parse(game.startTime ?? '')]))
  let items = snapshot.opportunities
  if (familyFilter) items = items.filter((item) => item.family === familyFilter.toUpperCase())
  if (gamePk !== null && gamePk !== undefined) items = items.filter((item) => item.gamePk === gamePk)
  items = sortOpportunities(items, sort, gameTimes).slice(0, Math.max(1, Math.min(limit, 200)))
  return { meta: snapshot.meta, data: items }
}

export async function getPickEdgePlayerProps(date?: string | null): Promise<ConsumerEnvelope<ConsumerOpportunity[]>> {
  const snapshot = await buildPickEdgeConsumerSnapshot(date)
  return {
    meta: {
      ...snapshot.meta,
      warnings: [...new Set([...snapshot.meta.warnings, 'PLAYER_PROPS_NOT_YET_CERTIFIED_FOR_CONSUMER_RECOMMENDATIONS'])],
    },
    data: [],
  }
}

export async function getPickEdgeHealth(date?: string | null): Promise<ConsumerEnvelope<ConsumerHealth>> {
  const snapshot = await buildPickEdgeConsumerSnapshot(date)
  return { meta: snapshot.meta, data: snapshot.health }
}
