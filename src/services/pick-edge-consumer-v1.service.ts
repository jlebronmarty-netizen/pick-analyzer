import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoard, type CurrentBoardCandidate, type CurrentBoardResponse } from '@/services/current-board.service'
import type {
  ConsumerBookQuote,
  ConsumerEnvelope,
  ConsumerFreshness,
  ConsumerGame,
  ConsumerGameStatus,
  ConsumerHealth,
  ConsumerMainLine,
  ConsumerMarketFamily,
  ConsumerMeta,
  ConsumerOpportunity,
  ConsumerRecommendationMetadata,
  ConsumerSort,
  ConsumerStarter,
  ConsumerTeamRef,
} from '@/types/pick-edge-consumer-v1'
import { PICK_EDGE_CONSUMER_CONTRACT_VERSION } from '@/types/pick-edge-consumer-v1'

const TIMEZONE = 'America/Puerto_Rico' as const
const SUPPORTED_GAME_MARKETS = new Set(['moneyline', 'spread', 'total'])
const WATCH_POLICY_STATUSES = new Set(['WATCH', 'QUALIFIED', 'BEST_BET_CANDIDATE', 'PLAY_OF_DAY_CANDIDATE'])

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
  provider: string | null
  sportsbook: string | null
  market: string | null
  outcome: string | null
  price: number | null
  line: number | null
  snapshot_time: string | null
  provider_timestamp: string | null
  metadata: Record<string, unknown> | null
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

type CanonicalGameContext = {
  row: CanonicalGameRow
  event: SportEventRow
  gamePk: number
  away: ConsumerTeamRef
  home: ConsumerTeamRef
  awayStarter: ConsumerStarter | null
  homeStarter: ConsumerStarter | null
}

type ConsumerSnapshot = {
  board: CurrentBoardResponse
  meta: ConsumerMeta
  games: ConsumerGame[]
  opportunities: ConsumerOpportunity[]
  health: ConsumerHealth
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

function toIsoMinute(value: string | null | undefined) {
  if (!value) return ''
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return ''
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString()
}

function canonicalKey(start: string | null, away: string | null, home: string | null) {
  return `${toIsoMinute(start)}|${normalizeAbbreviation(away)}|${normalizeAbbreviation(home)}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

function officialMlbTeamId(metadata: Record<string, unknown>, side: 'away' | 'home') {
  const direct = asNumber(metadata[`${side}MlbTeamId`])
  if (direct !== null) return Math.round(direct)
  const identity = asRecord(metadata.mlb_official_identity)
  const nested = asNumber(identity[`${side}_mlb_team_id`])
  return nested === null ? null : Math.round(nested)
}

function teamRef(mlbTeamId: number | null, fallbackAbbreviation: string | null): ConsumerTeamRef {
  const known = mlbTeamId === null ? null : MLB_TEAMS[mlbTeamId]
  const abbreviation = known?.abbreviation ?? normalizeAbbreviation(fallbackAbbreviation) || null
  return {
    id: mlbTeamId === null ? null : `mlb:${mlbTeamId}`,
    mlbTeamId,
    name: known?.name ?? abbreviation ?? 'Unknown team',
    abbreviation,
    logoUrl: null,
  }
}

function starterFromMetadata(metadata: Record<string, unknown>, side: 'away' | 'home', observedAt: string | null): ConsumerStarter | null {
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

function mapGameStatus(value: string | null | undefined): ConsumerGameStatus {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.includes('final') || normalized.includes('completed')) return 'FINAL'
  if (normalized.includes('live') || normalized.includes('progress')) return 'LIVE'
  if (normalized.includes('postpon')) return 'POSTPONED'
  if (normalized.includes('cancel')) return 'CANCELLED'
  if (normalized.includes('preview') || normalized.includes('pregame')) return 'PREGAME'
  if (normalized.includes('scheduled')) return 'SCHEDULED'
  return 'UNKNOWN'
}

function mapFreshness(board: CurrentBoardResponse): ConsumerFreshness {
  if (board.dataFreshness.status === 'fresh') return 'FRESH'
  if (board.dataFreshness.status === 'partial') return 'AGING'
  if (board.dataFreshness.status === 'stale') return 'STALE'
  return 'UNKNOWN'
}

function mapFamily(market: string | null | undefined): ConsumerMarketFamily {
  const normalized = String(market ?? '').toLowerCase()
  if (normalized === 'moneyline') return 'MONEYLINE'
  if (normalized === 'spread' || normalized === 'run_line') return 'RUN_LINE'
  if (normalized === 'total') return 'TOTAL'
  return normalized.toUpperCase() || 'UNKNOWN'
}

function marketForFamily(family: ConsumerMarketFamily) {
  if (family === 'MONEYLINE') return 'moneyline'
  if (family === 'RUN_LINE') return 'spread'
  if (family === 'TOTAL') return 'total'
  return String(family).toLowerCase()
}

function confidenceTier(value: number | null): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRATED' {
  if (value === null) return 'UNRATED'
  if (value >= 70) return 'HIGH'
  if (value >= 55) return 'MEDIUM'
  return 'LOW'
}

function fairAmericanOdds(probabilityPercent: number | null) {
  if (probabilityPercent === null || probabilityPercent <= 0 || probabilityPercent >= 100) return null
  const p = probabilityPercent / 100
  return Math.round(p >= 0.5 ? -100 * p / (1 - p) : 100 * (1 - p) / p)
}

function impliedFromAmerican(odds: number | null) {
  if (odds === null || odds === 0) return null
  return odds < 0 ? (-odds / (-odds + 100)) * 100 : (100 / (odds + 100)) * 100
}

function selectionSide(candidate: CurrentBoardCandidate, game: CanonicalGameContext): 'HOME' | 'AWAY' | 'OVER' | 'UNDER' | null {
  const selection = String(candidate.canonicalOutcome?.selection ?? candidate.selection ?? '').toUpperCase()
  const home = game.home.abbreviation ?? ''
  const away = game.away.abbreviation ?? ''
  if (selection === home || selection.includes(`${home} `)) return 'HOME'
  if (selection === away || selection.includes(`${away} `)) return 'AWAY'
  if (selection.includes('OVER')) return 'OVER'
  if (selection.includes('UNDER')) return 'UNDER'
  return null
}

function recommendationMetadata(candidate: CurrentBoardCandidate, official: OfficialPickRow | null): ConsumerRecommendationMetadata {
  const status = official
    ? 'RECOMMENDED'
    : WATCH_POLICY_STATUSES.has(candidate.recommendationPolicyStatus)
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

function quoteFromOdds(row: OddsRow, freshness: ConsumerFreshness, isBestPrice = false): ConsumerBookQuote {
  return {
    quoteId: row.id,
    bookKey: String(row.sportsbook ?? 'unknown').toLowerCase(),
    bookName: row.sportsbook ?? 'Unknown book',
    line: asNumber(row.line),
    americanOdds: asNumber(row.price),
    impliedProbability: impliedFromAmerican(asNumber(row.price)),
    noVigProbability: null,
    acquiredAt: row.snapshot_time,
    providerLastUpdate: row.provider_timestamp,
    freshness,
    isBestPrice,
  }
}

function canonicalFallbackQuote(candidate: CurrentBoardCandidate, freshness: ConsumerFreshness): ConsumerBookQuote | null {
  const price = candidate.canonicalPrice?.americanOdds ?? candidate.americanOdds
  if (price === null || price === undefined) return null
  return {
    quoteId: candidate.canonicalPrice?.oddsSnapshotId ?? candidate.oddsSnapshotId,
    bookKey: String(candidate.canonicalPrice?.sportsbook ?? candidate.sportsbook ?? 'unknown').toLowerCase(),
    bookName: candidate.canonicalPrice?.sportsbook ?? candidate.sportsbook ?? 'Unknown book',
    line: candidate.canonicalOutcome?.line ?? candidate.line,
    americanOdds: asNumber(price),
    impliedProbability: asNumber(candidate.canonicalPrice?.impliedProbability ?? candidate.impliedProbability),
    noVigProbability: null,
    acquiredAt: candidate.canonicalPrice?.timestamp ?? candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp,
    providerLastUpdate: candidate.providerSourceUpdatedAt,
    freshness,
    isBestPrice: true,
  }
}

function candidateQuotes(
  candidate: CurrentBoardCandidate,
  game: CanonicalGameContext,
  oddsRows: OddsRow[],
  freshness: ConsumerFreshness
) {
  const family = mapFamily(candidate.market)
  const expectedMarket = marketForFamily(family)
  const side = selectionSide(candidate, game)
  if (!side || !SUPPORTED_GAME_MARKETS.has(expectedMarket)) {
    const fallback = canonicalFallbackQuote(candidate, freshness)
    return fallback ? [fallback] : []
  }

  const desiredOutcome = side.toLowerCase()
  const desiredLine = candidate.canonicalOutcome?.line ?? candidate.line
  const perBook = new Map<string, OddsRow>()
  for (const row of oddsRows) {
    if (row.event_id !== game.event.id) continue
    if (String(row.market ?? '').toLowerCase() !== expectedMarket) continue
    if (String(row.outcome ?? '').toLowerCase() !== desiredOutcome) continue
    if ((family === 'RUN_LINE' || family === 'TOTAL') && desiredLine !== null && desiredLine !== undefined) {
      if (asNumber(row.line) !== asNumber(desiredLine)) continue
    }
    const book = String(row.sportsbook ?? 'unknown').toLowerCase()
    if (!perBook.has(book)) perBook.set(book, row)
  }

  const selected = [...perBook.values()].sort((a, b) => (asNumber(b.price) ?? -Infinity) - (asNumber(a.price) ?? -Infinity))
  if (!selected.length) {
    const fallback = canonicalFallbackQuote(candidate, freshness)
    return fallback ? [fallback] : []
  }
  return selected.map((row, index) => quoteFromOdds(row, freshness, index === 0))
}

function officialKey(gamePk: number, market: string, side: string) {
  return `${gamePk}|${market.toUpperCase()}|${side.toUpperCase()}`
}

function opportunityFromCandidate(
  candidate: CurrentBoardCandidate,
  game: CanonicalGameContext,
  oddsRows: OddsRow[],
  officialByKey: Map<string, OfficialPickRow>,
  freshness: ConsumerFreshness
): ConsumerOpportunity {
  const family = mapFamily(candidate.market)
  const side = selectionSide(candidate, game)
  const official = side ? officialByKey.get(officialKey(game.gamePk, family, side)) ?? null : null
  const quotes = candidateQuotes(candidate, game, oddsRows, freshness)
  const bestQuote = official
    ? {
        quoteId: official.official_pick_identity,
        bookKey: String(official.bookmaker_key ?? official.bookmaker_name ?? 'unknown').toLowerCase(),
        bookName: official.bookmaker_name ?? official.bookmaker_key ?? 'Unknown book',
        line: candidate.canonicalOutcome?.line ?? candidate.line,
        americanOdds: asNumber(official.american_odds),
        impliedProbability: impliedFromAmerican(asNumber(official.american_odds)),
        noVigProbability: official.consensus_probability === null ? null : asNumber(official.consensus_probability)! * 100,
        acquiredAt: official.market_acquired_at,
        providerLastUpdate: official.market_acquired_at,
        freshness,
        isBestPrice: true,
      } satisfies ConsumerBookQuote
    : quotes[0] ?? canonicalFallbackQuote(candidate, freshness)

  const selection = String(candidate.canonicalOutcome?.selection ?? candidate.selection)
  const teamSide = side === 'HOME' ? game.home : side === 'AWAY' ? game.away : null
  return {
    opportunityId: candidate.predictionId,
    sport: 'MLB',
    gamePk: game.gamePk,
    family,
    market: candidate.marketLabel || String(candidate.market),
    subjectType: teamSide ? 'TEAM' : 'GAME',
    subjectId: teamSide?.id ?? null,
    subjectName: teamSide?.name ?? candidate.matchup,
    selection,
    line: asNumber(candidate.canonicalOutcome?.line ?? candidate.line),
    projection: {
      value: null,
      unit: null,
      modelVersion: candidate.modelVersion ?? null,
      generatedAt: candidate.predictionGeneratedAt ?? null,
    },
    modelProbability: asNumber(candidate.canonicalOutcome?.probability ?? candidate.modelProbability),
    impliedProbability: asNumber(bestQuote?.impliedProbability ?? candidate.impliedProbability),
    noVigProbability: official?.consensus_probability === null || official?.consensus_probability === undefined
      ? null
      : asNumber(official.consensus_probability)! * 100,
    fairAmericanOdds: fairAmericanOdds(asNumber(candidate.canonicalOutcome?.probability ?? candidate.modelProbability)),
    edge: official?.consensus_edge === null || official?.consensus_edge === undefined
      ? asNumber(candidate.canonicalEv?.actionableEdge ?? candidate.edgePercentagePoints ?? candidate.edge)
      : asNumber(official.consensus_edge)! * 100,
    expectedValue: official?.unit_ev === null || official?.unit_ev === undefined
      ? asNumber(candidate.canonicalEv?.actionableExpectedValue ?? candidate.expectedValuePercent ?? candidate.expectedValue)
      : asNumber(official.unit_ev)! * 100,
    consensusProbability: official?.consensus_probability === null || official?.consensus_probability === undefined
      ? null
      : asNumber(official.consensus_probability)! * 100,
    consensusEdge: official?.consensus_edge === null || official?.consensus_edge === undefined
      ? null
      : asNumber(official.consensus_edge)! * 100,
    marketDispersion: null,
    bestQuote,
    quotes,
    recommendation: recommendationMetadata(candidate, official),
    freshness: candidate.stale ? 'STALE' : freshness,
    dataAsOf: candidate.marketFreshnessTimestamp ?? candidate.oddsTimestamp ?? candidate.predictionGeneratedAt ?? null,
    dataQualityScore: asNumber(candidate.featureQuality),
    sourceLineageAvailable: Boolean(candidate.snapshotId || candidate.oddsSnapshotId),
  }
}

function syntheticOfficialOpportunity(
  official: OfficialPickRow,
  game: CanonicalGameContext,
  freshness: ConsumerFreshness
): ConsumerOpportunity | null {
  if (official.market.toUpperCase() !== 'MONEYLINE') return null
  const team = official.side.toUpperCase() === 'HOME' ? game.home : official.side.toUpperCase() === 'AWAY' ? game.away : null
  if (!team) return null
  const modelProbability = asNumber(official.model_probability)
  const modelPct = modelProbability === null ? null : modelProbability * 100
  const consensus = asNumber(official.consensus_probability)
  const edge = asNumber(official.consensus_edge)
  const ev = asNumber(official.unit_ev)
  const odds = asNumber(official.american_odds)
  const quote: ConsumerBookQuote = {
    quoteId: official.official_pick_identity,
    bookKey: String(official.bookmaker_key ?? official.bookmaker_name ?? 'unknown').toLowerCase(),
    bookName: official.bookmaker_name ?? official.bookmaker_key ?? 'Unknown book',
    line: null,
    americanOdds: odds,
    impliedProbability: impliedFromAmerican(odds),
    noVigProbability: consensus === null ? null : consensus * 100,
    acquiredAt: official.market_acquired_at,
    providerLastUpdate: official.market_acquired_at,
    freshness,
    isBestPrice: true,
  }
  return {
    opportunityId: `official:${official.official_pick_identity}`,
    sport: 'MLB',
    gamePk: game.gamePk,
    family: 'MONEYLINE',
    market: 'Moneyline',
    subjectType: 'TEAM',
    subjectId: team.id,
    subjectName: team.name,
    selection: team.abbreviation ?? team.name,
    line: null,
    projection: { value: null, unit: null, modelVersion: official.model_version, generatedAt: official.prediction_as_of },
    modelProbability: modelPct,
    impliedProbability: quote.impliedProbability,
    noVigProbability: consensus === null ? null : consensus * 100,
    fairAmericanOdds: fairAmericanOdds(modelPct),
    edge: edge === null ? null : edge * 100,
    expectedValue: ev === null ? null : ev * 100,
    consensusProbability: consensus === null ? null : consensus * 100,
    consensusEdge: edge === null ? null : edge * 100,
    marketDispersion: null,
    bestQuote: quote,
    quotes: [quote],
    recommendation: {
      status: 'RECOMMENDED',
      label: 'Official Pick',
      confidenceTier: confidenceTier(modelPct),
      confidenceScore: modelPct,
      reasonCodes: stringArray(official.reason_codes),
      riskFlags: stringArray(official.risk_flags),
      explanation: 'Certified Pick Analyzer Policy V1 official recommendation.',
      productAction: 'ANALYSIS_ONLY',
    },
    freshness,
    dataAsOf: official.decision_at ?? official.market_acquired_at,
    dataQualityScore: null,
    sourceLineageAvailable: true,
  }
}

function latestDisplayQuote(rows: OddsRow[], eventId: string, market: string, outcome: string, freshness: ConsumerFreshness) {
  const candidates = rows.filter((row) =>
    row.event_id === eventId &&
    String(row.market ?? '').toLowerCase() === market &&
    String(row.outcome ?? '').toLowerCase() === outcome
  )
  const fanduel = candidates.find((row) => String(row.sportsbook ?? '').toLowerCase() === 'fanduel')
  return (fanduel ?? candidates[0]) ? quoteFromOdds(fanduel ?? candidates[0], freshness) : null
}

function buildMainLines(rows: OddsRow[], eventId: string, freshness: ConsumerFreshness): ConsumerMainLine[] {
  return [
    {
      family: 'MONEYLINE',
      away: latestDisplayQuote(rows, eventId, 'moneyline', 'away', freshness),
      home: latestDisplayQuote(rows, eventId, 'moneyline', 'home', freshness),
    },
    {
      family: 'RUN_LINE',
      away: latestDisplayQuote(rows, eventId, 'spread', 'away', freshness),
      home: latestDisplayQuote(rows, eventId, 'spread', 'home', freshness),
    },
    {
      family: 'TOTAL',
      away: null,
      home: null,
      over: latestDisplayQuote(rows, eventId, 'total', 'over', freshness),
      under: latestDisplayQuote(rows, eventId, 'total', 'under', freshness),
    },
  ]
}

function sortOpportunities(items: ConsumerOpportunity[], sort: ConsumerSort = 'probability', gameTime = new Map<number, number>()) {
  return [...items].sort((a, b) => {
    if (sort === 'edge') return (b.edge ?? -Infinity) - (a.edge ?? -Infinity) || (b.modelProbability ?? -Infinity) - (a.modelProbability ?? -Infinity)
    if (sort === 'ev') return (b.expectedValue ?? -Infinity) - (a.expectedValue ?? -Infinity) || (b.modelProbability ?? -Infinity) - (a.modelProbability ?? -Infinity)
    if (sort === 'game_time') return (gameTime.get(a.gamePk) ?? Infinity) - (gameTime.get(b.gamePk) ?? Infinity)
    return (b.modelProbability ?? -Infinity) - (a.modelProbability ?? -Infinity) || (b.edge ?? -Infinity) - (a.edge ?? -Infinity)
  })
}

async function canonicalContexts(board: CurrentBoardResponse, date: string) {
  const gameResult = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk, game_date, scheduled_at, official_status, metadata, updated_at')
    .eq('game_date', date)
    .order('scheduled_at', { ascending: true })
  if (gameResult.error) throw new Error(`consumer canonical games read failed: ${gameResult.error.message}`)
  const canonicalRows = (gameResult.data ?? []) as CanonicalGameRow[]

  const eventIds = board.games.map((game) => game.eventId).filter(Boolean)
  const eventResult = eventIds.length
    ? await supabaseAdmin.from('sport_events').select('id, home_team, away_team, start_time, status').in('id', eventIds)
    : { data: [], error: null }
  if (eventResult.error) throw new Error(`consumer sport events read failed: ${eventResult.error.message}`)
  const events = (eventResult.data ?? []) as SportEventRow[]

  const canonicalByKey = new Map<string, CanonicalGameRow>()
  for (const row of canonicalRows) {
    const metadata = asRecord(row.metadata)
    const awayId = officialMlbTeamId(metadata, 'away')
    const homeId = officialMlbTeamId(metadata, 'home')
    const away = awayId === null ? null : MLB_TEAMS[awayId]?.abbreviation ?? null
    const home = homeId === null ? null : MLB_TEAMS[homeId]?.abbreviation ?? null
    canonicalByKey.set(canonicalKey(row.scheduled_at, away, home), row)
  }

  const byEventId = new Map<string, CanonicalGameContext>()
  const byGamePk = new Map<number, CanonicalGameContext>()
  const warnings: string[] = []
  for (const event of events) {
    const canonical = canonicalByKey.get(canonicalKey(event.start_time, event.away_team, event.home_team))
    if (!canonical) {
      warnings.push(`UNMAPPED_CANONICAL_GAME:${event.id}`)
      continue
    }
    const metadata = asRecord(canonical.metadata)
    const awayMlbId = officialMlbTeamId(metadata, 'away')
    const homeMlbId = officialMlbTeamId(metadata, 'home')
    const context: CanonicalGameContext = {
      row: canonical,
      event,
      gamePk: Number(canonical.game_pk),
      away: teamRef(awayMlbId, event.away_team),
      home: teamRef(homeMlbId, event.home_team),
      awayStarter: starterFromMetadata(metadata, 'away', canonical.updated_at),
      homeStarter: starterFromMetadata(metadata, 'home', canonical.updated_at),
    }
    byEventId.set(event.id, context)
    byGamePk.set(context.gamePk, context)
  }
  return { byEventId, byGamePk, warnings, canonicalRows }
}

async function readOdds(eventIds: string[]) {
  if (!eventIds.length) return [] as OddsRow[]
  const result = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id, event_id, provider, sportsbook, market, outcome, price, line, snapshot_time, provider_timestamp, metadata')
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
  const rows = (result.data ?? []) as OfficialPickRow[]
  const deduped = new Map<string, OfficialPickRow>()
  for (const row of rows) {
    const key = officialKey(Number(row.game_pk), row.market, row.side)
    if (!deduped.has(key)) deduped.set(key, row)
  }
  return [...deduped.values()]
}

export async function buildPickEdgeConsumerSnapshot(dateInput?: string | null): Promise<ConsumerSnapshot> {
  const date = validateConsumerDate(dateInput)
  const board = await getCurrentBoard({
    sportKey: 'baseball_mlb',
    mode: 'CURRENT',
    limit: 200,
    modelRole: 'champion',
    includeMlbContext: true,
    slateDate: date,
  })
  const freshness = mapFreshness(board)
  const contexts = await canonicalContexts(board, date)
  const eventIds = [...contexts.byEventId.keys()]
  const gamePks = [...contexts.byGamePk.keys()]
  const [oddsRows, officialRows] = await Promise.all([readOdds(eventIds), readOfficialPicks(gamePks)])
  const officialByKey = new Map<string, OfficialPickRow>()
  for (const row of officialRows) officialByKey.set(officialKey(Number(row.game_pk), row.market, row.side), row)

  const opportunities: ConsumerOpportunity[] = []
  for (const candidate of board.candidates) {
    const context = contexts.byEventId.get(candidate.eventId)
    if (!context) continue
    opportunities.push(opportunityFromCandidate(candidate, context, oddsRows, officialByKey, freshness))
  }

  for (const official of officialRows) {
    const context = contexts.byGamePk.get(Number(official.game_pk))
    if (!context) continue
    const side = official.side.toUpperCase()
    const alreadyPresent = opportunities.some((item) =>
      item.gamePk === context.gamePk &&
      item.family === mapFamily(official.market) &&
      item.recommendation.status === 'RECOMMENDED' &&
      (side === 'HOME' ? item.selection.includes(context.home.abbreviation ?? '') : side === 'AWAY' ? item.selection.includes(context.away.abbreviation ?? '') : true)
    )
    if (!alreadyPresent) {
      const synthetic = syntheticOfficialOpportunity(official, context, freshness)
      if (synthetic) opportunities.push(synthetic)
    }
  }

  const opportunitiesByGame = new Map<number, ConsumerOpportunity[]>()
  for (const item of opportunities) {
    const list = opportunitiesByGame.get(item.gamePk) ?? []
    list.push(item)
    opportunitiesByGame.set(item.gamePk, list)
  }

  const games: ConsumerGame[] = []
  for (const context of contexts.byGamePk.values()) {
    const candidates = sortOpportunities(opportunitiesByGame.get(context.gamePk) ?? [])
    const bestByFamily = new Map<string, ConsumerOpportunity>()
    for (const candidate of candidates) if (!bestByFamily.has(candidate.family)) bestByFamily.set(candidate.family, candidate)
    const bestByMarket = [...bestByFamily.values()]
    const smartPlay = candidates.find((item) =>
      item.recommendation.status === 'RECOMMENDED' && ['MONEYLINE', 'RUN_LINE', 'TOTAL'].includes(item.family)
    ) ?? null
    const moneyline = bestByFamily.get('MONEYLINE')
    let awayWinProbability: number | null = null
    let homeWinProbability: number | null = null
    if (moneyline?.modelProbability !== null && moneyline?.modelProbability !== undefined) {
      const selection = moneyline.selection.toUpperCase()
      if (context.home.abbreviation && selection.includes(context.home.abbreviation)) {
        homeWinProbability = moneyline.modelProbability
        awayWinProbability = 100 - moneyline.modelProbability
      } else if (context.away.abbreviation && selection.includes(context.away.abbreviation)) {
        awayWinProbability = moneyline.modelProbability
        homeWinProbability = 100 - moneyline.modelProbability
      }
    }
    const metadata = asRecord(context.row.metadata)
    games.push({
      sport: 'MLB',
      gamePk: context.gamePk,
      officialDate: context.row.game_date,
      startTime: context.row.scheduled_at,
      status: mapGameStatus(context.row.official_status ?? String(metadata.abstractGameState ?? context.event.status ?? '')),
      venue: null,
      away: context.away,
      home: context.home,
      awayStarter: context.awayStarter,
      homeStarter: context.homeStarter,
      projectedAwayRuns: null,
      projectedHomeRuns: null,
      awayWinProbability,
      homeWinProbability,
      mainLines: buildMainLines(oddsRows, context.event.id, freshness),
      smartPlay,
      bestByMarket,
      dataAsOf: board.latestVisibleMarketSnapshotTimestamp ?? board.latestOddsTimestamp,
      freshness,
    })
  }
  games.sort((a, b) => Date.parse(a.startTime ?? '') - Date.parse(b.startTime ?? ''))

  const warnings = [
    ...contexts.warnings,
    ...board.boardHealth.warnings,
    ...(board.dataFreshness.status === 'empty' ? ['CURRENT_BOARD_EMPTY'] : []),
  ]
  const meta: ConsumerMeta = {
    contractVersion: PICK_EDGE_CONSUMER_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    dataAsOf: board.latestVisibleMarketSnapshotTimestamp ?? board.latestOddsTimestamp,
    timezone: TIMEZONE,
    source: 'pick-analyzer',
    stale: freshness === 'STALE' || freshness === 'UNKNOWN',
    warnings: [...new Set(warnings)],
  }

  const projectionsAsOf = opportunities
    .map((item) => item.projection.generatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  const gamesAsOf = contexts.canonicalRows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  const staleComponents = [
    ...(freshness === 'STALE' || freshness === 'UNKNOWN' ? ['odds'] : []),
    ...(board.boardHealth.status === 'EMPTY' ? ['predictions'] : []),
  ]
  const health: ConsumerHealth = {
    gamesAsOf,
    oddsAsOf: board.latestVisibleMarketSnapshotTimestamp ?? board.latestOddsTimestamp,
    projectionsAsOf,
    lineupsAsOf: null,
    statcastThrough: null,
    modelReadiness: board.boardHealth.status,
    freshness,
    staleComponents,
    warnings: meta.warnings,
  }
  return { board, meta, games, opportunities, health }
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
  family,
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
  if (family) items = items.filter((item) => item.family === family.toUpperCase())
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
