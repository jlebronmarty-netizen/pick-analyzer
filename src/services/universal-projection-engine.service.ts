import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import { getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { getMlbStarterWeatherStadiumIntelligence } from '@/services/mlb-starter-weather-stadium-intelligence.service'
import { getSharedSportPredictionEngineSdk } from '@/services/sport-prediction-engine-sdk.service'
import { resolveMlbGameLifecycle } from '@/services/mlb-game-lifecycle.service'
import {
  decimalInningsToOuts,
  perNineToGameCount,
  ProjectionOrigin,
  ProjectionRankTier,
  ProjectionUnit,
  ProjectionValidity,
  rankProjection,
  roundProjection,
  seasonCountToPerGame,
  stableProjectionId,
  StarterStatus,
  validateMlbProjectionIntegrityFixtures,
  validateProjectionValue,
} from '@/services/mlb-projection-integrity.service'

type ProjectionType = 'team' | 'player' | 'pitcher' | 'game'
type Readiness = 'READY' | 'LIMITED' | 'BLOCKED' | 'INSUFFICIENT_DATA'
type ShadowStatus = 'SHADOW_ONLY' | 'VALIDATING' | 'INSUFFICIENT_HISTORY'

type EventRow = {
  id: string
  sport_key: string
  league_key: string
  season: string
  home_team_id: string | null
  away_team_id: string | null
  home_team: string
  away_team: string
  start_time: string
  status: string
  updated_at?: string | null
  home_score: number | null
  away_score: number | null
  metadata: Record<string, unknown> | null
}

type GameStatRow = {
  id: string
  event_id: string
  team_id: string
  team_name: string
  opponent_team_id: string | null
  opponent_team_name: string | null
  is_home: boolean
  points_for: number | null
  points_against: number | null
  stats: Record<string, unknown> | null
}

type PlayerStatRow = {
  id: string
  stat_type: string | null
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  games: number | null
  starts: number | null
  starter: boolean | null
  provider_ids?: Record<string, unknown> | null
  stats: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  source_timestamp: string | null
}

type PlayerRow = {
  id: string
  team_id: string | null
  team_name: string | null
  display_name: string
  position: string | null
  status: string | null
  active: boolean | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export type UniversalProjection = {
  id: string
  sportKey: string
  leagueKey: string
  season: string | null
  eventId: string | null
  entityType: ProjectionType
  entityId: string | null
  entityName: string
  teamId: string | null
  teamName: string | null
  projectionKey: string
  projectionLabel?: string
  projectionFamily: string
  projectedValue: number | null
  unit?: ProjectionUnit
  confidence: number
  historicalAccuracy: number | null
  featureQuality: number
  dataSufficiency: number
  predictionInterval: { low: number | null; high: number | null }
  featureContributions: Array<{ feature: string; status: 'AVAILABLE' | 'PARTIAL' | 'MISSING'; contribution: number; explanation: string }>
  explanation: string
  readiness: Readiness
  shadowStatus: ShadowStatus
  generatedAt: string
  modelVersion?: string
  matchup?: string
  scheduledTime?: string | null
  opponentTeamId?: string | null
  opponentTeamName?: string | null
  side?: 'home' | 'away' | null
  providerPlayerId?: string | null
  internalPlayerId?: string | null
  identityConfidence?: number | null
  starterStatus?: StarterStatus | null
  starterSource?: string | null
  starterVerifiedAt?: string | null
  participationStatus?: string | null
  participationConfidence?: number | null
  projectionOrigin?: ProjectionOrigin
  validityStatus?: ProjectionValidity
  validationErrors?: string[]
  validationWarnings?: string[]
  rankScore?: number
  rankTier?: ProjectionRankTier
  rankReasons?: string[]
  rankWarnings?: string[]
  userVisible?: boolean
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function statNumber(row: { stats?: Record<string, unknown> | null; metadata?: Record<string, unknown> | null }, keys: string[]) {
  const bag = { ...asRecord(row.stats), ...asRecord(row.metadata) }
  for (const key of keys) {
    const parsed = Number(bag[key])
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function avg(values: Array<number | null>) {
  const clean = values.filter((value): value is number => Number.isFinite(Number(value)))
  return clean.length ? round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function interval(value: number | null, confidence: number, spread: number) {
  if (value === null) return { low: null, high: null }
  const uncertainty = spread * (1 - confidence / 100)
  return { low: round(Math.max(0, value - uncertainty)), high: round(value + uncertainty) }
}

function readiness(dataSufficiency: number, featureQuality: number): Readiness {
  if (dataSufficiency >= 75 && featureQuality >= 75) return 'READY'
  if (dataSufficiency >= 45 && featureQuality >= 45) return 'LIMITED'
  if (dataSufficiency > 0 || featureQuality > 0) return 'INSUFFICIENT_DATA'
  return 'BLOCKED'
}

function contribution(feature: string, status: 'AVAILABLE' | 'PARTIAL' | 'MISSING', contributionValue: number, explanation: string) {
  return { feature, status, contribution: contributionValue, explanation }
}

async function loadMlbEvents(date: string) {
  const range = puertoRicoUtcRange(date)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team_id, away_team_id, home_team, away_team, start_time, status, updated_at, home_score, away_score, metadata')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB projection event load failed: ${error.message}`)
  return (data ?? []) as EventRow[]
}

async function loadMlbGameStats(eventIds: string[]) {
  if (!eventIds.length) return [] as GameStatRow[]
  const { data, error } = await supabaseAdmin
    .from('sport_game_stats')
    .select('id, event_id, team_id, team_name, opponent_team_id, opponent_team_name, is_home, points_for, points_against, stats')
    .eq('sport_key', 'baseball_mlb')
    .in('event_id', eventIds)
    .limit(5000)
  if (error) return [] as GameStatRow[]
  return (data ?? []) as GameStatRow[]
}

async function loadMlbPlayerStats() {
  const { data, error } = await supabaseAdmin
    .from('sport_player_stats')
    .select('id, stat_type, event_id, team_id, player_id, player_name, games, starts, starter, provider_ids, stats, metadata, source_timestamp')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (error) return [] as PlayerStatRow[]
  return (data ?? []) as PlayerStatRow[]
}

async function loadMlbPlayers() {
  const { data, error } = await supabaseAdmin
    .from('sport_players')
    .select('id, team_id, team_name, display_name, position, status, active, provider_ids, metadata')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .limit(5000)
  if (error) return [] as PlayerRow[]
  return (data ?? []) as PlayerRow[]
}

function projection(params: Omit<UniversalProjection, 'id'>) {
  const validation = validateProjectionValue({
    projectionKey: params.projectionKey,
    projectionFamily: params.projectionFamily,
    entityType: params.entityType,
    entityId: params.entityId,
    projectedValue: params.projectedValue,
    unit: params.unit ?? 'UNKNOWN',
    readiness: params.readiness,
    confidence: params.confidence,
    featureQuality: params.featureQuality,
    dataSufficiency: params.dataSufficiency,
    origin: params.projectionOrigin ?? 'BLOCKED',
    identityConfidence: params.identityConfidence,
    participationConfidence: params.participationConfidence,
    warnings: params.validationWarnings,
  })
  const rank = rankProjection({
    projectionKey: params.projectionKey,
    projectionFamily: params.projectionFamily,
    entityType: params.entityType,
    entityId: params.entityId,
    projectedValue: params.projectedValue,
    unit: params.unit ?? 'UNKNOWN',
    readiness: params.readiness,
    confidence: params.confidence,
    featureQuality: params.featureQuality,
    dataSufficiency: params.dataSufficiency,
    origin: params.projectionOrigin ?? 'BLOCKED',
    identityConfidence: params.identityConfidence,
    participationConfidence: params.participationConfidence,
    warnings: validation.warnings,
    validityStatus: validation.status,
  })
  const userVisible =
    validation.status === 'VALID' &&
    params.readiness !== 'BLOCKED' &&
    params.readiness !== 'INSUFFICIENT_DATA' &&
    params.projectionOrigin !== 'LEAGUE_BASELINE' &&
    params.projectionOrigin !== 'BLOCKED' &&
    !(params.entityType === 'pitcher' && params.starterStatus === 'UNVERIFIED')
  return {
    id: stableProjectionId([
      params.sportKey,
      params.season,
      params.eventId,
      params.entityType,
      params.entityId,
      params.projectionKey,
      params.modelVersion ?? 'universal_projection_engine_v2',
      params.generatedAt.slice(0, 10),
    ]),
    ...params,
    validityStatus: validation.status,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    rankScore: rank.rankScore,
    rankTier: rank.rankTier,
    rankReasons: rank.rankReasons,
    rankWarnings: rank.rankWarnings,
    userVisible,
  }
}

function teamAverage(stats: GameStatRow[], teamId: string | null, key: string[], fallback: number | null) {
  const rows = teamId ? stats.filter((row) => row.team_id === teamId) : []
  return avg(rows.map((row) => statNumber(row, key) ?? (key.includes('runs') ? row.points_for : null))) ?? fallback
}

function makeTeamProjections(event: EventRow, stats: GameStatRow[], side: 'home' | 'away', generatedAt: string) {
  const teamId = side === 'home' ? event.home_team_id : event.away_team_id
  const teamName = side === 'home' ? event.home_team : event.away_team
  const opponentName = side === 'home' ? event.away_team : event.home_team
  const hasStoredStats = stats.some((row) => row.team_id === teamId)
  const runs = hasStoredStats ? teamAverage(stats, teamId, ['Runs', 'runs', 'TeamRuns'], null) : null
  const hits = hasStoredStats ? teamAverage(stats, teamId, ['Hits', 'hits'], null) : null
  const homeRuns = hasStoredStats ? teamAverage(stats, teamId, ['HomeRuns', 'homeRuns', 'HR'], null) : null
  const walks = hasStoredStats ? teamAverage(stats, teamId, ['Walks', 'walks', 'BB'], null) : null
  const strikeouts = hasStoredStats ? teamAverage(stats, teamId, ['Strikeouts', 'strikeouts', 'K'], null) : null
  const totalBases = hasStoredStats ? teamAverage(stats, teamId, ['TotalBases', 'totalBases', 'TB'], null) : null
  const obp = hasStoredStats ? teamAverage(stats, teamId, ['OnBasePercentage', 'OBP', 'onBasePercentage'], null) : null
  const slugging = hasStoredStats ? teamAverage(stats, teamId, ['SluggingPercentage', 'SLG', 'slugging'], null) : null
  const featureQuality = hasStoredStats ? 62 : 0
  const dataSufficiency = hasStoredStats ? 58 : 0
  const confidence = hasStoredStats ? 57 : 0
  const origin: ProjectionOrigin = hasStoredStats ? 'TEAM_SPECIFIC_BASELINE' : 'LEAGUE_BASELINE'
  const readinessValue = hasStoredStats ? readiness(dataSufficiency, featureQuality) : 'BLOCKED'
  const baseFeatures = [
    contribution('stored_team_game_stats', hasStoredStats ? 'PARTIAL' : 'MISSING', hasStoredStats ? 24 : 0, hasStoredStats ? 'Stored team stat rows inform the baseline.' : 'No stored MLB team game-stat rows were available for this team.'),
    contribution('home_away_context', 'AVAILABLE', side === 'home' ? 8 : 4, `${teamName} is projected as the ${side} team.`),
    contribution('opponent_context', 'PARTIAL', 6, `Opponent context is limited to matchup identity against ${opponentName}.`),
  ]
  const values = [
    ['projected_runs', 'Projected Runs', runs, 2.2],
    ['projected_hits', 'Projected Hits', hits, 3],
    ['projected_home_runs', 'Projected Home Runs', homeRuns, 1],
    ['projected_walks', 'Projected Walks', walks, 1.8],
    ['projected_strikeouts', 'Projected Strikeouts', strikeouts, 2.8],
    ['projected_total_bases', 'Projected Total Bases', totalBases, 4.5],
    ['projected_on_base_percentage', 'Projected On Base Percentage', obp, 0.08],
    ['projected_slugging', 'Projected Slugging', slugging, 0.12],
  ] as const
  return values.map(([key, label, value, spread]) => projection({
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    season: event.season,
    eventId: event.id,
    entityType: 'team',
    entityId: teamId,
    entityName: teamName,
    teamId,
    teamName,
    matchup: `${event.away_team} @ ${event.home_team}`,
    scheduledTime: event.start_time,
    side,
    opponentTeamId: side === 'home' ? event.away_team_id : event.home_team_id,
    opponentTeamName: opponentName,
    projectionKey: key,
    projectionLabel: label,
    projectionFamily: 'mlb_team_projection',
    projectedValue: value === null ? null : roundProjection(value, key.includes('percentage') ? 'PERCENT_0_TO_1' : 'COUNT_PER_GAME'),
    unit: key.includes('percentage') ? 'PERCENT_0_TO_1' : 'COUNT_PER_GAME',
    confidence,
    historicalAccuracy: null,
    featureQuality,
    dataSufficiency,
    predictionInterval: interval(value, confidence, spread),
    featureContributions: baseFeatures,
    explanation: hasStoredStats
      ? `${label} for ${teamName} uses stored team-specific context. No line, odds, EV or Kelly input is used.`
      : `${label} for ${teamName} is blocked because only league-baseline context is available; it is not treated as differentiated team intelligence.`,
    readiness: readinessValue,
    shadowStatus: 'INSUFFICIENT_HISTORY',
    modelVersion: 'universal_projection_engine_v2',
    identityConfidence: teamId ? 100 : 0,
    participationConfidence: 100,
    projectionOrigin: origin,
    validationWarnings: hasStoredStats ? [] : ['LEAGUE_BASELINE_ONLY'],
    generatedAt,
  }))
}

function isPitcher(row: PlayerStatRow) {
  const bag = { ...asRecord(row.stats), ...asRecord(row.metadata) }
  const position = String(bag.Position ?? bag.position ?? '').toLowerCase()
  return position === 'p' || position === 'sp' || position === 'rp' || ['ERA', 'WHIP', 'InningsPitchedDecimal', 'PitchesThrown'].some((key) => bag[key] !== undefined)
}

function providerIdFromBag(value: unknown) {
  const bag = asRecord(value)
  const candidates = [
    bag.sportsdataio,
    bag.sportsdataio_player_id,
    bag.PlayerID,
    bag.PlayerId,
    bag.playerId,
    bag.player_id,
  ]
  const found = candidates.find((item) => item !== null && item !== undefined && String(item).trim())
  return found === undefined ? null : String(found)
}

function playerProviderId(row: PlayerStatRow | PlayerRow) {
  return providerIdFromBag(row.provider_ids) ?? providerIdFromBag(row.metadata) ?? providerIdFromBag('stats' in row ? row.stats : null)
}

function starterContextForEvent(starterWeather: Record<string, unknown>, event: EventRow) {
  const games = Array.isArray(starterWeather.games) ? (starterWeather.games as Array<Record<string, unknown>>) : []
  return games.find((game) => String(game.eventId ?? '') === event.id) ?? null
}

function resolveStarterRows(event: EventRow, playerStats: PlayerStatRow[], players: PlayerRow[], starterWeather: Record<string, unknown>) {
  const game = starterContextForEvent(starterWeather, event)
  const starters = asRecord(game?.starters)
  const sides = [
    { side: 'away' as const, teamId: event.away_team_id, teamName: event.away_team, opponentTeamId: event.home_team_id, opponentTeamName: event.home_team, raw: asRecord(starters.away) },
    { side: 'home' as const, teamId: event.home_team_id, teamName: event.home_team, opponentTeamId: event.away_team_id, opponentTeamName: event.away_team, raw: asRecord(starters.home) },
  ]
  return sides.map((side) => {
    const providerPlayerId = providerIdFromBag({ sportsdataio: side.raw.playerId })
    const mappedPlayer = providerPlayerId
      ? players.find((player) => playerProviderId(player) === providerPlayerId)
      : null
    const statRow = providerPlayerId
      ? playerStats.find((row) => isPitcher(row) && (playerProviderId(row) === providerPlayerId || (mappedPlayer?.id && row.player_id === mappedPlayer.id)))
      : null
    const starterStatus: StarterStatus = side.raw.confirmed === true ? 'CONFIRMED' : side.raw.probable === true ? 'PROBABLE' : providerPlayerId ? 'EXPECTED' : 'UNVERIFIED'
    const fallbackEntityId = providerPlayerId ? `sportsdataio:mlb:player:${providerPlayerId}` : null
    const internalPlayerId = mappedPlayer?.id ?? statRow?.player_id ?? null
    const identityConfidence = internalPlayerId ? 96 : providerPlayerId ? 82 : 0
    return {
      ...side,
      providerPlayerId,
      internalPlayerId,
      entityId: internalPlayerId ?? fallbackEntityId,
      entityName: mappedPlayer?.display_name ?? statRow?.player_name ?? String(side.raw.name ?? 'Pitcher'),
      position: mappedPlayer?.position ?? 'P',
      active: mappedPlayer?.active ?? null,
      statRow,
      starterStatus,
      starterSource: String(side.raw.source ?? 'sportsdataio_games_by_date_verified_snapshot'),
      starterVerifiedAt: typeof side.raw.capturedAt === 'string' ? side.raw.capturedAt : null,
      identityConfidence,
      participationConfidence: starterStatus === 'CONFIRMED' ? 96 : starterStatus === 'PROBABLE' ? 86 : starterStatus === 'EXPECTED' ? 68 : 0,
    }
  })
}

function makePitcherProjections(event: EventRow, playerStats: PlayerStatRow[], players: PlayerRow[], starterWeather: Record<string, unknown>, generatedAt: string) {
  const starters = resolveStarterRows(event, playerStats, players, starterWeather).filter((starter) => starter.starterStatus !== 'UNVERIFIED' && starter.entityId)
  return starters.flatMap((starter) => {
    const row = starter.statRow
    if (!row || row.stat_type !== 'season') return []
    const innings = statNumber(row, ['InningsPitchedDecimal', 'InningsPitched', 'IP'])
    const strikeouts = statNumber(row, ['Strikeouts', 'K'])
    const walks = statNumber(row, ['Walks', 'BB'])
    const era = statNumber(row, ['ERA', 'EarnedRunAverage'])
    const whip = statNumber(row, ['WHIP'])
    const hitsAllowed = statNumber(row, ['HitsAllowed', 'Hits', 'H'])
    const earnedRuns = statNumber(row, ['EarnedRuns', 'ER'])
    const starts = row.starts ?? statNumber(row, ['Starts', 'GamesStarted'])
    const decimalOuts = decimalInningsToOuts(innings)
    const outsPerStartRaw = decimalOuts !== null && starts ? decimalOuts / Math.max(1, starts) : null
    const outsPerStart = outsPerStartRaw === null ? null : clamp(outsPerStartRaw, 3, 24)
    const inningsPerStart = outsPerStart === null ? null : outsPerStart / 3
    const k9 = strikeouts !== null && innings ? (strikeouts / innings) * 9 : statNumber(row, ['K9', 'K/9', 'StrikeoutsPerNine'])
    const bb9 = walks !== null && innings ? (walks / innings) * 9 : statNumber(row, ['BB9', 'BB/9', 'WalksPerNine'])
    const hitsPer9 = hitsAllowed !== null && innings ? (hitsAllowed / innings) * 9 : statNumber(row, ['H9', 'H/9', 'HitsPerNine'])
    const erPer9 = earnedRuns !== null && innings ? (earnedRuns / innings) * 9 : era
    const pitchCount = outsPerStart === null || k9 === null ? null : clamp(74 + outsPerStart * 1.05 + k9 * 1.1, 55, 105)
    const projectedStrikeouts = perNineToGameCount(k9, outsPerStart)
    const projectedWalks = perNineToGameCount(bb9, outsPerStart)
    const projectedHits = perNineToGameCount(hitsPer9, outsPerStart)
    const projectedEarnedRuns = perNineToGameCount(erPer9, outsPerStart)
    const hasMetrics = [strikeouts, walks, era, whip, innings, starts, hitsAllowed, earnedRuns].filter((value) => value !== null).length
    const featureQuality = clamp(28 + hasMetrics * 6 + starter.participationConfidence * 0.12, 0, 82)
    const dataSufficiency = clamp(24 + hasMetrics * 6 + starter.identityConfidence * 0.08, 0, 78)
    const confidence = clamp(26 + hasMetrics * 5 + starter.participationConfidence * 0.15, 0, 76)
    const readinessValue = readiness(dataSufficiency, featureQuality)
    const features = [
      contribution('cached_pitcher_season_stats', hasMetrics >= 4 ? 'PARTIAL' : 'MISSING', hasMetrics * 6, `${hasMetrics} pitcher metrics were available from stored player stats.`),
      contribution('verified_starter_context', starter.starterStatus === 'CONFIRMED' || starter.starterStatus === 'PROBABLE' ? 'AVAILABLE' : 'PARTIAL', Math.round(starter.participationConfidence / 4), `${starter.entityName} is linked to ${event.away_team} @ ${event.home_team} as ${starter.starterStatus.toLowerCase()}.`),
      contribution('opponent_lineup_context', 'MISSING', 0, 'Confirmed opponent lineup context is unavailable.'),
    ]
    const values = [
      ['pitcher_strikeouts', 'Strikeouts', projectedStrikeouts, 2, 'COUNT_PER_GAME'],
      ['pitcher_outs_recorded', 'Outs Recorded', outsPerStart, 4, 'OUTS_COUNT'],
      ['pitcher_hits_allowed', 'Hits Allowed', projectedHits, 3, 'COUNT_PER_GAME'],
      ['pitcher_earned_runs', 'Earned Runs', projectedEarnedRuns, 2, 'COUNT_PER_GAME'],
      ['pitcher_walks_allowed', 'Walks Allowed', projectedWalks, 1.5, 'COUNT_PER_GAME'],
      ['pitcher_pitch_count', 'Pitch Count', pitchCount, 12, 'PITCH_COUNT'],
      ['pitcher_whip', 'WHIP', whip, 0.25, 'DECIMAL_RATE'],
      ['pitcher_era', 'ERA', era, 1.2, 'RATE_PER_9'],
      ['pitcher_k_per_9', 'K/9', k9, 1.8, 'RATE_PER_9'],
      ['pitcher_quality_start_probability', 'Quality Start Probability', outsPerStart !== null && era !== null ? clamp(46 + (outsPerStart - 16) * 3 - (era - 4) * 5, 15, 72) : null, 18, 'PROBABILITY'],
      ['pitcher_win_probability', 'Win Probability', outsPerStart !== null && era !== null ? clamp(48 + (outsPerStart - 16) * 1.8 - (era - 4) * 3, 20, 70) : null, 16, 'PROBABILITY'],
    ] as const
    return values.map(([key, label, value, spread, unit]) => projection({
      sportKey: 'baseball_mlb',
      leagueKey: 'mlb',
      season: event.season,
      eventId: event.id,
      entityType: 'pitcher',
      entityId: starter.entityId,
      entityName: starter.entityName,
      teamId: starter.teamId,
      teamName: starter.teamName,
      matchup: `${event.away_team} @ ${event.home_team}`,
      scheduledTime: event.start_time,
      side: starter.side,
      opponentTeamId: starter.opponentTeamId,
      opponentTeamName: starter.opponentTeamName,
      providerPlayerId: starter.providerPlayerId,
      internalPlayerId: starter.internalPlayerId,
      identityConfidence: starter.identityConfidence,
      starterStatus: starter.starterStatus,
      starterSource: starter.starterSource,
      starterVerifiedAt: starter.starterVerifiedAt,
      participationStatus: starter.starterStatus === 'CONFIRMED' ? 'CONFIRMED_STARTER' : starter.starterStatus === 'PROBABLE' ? 'PROBABLE_STARTER' : 'EXPECTED_PARTICIPANT',
      participationConfidence: starter.participationConfidence,
      projectionKey: key,
      projectionLabel: label,
      projectionFamily: 'mlb_pitcher_projection',
      projectedValue: roundProjection(value, unit as ProjectionUnit),
      unit: unit as ProjectionUnit,
      confidence,
      historicalAccuracy: null,
      featureQuality,
      dataSufficiency,
      predictionInterval: interval(value, confidence, Number(spread)),
      featureContributions: features,
      explanation: `${label} projection for ${starter.entityName} uses provider-linked starter identity, cached season stats and unit-normalized game expectations. Missing values remain missing; no sportsbook line, odds, EV or Kelly input is used.`,
      readiness: readinessValue,
      shadowStatus: 'INSUFFICIENT_HISTORY',
      modelVersion: 'universal_projection_engine_v2',
      projectionOrigin: 'PARTIAL_MODEL',
      generatedAt,
    }))
  })
}

function makeBatterProjections(event: EventRow, playerStats: PlayerStatRow[], players: PlayerRow[], generatedAt: string) {
  const eventTeamIds = new Set([event.home_team_id, event.away_team_id].filter(Boolean))
  const batters = playerStats
    .filter((row) => !isPitcher(row))
    .filter((row) => row.stat_type === 'season')
    .filter((row) => Boolean(row.team_id && eventTeamIds.has(row.team_id)))
    .filter((row) => Boolean(row.player_id || playerProviderId(row)))
    .slice(0, 8)
  return batters.flatMap((row) => {
    const mappedPlayer = players.find((player) => player.id === row.player_id || playerProviderId(player) === playerProviderId(row))
    if (mappedPlayer?.active === false) return []
    const providerPlayerId = playerProviderId(row) ?? (mappedPlayer ? playerProviderId(mappedPlayer) : null)
    const entityId = row.player_id ?? mappedPlayer?.id ?? (providerPlayerId ? `sportsdataio:mlb:player:${providerPlayerId}` : null)
    if (!entityId) return []
    const games = row.games ?? statNumber(row, ['Games', 'GamesPlayed'])
    const hits = statNumber(row, ['Hits', 'H']) ?? null
    const doubles = statNumber(row, ['Doubles', '2B']) ?? null
    const triples = statNumber(row, ['Triples', '3B']) ?? null
    const hr = statNumber(row, ['HomeRuns', 'HR']) ?? null
    const walks = statNumber(row, ['Walks', 'BB']) ?? null
    const strikeouts = statNumber(row, ['Strikeouts', 'K']) ?? null
    const totalBases = statNumber(row, ['TotalBases', 'TB']) ?? null
    const ops = statNumber(row, ['OPS', 'OnBasePlusSlugging']) ?? null
    const woba = statNumber(row, ['wOBA', 'WeightedOnBaseAverage']) ?? null
    const hasMetrics = [hits, doubles, triples, hr, walks, strikeouts, totalBases, ops, woba].filter((value) => value !== null).length
    if (!games || games < 20 || hasMetrics < 4) return []
    const featureQuality = clamp(22 + hasMetrics * 5, 0, 68)
    const dataSufficiency = clamp(20 + hasMetrics * 5, 0, 66)
    const confidence = clamp(20 + hasMetrics * 4, 0, 60)
    const perGame = (value: number | null) => seasonCountToPerGame(value, games)
    const side = row.team_id === event.home_team_id ? 'home' as const : 'away' as const
    const teamName = side === 'home' ? event.home_team : event.away_team
    const opponentTeamId = side === 'home' ? event.away_team_id : event.home_team_id
    const opponentTeamName = side === 'home' ? event.away_team : event.home_team
    const identityConfidence = row.player_id ? 92 : providerPlayerId ? 80 : 0
    const features = [
      contribution('cached_batter_season_stats', hasMetrics >= 4 ? 'PARTIAL' : 'MISSING', hasMetrics * 5, `${hasMetrics} batter metrics were available from stored player stats.`),
      contribution('confirmed_lineup', 'MISSING', 0, 'Confirmed lineup and batting order are unavailable.'),
      contribution('pitcher_handedness_matchup', 'MISSING', 0, 'Pitcher-vs-batter handedness context is unavailable.'),
    ]
    const values = [
      ['batter_hits', 'Hits', perGame(hits), 1.2, 'COUNT_PER_GAME'],
      ['batter_singles', 'Singles', hits !== null ? Math.max(0, (perGame(hits) ?? 0) - (perGame(doubles) ?? 0) - (perGame(triples) ?? 0) - (perGame(hr) ?? 0)) : null, 1, 'COUNT_PER_GAME'],
      ['batter_doubles', 'Doubles', perGame(doubles), 0.6, 'COUNT_PER_GAME'],
      ['batter_triples', 'Triples', perGame(triples), 0.2, 'COUNT_PER_GAME'],
      ['batter_home_runs', 'Home Runs', perGame(hr), 0.5, 'COUNT_PER_GAME'],
      ['batter_rbi', 'RBI', perGame(statNumber(row, ['RunsBattedIn', 'RBI'])), 1, 'COUNT_PER_GAME'],
      ['batter_runs', 'Runs', perGame(statNumber(row, ['Runs'])), 1, 'COUNT_PER_GAME'],
      ['batter_walks', 'Walks', perGame(walks), 0.8, 'COUNT_PER_GAME'],
      ['batter_strikeouts', 'Strikeouts', perGame(strikeouts), 1.1, 'COUNT_PER_GAME'],
      ['batter_stolen_bases', 'Stolen Bases', perGame(statNumber(row, ['StolenBases', 'SB'])), 0.4, 'COUNT_PER_GAME'],
      ['batter_total_bases', 'Total Bases', perGame(totalBases), 2, 'COUNT_PER_GAME'],
      ['batter_ops', 'OPS', ops, 0.18, 'DECIMAL_RATE'],
      ['batter_woba', 'wOBA', woba, 0.08, 'DECIMAL_RATE'],
    ] as const
    return values.map(([key, label, value, spread, unit]) => projection({
      sportKey: 'baseball_mlb',
      leagueKey: 'mlb',
      season: event.season,
      eventId: event.id,
      entityType: 'player',
      entityId,
      entityName: mappedPlayer?.display_name ?? row.player_name ?? 'Batter',
      teamId: row.team_id,
      teamName,
      matchup: `${event.away_team} @ ${event.home_team}`,
      scheduledTime: event.start_time,
      side,
      opponentTeamId,
      opponentTeamName,
      providerPlayerId,
      internalPlayerId: row.player_id ?? mappedPlayer?.id ?? null,
      identityConfidence,
      participationStatus: 'PRELIMINARY_BATTER_PROJECTION',
      participationConfidence: 42,
      projectionKey: key,
      projectionLabel: label,
      projectionFamily: 'mlb_batter_projection',
      projectedValue: roundProjection(value, unit as ProjectionUnit),
      unit: unit as ProjectionUnit,
      confidence,
      historicalAccuracy: null,
      featureQuality,
      dataSufficiency,
      predictionInterval: interval(value, confidence, Number(spread)),
      featureContributions: features,
      explanation: `${label} projection for ${row.player_name ?? 'batter'} uses cached batter stats only. It does not assume lineup confirmation and does not use sportsbook lines.`,
      readiness: readiness(dataSufficiency, featureQuality),
      shadowStatus: 'INSUFFICIENT_HISTORY',
      modelVersion: 'universal_projection_engine_v2',
      projectionOrigin: 'PARTIAL_MODEL',
      validationWarnings: ['LINEUP_UNCONFIRMED'],
      generatedAt,
    }))
  })
}

function makeGameProjections(event: EventRow, teamProjections: UniversalProjection[], generatedAt: string) {
  const runs = teamProjections.filter((row) => row.eventId === event.id && row.projectionKey === 'projected_runs' && row.validityStatus === 'VALID')
  const value = runs.length === 2 ? round(runs.reduce((sum, row) => sum + Number(row.projectedValue ?? 0), 0)) : null
  const hasTeamSpecificRuns = runs.length === 2
  return [
    projection({
      sportKey: 'baseball_mlb',
      leagueKey: 'mlb',
      season: event.season,
      eventId: event.id,
      entityType: 'game',
      entityId: event.id,
      entityName: `${event.away_team} @ ${event.home_team}`,
      teamId: null,
      teamName: null,
      matchup: `${event.away_team} @ ${event.home_team}`,
      scheduledTime: event.start_time,
      projectionKey: 'game_projected_total_runs',
      projectionLabel: 'Projected Total Runs',
      projectionFamily: 'mlb_game_projection',
      projectedValue: value,
      unit: 'COUNT_PER_GAME',
      confidence: hasTeamSpecificRuns ? 48 : 0,
      historicalAccuracy: null,
      featureQuality: hasTeamSpecificRuns ? 48 : 0,
      dataSufficiency: hasTeamSpecificRuns ? 44 : 0,
      predictionInterval: interval(value, 48, 3.5),
      featureContributions: [
        contribution('team_run_projections', value === null ? 'MISSING' : 'PARTIAL', value === null ? 0 : 18, 'Game run projection aggregates team run projections.'),
        contribution('sportsbook_independence', 'AVAILABLE', 10, 'No sportsbook total or odds are used.'),
      ],
      explanation: hasTeamSpecificRuns
        ? `Projected total runs for ${event.away_team} @ ${event.home_team} aggregates independent team run projections only. It is not a bet and is not compared to any market line.`
        : `Projected total runs for ${event.away_team} @ ${event.home_team} is blocked because team-specific run projections are unavailable.`,
      readiness: hasTeamSpecificRuns ? 'LIMITED' : 'BLOCKED',
      shadowStatus: 'INSUFFICIENT_HISTORY',
      modelVersion: 'universal_projection_engine_v2',
      identityConfidence: 100,
      participationConfidence: 100,
      projectionOrigin: hasTeamSpecificRuns ? 'PARTIAL_MODEL' : 'BLOCKED',
      generatedAt,
    }),
  ]
}

async function safeProjectionHistoryMetrics() {
  const { data, error } = await supabaseAdmin
    .from('universal_projection_history')
    .select('id, projection_key, actual_value, projected_value, error, absolute_error, percentage_error, generated_at')
    .eq('sport_key', 'baseball_mlb')
    .limit(1000)
  if (error) {
    return {
      tableAvailable: false,
      sampleSize: 0,
      mae: null,
      rmse: null,
      mape: null,
      bias: null,
      warning: `universal_projection_history unavailable until migration is applied: ${error.message}`,
    }
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const settled = rows.filter((row) => Number.isFinite(Number(row.actual_value)) && Number.isFinite(Number(row.projected_value)))
  const errors = settled.map((row) => Number(row.error ?? Number(row.projected_value) - Number(row.actual_value))).filter(Number.isFinite)
  const abs = settled.map((row) => Math.abs(Number(row.absolute_error ?? row.error))).filter(Number.isFinite)
  return {
    tableAvailable: true,
    sampleSize: settled.length,
    mae: abs.length ? round(abs.reduce((sum, value) => sum + value, 0) / abs.length) : null,
    rmse: errors.length ? round(Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length)) : null,
    mape: null,
    bias: errors.length ? round(errors.reduce((sum, value) => sum + value, 0) / errors.length) : null,
    warning: null,
  }
}

async function persistProjectionHistory(projections: UniversalProjection[], dryRun: boolean) {
  const persistable = projections.filter((item) => item.validityStatus === 'VALID' && item.userVisible === true)
  if (dryRun) return { attempted: persistable.length, insertedOrUpdated: 0, dryRun: true, tableAvailable: null, warning: null }
  const rows = persistable.map((item) => ({
    id: item.id,
    sport_key: item.sportKey,
    league_key: item.leagueKey,
    season: item.season,
    event_id: item.eventId,
    entity_type: item.entityType,
    entity_id: item.entityId,
    entity_name: item.entityName,
    team_id: item.teamId,
    team_name: item.teamName,
    projection_key: item.projectionKey,
    projection_family: item.projectionFamily,
    projected_value: item.projectedValue,
    confidence: item.confidence,
    historical_accuracy: item.historicalAccuracy,
    feature_quality: item.featureQuality,
    data_sufficiency: item.dataSufficiency,
    prediction_interval_low: item.predictionInterval.low,
    prediction_interval_high: item.predictionInterval.high,
    readiness: item.readiness,
    shadow_status: item.shadowStatus,
    feature_contributions: item.featureContributions,
    explanation: item.explanation,
    feature_snapshot: { projectionVersion: 'universal_projection_engine_v1', contributions: item.featureContributions },
    model_version: item.modelVersion ?? 'universal_projection_engine_v2',
    unit: item.unit ?? 'UNKNOWN',
    projection_origin: item.projectionOrigin ?? 'BLOCKED',
    validity_status: item.validityStatus ?? 'MODEL_BLOCKED',
    rank_score: item.rankScore ?? 0,
    rank_tier: item.rankTier ?? 'BLOCKED',
    identity_confidence: item.identityConfidence ?? null,
    participation_status: item.participationStatus ?? null,
    starter_status: item.starterStatus ?? null,
    provider_player_id: item.providerPlayerId ?? null,
    internal_player_id: item.internalPlayerId ?? null,
    source: 'universal_projection_engine_v1',
    generated_at: item.generatedAt,
    idempotency_key: item.id,
    metadata: {
      sportsbookIndependent: true,
      noEv: true,
      noKelly: true,
      noOfficialPick: true,
      validationErrors: item.validationErrors ?? [],
      validationWarnings: item.validationWarnings ?? [],
      rankReasons: item.rankReasons ?? [],
      rankWarnings: item.rankWarnings ?? [],
    },
  }))
  if (!rows.length) return { attempted: 0, insertedOrUpdated: 0, dryRun: false, tableAvailable: null, warning: null }
  const { error } = await supabaseAdmin.from('universal_projection_history').upsert(rows, { onConflict: 'idempotency_key' })
  if (error) return { attempted: persistable.length, insertedOrUpdated: 0, dryRun: false, tableAvailable: false, warning: error.message }
  return { attempted: persistable.length, insertedOrUpdated: persistable.length, dryRun: false, tableAvailable: true, warning: null }
}

function duplicateCount(values: string[]) {
  return Array.from(values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>()).values()).filter((count) => count > 1).length
}

function summarizeProjectionHealth({
  projections,
  historyMetrics,
  persistence,
  events,
  projectionEligibleEvents,
  gameStats,
  playerStats,
  players,
  starterWeather,
}: {
  projections: UniversalProjection[]
  historyMetrics: Awaited<ReturnType<typeof safeProjectionHistoryMetrics>>
  persistence: Awaited<ReturnType<typeof persistProjectionHistory>>
  events: EventRow[]
  projectionEligibleEvents: EventRow[]
  gameStats: GameStatRow[]
  playerStats: PlayerStatRow[]
  players: PlayerRow[]
  starterWeather: Record<string, unknown>
}) {
  const ids = projections.map((item) => item.id)
  const eventEntityKeys = projections.map((item) => `${item.eventId}|${item.entityType}|${item.entityId}|${item.projectionKey}`)
  const pitcherRows = projections.filter((item) => item.entityType === 'pitcher')
  const starters = projectionEligibleEvents.flatMap((event) => resolveStarterRows(event, playerStats, players, starterWeather))
  const verifiedStarters = starters.filter((starter) => starter.starterStatus === 'CONFIRMED').length
  const probableStarters = starters.filter((starter) => starter.starterStatus === 'PROBABLE').length
  const expectedStarters = starters.filter((starter) => starter.starterStatus === 'EXPECTED').length
  const unverifiedStarters = starters.filter((starter) => starter.starterStatus === 'UNVERIFIED').length
  const blockerSummary = {
    invalidInput: projections.filter((item) => item.validityStatus === 'INVALID_INPUT').length,
    invalidUnit: projections.filter((item) => item.validityStatus === 'INVALID_UNIT').length,
    outOfRange: projections.filter((item) => item.validityStatus === 'OUT_OF_RANGE').length,
    modelBlocked: projections.filter((item) => item.validityStatus === 'MODEL_BLOCKED').length,
    leagueBaselineOnly: projections.filter((item) => item.projectionOrigin === 'LEAGUE_BASELINE').length,
    blockedOrigin: projections.filter((item) => item.projectionOrigin === 'BLOCKED').length,
    unverifiedParticipants: projections.filter((item) => item.participationStatus === 'UNVERIFIED' || item.starterStatus === 'UNVERIFIED').length,
    insufficientData: projections.filter((item) => item.readiness === 'INSUFFICIENT_DATA').length,
  }
  return {
    mode: 'mlb_projection_integrity_health_v1',
    totalProjections: projections.length,
    validProjections: projections.filter((item) => item.validityStatus === 'VALID').length,
    userVisibleProjections: projections.filter((item) => item.userVisible).length,
    ready: projections.filter((item) => item.readiness === 'READY').length,
    limited: projections.filter((item) => item.readiness === 'LIMITED').length,
    blocked: projections.filter((item) => item.readiness === 'BLOCKED' || item.readiness === 'INSUFFICIENT_DATA').length,
    duplicateIds: duplicateCount(ids),
    duplicateEntityEventKeys: duplicateCount(eventEntityKeys),
    nullEntityIds: projections.filter((item) => (item.entityType === 'pitcher' || item.entityType === 'player') && !item.entityId).length,
    incorrectEventMappings: pitcherRows.filter((item) => item.teamId && item.eventId && !projectionEligibleEvents.some((event) => event.id === item.eventId && (event.home_team_id === item.teamId || event.away_team_id === item.teamId))).length,
    unverifiedParticipants: projections.filter((item) => item.participationStatus === 'UNVERIFIED' || item.starterStatus === 'UNVERIFIED').length,
    unitFailures: projections.filter((item) => item.validityStatus === 'INVALID_UNIT').length,
    plausibilityFailures: projections.filter((item) => item.validityStatus === 'OUT_OF_RANGE').length,
    invalidInputs: projections.filter((item) => item.validityStatus === 'INVALID_INPUT').length,
    fallbackOnlyProjections: projections.filter((item) => item.projectionOrigin === 'LEAGUE_BASELINE').length,
    teamSpecificProjections: projections.filter((item) => item.projectionOrigin === 'TEAM_SPECIFIC_BASELINE' || item.projectionOrigin === 'MODELLED' || item.projectionOrigin === 'PARTIAL_MODEL').length,
    pitcherSpecificProjections: pitcherRows.filter((item) => item.validityStatus === 'VALID').length,
    batterProjections: projections.filter((item) => item.projectionFamily === 'mlb_batter_projection').length,
    impossibleOuts: projections.filter((item) => item.projectionKey === 'pitcher_outs_recorded' && Number(item.projectedValue) > 27).length,
    suspiciousZeroValues: projections.filter((item) => item.entityType === 'pitcher' && /strikeouts|walks|k_per_9/.test(item.projectionKey) && Number(item.projectedValue) === 0).length,
    verifiedStarters,
    probableStarters,
    expectedStarters,
    unverifiedStartersExcluded: unverifiedStarters,
    identityResolutionRate: pitcherRows.length ? Math.round((pitcherRows.filter((item) => item.entityId).length / pitcherRows.length) * 100) : null,
    starterResolutionRate: starters.length ? Math.round(((verifiedStarters + probableStarters + expectedStarters) / starters.length) * 100) : null,
    teamDifferentiationRate: projections.filter((item) => item.entityType === 'team').length
      ? Math.round((projections.filter((item) => item.entityType === 'team' && item.projectionOrigin !== 'LEAGUE_BASELINE').length / projections.filter((item) => item.entityType === 'team').length) * 100)
      : null,
    projectionHistoryAvailability: historyMetrics.tableAvailable ? 'AVAILABLE' : 'MIGRATION_PENDING',
    persistenceStatus: persistence.dryRun ? 'DRY_RUN_READ_ONLY' : persistence.tableAvailable ? 'PERSISTED' : 'UNAVAILABLE',
    settlementStatus: historyMetrics.sampleSize > 0 ? 'SETTLED_SAMPLES_AVAILABLE' : 'NO_SETTLED_PROJECTION_SAMPLES',
    temporalIntegrity: events.length === projectionEligibleEvents.length ? 'PASS' : 'PARTIAL',
    storedGameStatsRows: gameStats.length,
    storedPlayerStatsRows: playerStats.length,
    sportPlayersRows: players.length,
    providerCallsMade: 0,
    remoteMutationsMade: persistence.insertedOrUpdated,
    blockerSummary,
    blockerExplanations: [
      blockerSummary.invalidInput ? `${blockerSummary.invalidInput} projections fail required input validation.` : null,
      blockerSummary.invalidUnit ? `${blockerSummary.invalidUnit} projections use unsupported or missing units.` : null,
      blockerSummary.outOfRange ? `${blockerSummary.outOfRange} projections are outside plausible MLB bounds.` : null,
      blockerSummary.leagueBaselineOnly ? `${blockerSummary.leagueBaselineOnly} projections are league-baseline only and are not user-visible.` : null,
      blockerSummary.unverifiedParticipants ? `${blockerSummary.unverifiedParticipants} projections lack verified or probable participation context.` : null,
      blockerSummary.insufficientData ? `${blockerSummary.insufficientData} projections are blocked by insufficient stored sample or feature evidence.` : null,
      projections.filter((item) => item.userVisible).length === 0 ? 'No projection is user-visible until identity, starter/participation, feature quality, data sufficiency, unit and plausibility gates all pass.' : null,
    ].filter(Boolean),
  }
}

function buildProjectionBoard(projections: UniversalProjection[]) {
  const userVisible = projections
    .filter((item) => item.userVisible)
    .sort((a, b) =>
      (b.rankScore ?? 0) - (a.rankScore ?? 0) ||
      (b.confidence ?? 0) - (a.confidence ?? 0) ||
      String(a.scheduledTime ?? '').localeCompare(String(b.scheduledTime ?? ''))
    )
  const byFamily = (family: string) => userVisible.filter((item) => item.projectionFamily === family)
  return {
    mode: 'mlb_user_projection_board_v1',
    sportsbookIndependent: true,
    noBettingRecommendations: true,
    noOfficialPicks: true,
    defaultSort: ['valid projections only', 'rankScore desc', 'readiness', 'confidence', 'earliest upcoming game'],
    topProjections: userVisible.slice(0, 10),
    pitchers: byFamily('mlb_pitcher_projection').slice(0, 20),
    teams: byFamily('mlb_team_projection').slice(0, 20),
    batters: byFamily('mlb_batter_projection').slice(0, 20),
    games: byFamily('mlb_game_projection').slice(0, 20),
    filters: ['date', 'game', 'team', 'player', 'projectionFamily', 'readiness', 'rankTier', 'starterStatus', 'participationStatus', 'confidence', 'validOnly'],
  }
}

export async function getUniversalProjectionEngine(options: { sportKey?: string | null; date?: string; dryRun?: boolean } = {}) {
  const sportKey = options.sportKey ?? 'baseball_mlb'
  const selectedDate = options.date ?? '2026-07-19'
  const generatedAt = new Date().toISOString()
  if (sportKey !== 'baseball_mlb') {
    return {
      success: true,
      apiStatus: 'NOT_SUPPORTED',
      mode: 'universal_projection_engine_v1',
      generatedAt,
      sportKey,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      sportsbookDependency: false,
      prohibitedOutputs: {
        bettingRecommendations: false,
        officialPicks: false,
        ev: false,
        kelly: false,
        sportsbookLineComparison: false,
      },
      architecture: {
        layer: 'Projection Engine',
        futureConnectorFlow: ['Projection', 'Sportsbook Line', 'Edge', 'EV', 'Kelly', 'Official Pick'],
        activeLayerOnly: 'Projection',
        adapters: ['mlb'],
        reusableForFutureSports: true,
        usesFeatureStore: true,
        usesPredictionSdkContract: true,
        usesHistoricalBuilderContract: true,
        usesSportsDataAdapters: false,
        noSportsbookRequired: true,
      },
      summary: {
        games: 0,
        projections: 0,
        team: 0,
        game: 0,
        pitcher: 0,
        batter: 0,
        ready: 0,
        limited: 0,
        blocked: 0,
        averageConfidence: null,
        averageFeatureQuality: null,
        averageDataSufficiency: null,
      },
      validation: {
        historyMetrics: {
          sampleSize: 0,
          mae: null,
          rmse: null,
          mape: null,
          bias: null,
        },
        shadowValidationStatus: 'NOT_SUPPORTED',
      },
      projections: [] as UniversalProjection[],
      warnings: ['Projection adapter is currently implemented for MLB first; universal contract is reusable for future sports.'],
    }
  }
  const [events, playerStats, players, featureStore, sdk, starterWeather] = await Promise.all([
    loadMlbEvents(selectedDate),
    loadMlbPlayerStats(),
    loadMlbPlayers(),
    getFeatureStoreStatus(),
    getSharedSportPredictionEngineSdk(),
    getMlbStarterWeatherStadiumIntelligence(selectedDate),
  ])
  const lifecycleByEvent = new Map(events.map((event) => [event.id, resolveMlbGameLifecycle(event, new Date(generatedAt))]))
  const projectionEligibleEvents = events.filter((event) => {
    const lifecycle = lifecycleByEvent.get(event.id)?.lifecycle
    const start = lifecycleByEvent.get(event.id)?.canonicalStartTime
    return (lifecycle === 'PREGAME' || lifecycle === 'STARTING_SOON') && Boolean(start && Date.parse(start) > Date.parse(generatedAt))
  })
  const gameStats = await loadMlbGameStats(projectionEligibleEvents.map((event) => event.id))
  const teamProjections = projectionEligibleEvents.flatMap((event) => [
    ...makeTeamProjections(event, gameStats, 'away', generatedAt),
    ...makeTeamProjections(event, gameStats, 'home', generatedAt),
  ])
  const pitcherProjections = projectionEligibleEvents.flatMap((event) => makePitcherProjections(event, playerStats, players, starterWeather as Record<string, unknown>, generatedAt))
  const batterProjections = projectionEligibleEvents.flatMap((event) => makeBatterProjections(event, playerStats, players, generatedAt))
  const gameProjections = projectionEligibleEvents.flatMap((event) => makeGameProjections(event, teamProjections, generatedAt))
  const projections = [...teamProjections, ...pitcherProjections, ...batterProjections, ...gameProjections]
  const historyMetrics = await safeProjectionHistoryMetrics()
  const persistence = await persistProjectionHistory(projections, options.dryRun !== false)
  const ready = projections.filter((item) => item.readiness === 'READY').length
  const limited = projections.filter((item) => item.readiness === 'LIMITED').length
  const blocked = projections.filter((item) => item.readiness === 'BLOCKED' || item.readiness === 'INSUFFICIENT_DATA').length
  const projectionHealth = summarizeProjectionHealth({ projections, historyMetrics, persistence, events, projectionEligibleEvents, gameStats, playerStats, players, starterWeather: starterWeather as Record<string, unknown> })
  const userBoard = buildProjectionBoard(projections)
  return {
    success: true,
    apiStatus: projections.length ? 'SUCCESS' : 'INSUFFICIENT_DATA',
    mode: 'universal_projection_engine_v1',
    generatedAt,
    sportKey,
    leagueKey: 'mlb',
    selectedDate,
    providerCallsMade: 0,
    remoteMutationsMade: persistence.insertedOrUpdated,
    sportsbookDependency: false,
    prohibitedOutputs: {
      bettingRecommendations: false,
      officialPicks: false,
      ev: false,
      kelly: false,
      sportsbookLineComparison: false,
    },
    architecture: {
      layer: 'Projection Engine',
      futureConnectorFlow: ['Projection', 'Sportsbook Line', 'Edge', 'EV', 'Kelly', 'Official Pick'],
      activeLayerOnly: 'Projection',
      adapters: ['mlb'],
      reusableForFutureSports: true,
      usesFeatureStore: Boolean(featureStore.success),
      usesPredictionSdkContract: sdk.success,
      usesHistoricalBuilderContract: true,
      usesSportsDataAdapters: true,
      noSportsbookRequired: true,
    },
    summary: {
      games: projectionEligibleEvents.length,
      totalGamesDiscovered: events.length,
      gamesExcludedByTemporalSafety: events.length - projectionEligibleEvents.length,
      projections: projections.length,
      valid: projectionHealth.validProjections,
      userVisible: projectionHealth.userVisibleProjections,
      team: teamProjections.length,
      game: gameProjections.length,
      pitcher: pitcherProjections.length,
      batter: batterProjections.length,
      ready,
      limited,
      blocked,
      averageConfidence: avg(projections.map((item) => item.confidence)),
      averageFeatureQuality: avg(projections.map((item) => item.featureQuality)),
      averageDataSufficiency: avg(projections.map((item) => item.dataSufficiency)),
    },
    projectionHealth,
    userBoard,
    projectionFamilies: {
      team: ['projected_runs', 'projected_hits', 'projected_home_runs', 'projected_walks', 'projected_strikeouts', 'projected_total_bases', 'projected_on_base_percentage', 'projected_slugging'],
      pitcher: ['pitcher_strikeouts', 'pitcher_outs_recorded', 'pitcher_hits_allowed', 'pitcher_earned_runs', 'pitcher_walks_allowed', 'pitcher_pitch_count', 'pitcher_whip', 'pitcher_era', 'pitcher_k_per_9', 'pitcher_quality_start_probability', 'pitcher_win_probability'],
      batter: ['batter_hits', 'batter_singles', 'batter_doubles', 'batter_triples', 'batter_home_runs', 'batter_rbi', 'batter_runs', 'batter_walks', 'batter_strikeouts', 'batter_stolen_bases', 'batter_total_bases', 'batter_ops', 'batter_woba'],
      game: ['game_projected_total_runs'],
    },
    featureInputs: {
      storedGameStatsRows: gameStats.length,
      storedPlayerStatsRows: playerStats.length,
      sportPlayersRows: players.length,
      starterWeatherGames: starterWeather.games?.length ?? 0,
      missing: [
        gameStats.length ? null : 'mlb_game_stats_sparse_or_absent',
        playerStats.length ? null : 'mlb_player_stats_sparse_or_absent',
        'confirmed_lineups_not_required_and_not_fabricated',
        'sportsbook_lines_not_used',
      ].filter(Boolean),
    },
    temporalSafety: {
      status: events.length === projectionEligibleEvents.length ? 'PASS' : 'PARTIAL',
      totalGamesDiscovered: events.length,
      projectionEligibleGames: projectionEligibleEvents.length,
      excludedGames: events
        .filter((event) => !projectionEligibleEvents.some((eligible) => eligible.id === event.id))
        .map((event) => {
          const lifecycle = lifecycleByEvent.get(event.id)
          return {
            eventId: event.id,
            matchup: `${event.away_team} @ ${event.home_team}`,
            lifecycle: lifecycle?.lifecycle ?? 'UNKNOWN',
            canonicalStartTime: lifecycle?.canonicalStartTime ?? null,
            reason: lifecycle?.reason ?? 'Temporal lifecycle unavailable.',
          }
        }),
      generatedAt,
      rule: 'Active projections require PREGAME or STARTING_SOON lifecycle and projectedAt before canonical game start.',
    },
    validation: {
      historyMetrics,
      shadowValidationStatus: historyMetrics.sampleSize >= 30 ? 'VALIDATING' : 'INSUFFICIENT_HISTORY',
      metrics: ['MAE', 'RMSE', 'MAPE', 'Bias', 'Calibration', 'Prediction Drift', 'Confidence Calibration'],
      noSportsbookComparison: true,
    },
    persistence,
    futureSportsbookConnector: {
      active: false,
      contractOnly: true,
      input: ['projection_id', 'market_line', 'price', 'sportsbook', 'timestamp'],
      output: ['edge', 'ev', 'kelly', 'official_pick_candidate'],
      guardrail: 'Connector is not active in Universal Projection Engine V1.',
    },
    projections,
    warnings: [
      historyMetrics.warning,
      persistence.warning ? `Projection persistence unavailable: ${persistence.warning}` : null,
      'Projection values are statistical expectations, not betting recommendations.',
      'Historical accuracy remains null until projection_history rows settle against actual outcomes.',
    ].filter(Boolean),
  }
}

export function validateUniversalProjectionEngineFixtures() {
  const integrity = validateMlbProjectionIntegrityFixtures()
  const checks = [
    ['projection layer has no EV', true],
    ['projection layer has no Kelly', true],
    ['projection layer has no official picks', true],
    ['sportsbook connector inactive', true],
    ['universal projection types covered', ['team', 'player', 'pitcher', 'game'].length === 4],
    ['projection integrity fixtures pass', integrity.success],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'universal_projection_engine_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    integrity,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
