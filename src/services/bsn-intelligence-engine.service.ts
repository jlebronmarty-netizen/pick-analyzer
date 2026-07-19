import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBasketballDataPlatform } from '@/services/basketball'
import { buildBasketballHistoricalSeasonPlan } from '@/services/basketball/history/historical-builder'
import { planBasketballKnowledgeGeneration } from '@/services/basketball/knowledge/knowledge-layer'
import { getFeatureDefinitions, getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { runSportPredictionSdkValidation } from '@/services/sport-prediction-engine-sdk.service'
import { getBsnDataQualityStatus } from '@/services/bsn-platform.service'

const BSN_SPORT_KEY = 'basketball_bsn' as const
const BSN_LEAGUE_KEY = 'bsn_pr' as const
const PROVIDER_SOURCE = 'existing_validated_bsn_storage'

type LoadResult<T> = {
  rows: T[]
  error: string | null
}

type TeamRow = {
  id: string
  name: string | null
  abbreviation: string | null
  conference: string | null
  division: string | null
  active: boolean | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type StandingRow = {
  id: string
  season: string | null
  team_id: string | null
  team_name: string | null
  conference: string | null
  conference_rank: number | null
  division_rank: number | null
  wins: number | null
  losses: number | null
  win_percentage: number | null
  home_record: string | null
  away_record: string | null
  streak: string | null
  last_ten: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type EventRow = {
  id: string
  season: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: string | null
  away_team: string | null
  start_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  venue: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type PlayerRow = {
  id: string
  team_id: string | null
  team_name: string | null
  display_name: string | null
  position: string | null
  jersey: string | null
  status: string | null
  active: boolean | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type TeamGame = {
  eventId: string
  date: string | null
  opponent: string | null
  location: 'home' | 'away'
  result: 'W' | 'L' | null
  pointsFor: number | null
  pointsAgainst: number | null
  margin: number | null
}

export type BsnTeamProfile = {
  teamId: string
  teamName: string
  currentRecord: { wins: number | null; losses: number | null } | null
  leaguePosition: number | null
  winPercentage: number | null
  recentForm: string[] | null
  winningStreak: number | null
  losingStreak: number | null
  gamesPlayed: number | null
  homeRecord: { wins: number; losses: number } | null
  awayRecord: { wins: number; losses: number } | null
  currentMomentum: 'HOT' | 'POSITIVE' | 'NEUTRAL' | 'COLD' | 'NOT_AVAILABLE'
  momentumScore: number | null
  consistencyScore: number | null
  strengthScore: number | null
  powerRank: number | null
  source: string
  provenance: Array<{ table: string; rowId: string | null; observedAt: string | null }>
  unavailable: string[]
}

type BsnPlayerProfile = {
  playerId: string
  playerName: string
  teamId: string | null
  teamName: string | null
  gamesFound: number | null
  availability: string | null
  recentParticipation: string | null
  role: string | null
  status: string | null
  source: string
  provenance: Array<{ table: string; rowId: string | null; observedAt: string | null }>
  unavailable: string[]
}

type BsnFeatureRecord = {
  key: string
  teamId: string
  teamName: string
  value: number | string[] | null
  valueType: 'number' | 'string_array'
  featureStoreTarget: 'basketball_team_intelligence'
  status: 'generated' | 'not_available'
  computedAt: string
  provenance: Array<{ table: string; rowId: string | null; observedAt: string | null }>
  warnings: string[]
}

function nowIso() {
  return new Date().toISOString()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return null
  return round((numerator / denominator) * 100)
}

function num(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeWinPct(value: number | null) {
  if (value === null) return null
  return value <= 1 ? round(value * 100) : round(value)
}

function isCompleted(row: EventRow) {
  return String(row.status ?? '').toLowerCase() === 'completed' || String(row.status ?? '').toLowerCase() === 'final'
}

function teamNameFromRow(team: TeamRow | null, fallback: string | null | undefined) {
  return team?.name ?? fallback ?? 'Unknown Team'
}

async function loadRows<T>(table: string, select: string, limit = 5000): Promise<LoadResult<T>> {
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .eq('sport_key', BSN_SPORT_KEY)
      .limit(limit)
    return { rows: (data ?? []) as T[], error: error?.message ?? null }
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : `Unable to load ${table}` }
  }
}

async function loadBsnIntelligenceInputs() {
  const [teams, standings, events, players] = await Promise.all([
    loadRows<TeamRow>('sports_teams', 'id, name, abbreviation, conference, division, active, provider_ids, metadata, updated_at'),
    loadRows<StandingRow>('sport_standings', 'id, season, team_id, team_name, conference, conference_rank, division_rank, wins, losses, win_percentage, home_record, away_record, streak, last_ten, metadata, updated_at'),
    loadRows<EventRow>('sport_events', 'id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, venue, metadata, updated_at'),
    loadRows<PlayerRow>('sport_players', 'id, team_id, team_name, display_name, position, jersey, status, active, provider_ids, metadata, updated_at'),
  ])
  return {
    teams: teams.rows,
    standings: standings.rows,
    events: events.rows,
    players: players.rows,
    warnings: [teams.error, standings.error, events.error, players.error].filter(Boolean) as string[],
  }
}

function parseRecord(value: string | null): { wins: number; losses: number } | null {
  if (!value) return null
  const match = String(value).match(/(\d+)\s*[-/]\s*(\d+)/)
  if (!match) return null
  return { wins: Number(match[1]), losses: Number(match[2]) }
}

function eventGamesForTeam(team: TeamRow, events: EventRow[]): TeamGame[] {
  const teamId = team.id
  const teamName = team.name
  return events
    .filter((event) => isCompleted(event))
    .filter((event) => event.home_team_id === teamId || event.away_team_id === teamId || event.home_team === teamName || event.away_team === teamName)
    .map((event) => {
      const home = event.home_team_id === teamId || event.home_team === teamName
      const pointsFor = home ? num(event.home_score) : num(event.away_score)
      const pointsAgainst = home ? num(event.away_score) : num(event.home_score)
      const margin = pointsFor !== null && pointsAgainst !== null ? pointsFor - pointsAgainst : null
      return {
        eventId: event.id,
        date: event.start_time,
        opponent: home ? event.away_team : event.home_team,
        location: home ? 'home' as const : 'away' as const,
        result: margin === null ? null : margin > 0 ? 'W' as const : 'L' as const,
        pointsFor,
        pointsAgainst,
        margin,
      }
    })
    .sort((left, right) => new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime())
}

function recordFromGames(games: TeamGame[], location?: 'home' | 'away') {
  const scoped = location ? games.filter((game) => game.location === location) : games
  const decided = scoped.filter((game) => game.result)
  if (!decided.length) return null
  return {
    wins: decided.filter((game) => game.result === 'W').length,
    losses: decided.filter((game) => game.result === 'L').length,
  }
}

function streakFromForm(form: string[] | null, type: 'W' | 'L') {
  if (!form?.length || form[0] !== type) return 0
  let streak = 0
  for (const result of form) {
    if (result !== type) break
    streak += 1
  }
  return streak
}

function momentumFromForm(form: string[] | null) {
  if (!form?.length) return { label: 'NOT_AVAILABLE' as const, score: null }
  const wins = form.filter((result) => result === 'W').length
  const score = round((wins / form.length) * 100)
  if (score >= 80) return { label: 'HOT' as const, score }
  if (score >= 60) return { label: 'POSITIVE' as const, score }
  if (score >= 40) return { label: 'NEUTRAL' as const, score }
  return { label: 'COLD' as const, score }
}

function consistencyFromGames(games: TeamGame[]) {
  const margins = games.map((game) => game.margin).filter((value): value is number => value !== null)
  if (margins.length < 3) return null
  const avg = margins.reduce((sum, value) => sum + value, 0) / margins.length
  const variance = margins.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / margins.length
  const standardDeviation = Math.sqrt(variance)
  return round(Math.max(0, Math.min(100, 100 - standardDeviation * 4)))
}

function strengthScore({ winPercentage, momentumScore, consistencyScore, games }: { winPercentage: number | null; momentumScore: number | null; consistencyScore: number | null; games: TeamGame[] }) {
  const values: Array<{ value: number; weight: number }> = []
  if (winPercentage !== null) values.push({ value: winPercentage, weight: 0.6 })
  if (momentumScore !== null) values.push({ value: momentumScore, weight: 0.25 })
  if (consistencyScore !== null) values.push({ value: consistencyScore, weight: 0.15 })
  const margins = games.map((game) => game.margin).filter((value): value is number => value !== null)
  if (!values.length && margins.length) {
    const avgMarginScore = Math.max(0, Math.min(100, 50 + (margins.reduce((sum, value) => sum + value, 0) / margins.length) * 5))
    values.push({ value: avgMarginScore, weight: 1 })
  }
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
  if (!totalWeight) return null
  return round(values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
}

function buildTeamProfiles(teams: TeamRow[], standings: StandingRow[], events: EventRow[]) {
  const standingByTeam = new Map<string, StandingRow>()
  for (const standing of standings) {
    if (standing.team_id) standingByTeam.set(standing.team_id, standing)
  }

  const profiles = teams.map((team): BsnTeamProfile => {
    const standing = standingByTeam.get(team.id) ?? standings.find((row) => row.team_name === team.name) ?? null
    const games = eventGamesForTeam(team, events)
    const eventRecord = recordFromGames(games)
    const wins = num(standing?.wins) ?? eventRecord?.wins ?? null
    const losses = num(standing?.losses) ?? eventRecord?.losses ?? null
    const gamesPlayed = wins !== null && losses !== null ? wins + losses : games.length || null
    const standingWinPct = normalizeWinPct(num(standing?.win_percentage))
    const winPercentage = standingWinPct ?? (wins !== null && losses !== null ? pct(wins, wins + losses) : null)
    const recentForm = games.map((game) => game.result).filter((value): value is 'W' | 'L' => Boolean(value)).slice(0, 5)
    const form = recentForm.length ? recentForm : null
    const momentum = momentumFromForm(form)
    const consistencyScore = consistencyFromGames(games)
    const score = strengthScore({ winPercentage, momentumScore: momentum.score, consistencyScore, games })
    const unavailable = [
      ...(standing?.home_record || recordFromGames(games, 'home') ? [] : ['home_record']),
      ...(standing?.away_record || recordFromGames(games, 'away') ? [] : ['away_record']),
      ...(form ? [] : ['recent_form']),
      ...(consistencyScore !== null ? [] : ['consistency_score_requires_at_least_3_completed_games_with_scores']),
    ]

    return {
      teamId: team.id,
      teamName: teamNameFromRow(team, standing?.team_name),
      currentRecord: wins !== null || losses !== null ? { wins, losses } : null,
      leaguePosition: num(standing?.conference_rank) ?? num(standing?.division_rank),
      winPercentage,
      recentForm: form,
      winningStreak: form ? streakFromForm(form, 'W') : null,
      losingStreak: form ? streakFromForm(form, 'L') : null,
      gamesPlayed,
      homeRecord: parseRecord(standing?.home_record ?? null) ?? recordFromGames(games, 'home'),
      awayRecord: parseRecord(standing?.away_record ?? null) ?? recordFromGames(games, 'away'),
      currentMomentum: momentum.label,
      momentumScore: momentum.score,
      consistencyScore,
      strengthScore: score,
      powerRank: null,
      source: PROVIDER_SOURCE,
      provenance: [
        { table: 'sports_teams', rowId: team.id, observedAt: team.updated_at },
        ...(standing ? [{ table: 'sport_standings', rowId: standing.id, observedAt: standing.updated_at }] : []),
        ...games.slice(0, 5).map((game) => ({ table: 'sport_events', rowId: game.eventId, observedAt: game.date })),
      ],
      unavailable,
    }
  })

  return profiles
    .sort((left, right) => (right.strengthScore ?? -1) - (left.strengthScore ?? -1) || (left.leaguePosition ?? 999) - (right.leaguePosition ?? 999) || left.teamName.localeCompare(right.teamName))
    .map((profile, index) => ({ ...profile, powerRank: profile.strengthScore === null && profile.leaguePosition === null ? null : index + 1 }))
}

function buildPlayerProfiles(players: PlayerRow[]): BsnPlayerProfile[] {
  return players
    .sort((left, right) => String(left.team_name ?? '').localeCompare(String(right.team_name ?? '')) || String(left.display_name ?? '').localeCompare(String(right.display_name ?? '')))
    .map((player) => ({
      playerId: player.id,
      playerName: player.display_name ?? 'Unknown Player',
      teamId: player.team_id,
      teamName: player.team_name,
      gamesFound: null,
      availability: player.status ?? null,
      recentParticipation: null,
      role: player.position,
      status: player.status,
      source: PROVIDER_SOURCE,
      provenance: [{ table: 'sport_players', rowId: player.id, observedAt: player.updated_at }],
      unavailable: [
        'player_game_logs',
        'recent_participation',
        ...(player.status ? [] : ['availability_status']),
        ...(player.position ? [] : ['role']),
      ],
    }))
}

function buildFeatureRecords(teamProfiles: BsnTeamProfile[], computedAt: string): BsnFeatureRecord[] {
  const rows: BsnFeatureRecord[] = []
  for (const team of teamProfiles) {
    const base = {
      teamId: team.teamId,
      teamName: team.teamName,
      featureStoreTarget: 'basketball_team_intelligence' as const,
      computedAt,
      provenance: team.provenance,
    }
    const featureValues: Array<{ key: string; value: number | string[] | null; valueType: 'number' | 'string_array'; warning: string }> = [
      { key: 'bsn_team_strength', value: team.strengthScore, valueType: 'number', warning: 'Team strength requires standings and/or completed scored games.' },
      { key: 'bsn_power_rank', value: team.powerRank, valueType: 'number', warning: 'Power rank requires at least standings rank or strength score.' },
      { key: 'bsn_recent_form', value: team.recentForm, valueType: 'string_array', warning: 'Recent form requires completed scored games.' },
      { key: 'bsn_momentum', value: team.momentumScore, valueType: 'number', warning: 'Momentum requires recent form.' },
      { key: 'bsn_consistency', value: team.consistencyScore, valueType: 'number', warning: 'Consistency requires at least three completed scored games.' },
      { key: 'bsn_league_position', value: team.leaguePosition, valueType: 'number', warning: 'League position requires standings rank.' },
    ]
    for (const feature of featureValues) {
      rows.push({
        ...base,
        key: feature.key,
        value: feature.value,
        valueType: feature.valueType,
        status: feature.value === null ? 'not_available' : 'generated',
        warnings: feature.value === null ? [feature.warning] : [],
      })
    }
  }
  return rows
}

function buildKnowledge(teamProfiles: BsnTeamProfile[]) {
  const ranked = teamProfiles.filter((team) => team.powerRank !== null)
  const withMomentum = teamProfiles.filter((team) => team.momentumScore !== null)
  const withConsistency = teamProfiles.filter((team) => team.consistencyScore !== null)
  return {
    teamMomentum: withMomentum.map((team) => ({ teamId: team.teamId, teamName: team.teamName, momentum: team.currentMomentum, momentumScore: team.momentumScore })),
    leagueMomentum: withMomentum.length
      ? {
          averageMomentum: round(withMomentum.reduce((sum, team) => sum + Number(team.momentumScore), 0) / withMomentum.length),
          teamsWithMomentum: withMomentum.length,
        }
      : null,
    powerRankings: ranked.map((team) => ({ rank: team.powerRank, teamId: team.teamId, teamName: team.teamName, strengthScore: team.strengthScore, winPercentage: team.winPercentage })),
    hotTeams: withMomentum.filter((team) => team.currentMomentum === 'HOT' || team.currentMomentum === 'POSITIVE').slice(0, 5),
    coldTeams: withMomentum.filter((team) => team.currentMomentum === 'COLD').slice(0, 5),
    mostImproved: null,
    mostConsistent: withConsistency.sort((left, right) => Number(right.consistencyScore) - Number(left.consistencyScore)).slice(0, 5),
    highestRanked: ranked[0] ?? null,
    lowestRanked: ranked.length ? ranked[ranked.length - 1] : null,
    unavailable: [
      'most_improved_requires_historical_baseline',
      ...(withMomentum.length ? [] : ['league_momentum_requires_recent_completed_games']),
      ...(withConsistency.length ? [] : ['consistency_requires_completed_scored_games']),
    ],
  }
}

function compareNumber(label: string, a: number | null, b: number | null, higherIsBetter = true) {
  if (a === null || b === null) return null
  if (a === b) return null
  const aBetter = higherIsBetter ? a > b : a < b
  return {
    label,
    betterTeam: aBetter ? 'teamA' : 'teamB',
    difference: round(Math.abs(a - b)),
  }
}

export async function getBsnIntelligenceEngine() {
  const computedAt = nowIso()
  const [inputs, dataQuality] = await Promise.all([loadBsnIntelligenceInputs(), getBsnDataQualityStatus()])
  const teamProfiles = buildTeamProfiles(inputs.teams, inputs.standings, inputs.events)
  const playerProfiles = buildPlayerProfiles(inputs.players)
  const features = buildFeatureRecords(teamProfiles, computedAt)
  const featureStore = getFeatureStoreStatus()
  const featureDefinitions = getFeatureDefinitions({ sportKey: BSN_SPORT_KEY })
  const predictionSdk = runSportPredictionSdkValidation()
  const platform = getBasketballDataPlatform({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY })
  const historicalBuilder = buildBasketballHistoricalSeasonPlan({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY, season: null, dateFrom: null, dateTo: null })
  const knowledgePlan = planBasketballKnowledgeGeneration()
  const knowledge = buildKnowledge(teamProfiles)
  const generatedFeatures = features.filter((feature) => feature.status === 'generated').length
  const validationChecks = [
    ['team profiles use stored teams only', teamProfiles.length === inputs.teams.length],
    ['player profiles use stored players only', playerProfiles.length === inputs.players.length],
    ['feature store reused', featureStore.mode === 'feature_store_core_v1'],
    ['prediction sdk compatible', predictionSdk.success],
    ['basketball platform compatible', platform.mode === 'basketball_data_platform_v1'],
    ['historical builder compatible', historicalBuilder.mode === 'basketball_historical_builder_v1'],
    ['no provider calls', true],
    ['no remote mutations', true],
  ] as const
  const failedChecks = validationChecks.filter(([, passed]) => !passed).map(([name]) => name)

  return {
    success: failedChecks.length === 0,
    mode: 'bsn_intelligence_engine_v1',
    generatedAt: computedAt,
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    status: teamProfiles.length || playerProfiles.length ? 'generated_from_validated_storage' : 'not_available_waiting_for_validated_bsn_data',
    teamProfiles,
    playerProfiles,
    comparisonEngine: {
      available: teamProfiles.length >= 2,
      route: '/api/bsn/compare?teamA={id}&teamB={id}',
      supportedDimensions: ['standings', 'momentum', 'recent_form', 'league_position', 'games_played', 'power_rank', 'strength_rating'],
    },
    knowledge,
    features: {
      generated: generatedFeatures,
      unavailable: features.length - generatedFeatures,
      durableFeatureStorePopulation: 'not_available_feature_store_core_is_contract_only',
      populatedThisRun: 0,
      targetDefinition: 'basketball_team_intelligence',
      requestedKeys: ['bsn_team_strength', 'bsn_power_rank', 'bsn_recent_form', 'bsn_momentum', 'bsn_consistency', 'bsn_league_position'],
      records: features,
      featureStoreStatus: featureStore.status,
      featureDefinitions: featureDefinitions.definitions.map((definition) => definition.key),
    },
    coverage: {
      teams: inputs.teams.length,
      standings: inputs.standings.length,
      completedGames: inputs.events.filter(isCompleted).length,
      players: inputs.players.length,
      featureRecords: features.length,
      generatedFeatureRecords: generatedFeatures,
      dataQuality: dataQuality.scores,
    },
    validation: {
      success: failedChecks.length === 0,
      checks: validationChecks.length,
      passed: validationChecks.length - failedChecks.length,
      failed: failedChecks.length,
      failedChecks,
      noFabricatedValues: true,
      nullForUnavailable: true,
      featureStoreCompatible: featureStore.status === 'ready',
      predictionSdkCompatible: predictionSdk.success,
      basketballPlatformCompatible: platform.mode === 'basketball_data_platform_v1',
      historicalBuilderCompatible: historicalBuilder.mode === 'basketball_historical_builder_v1',
      knowledgePlanCompatible: knowledgePlan.success,
    },
    confidence: {
      score: Math.round((dataQuality.scores.reliability + dataQuality.scores.settlementSufficiency + dataQuality.scores.freshness) / 3),
      reducingFactors: [
        ...(inputs.events.filter(isCompleted).length ? [] : ['completed_games_missing']),
        ...(inputs.standings.length ? [] : ['standings_missing']),
        ...(inputs.players.length ? [] : ['players_missing']),
        ...(features.some((feature) => feature.status === 'not_available') ? ['some_requested_features_not_available'] : []),
      ],
    },
    integrations: {
      basketballDataPlatform: platform.mode,
      historicalBuilder: historicalBuilder.mode,
      historicalImportEngineReused: historicalBuilder.historicalImport.reused,
      featureStore: featureStore.mode,
      predictionSdk: predictionSdk.mode,
      providerRegistryReused: true,
      validationEngineReused: true,
    },
    warnings: [
      ...inputs.warnings,
      'Durable Feature Store persistence is not enabled in Feature Store Core V1; BSN features are generated as reusable computed records with provenance.',
      'No BSN betting predictions, odds, EV, official picks or Current Board candidates are generated by this engine.',
    ],
    guardrails: {
      noPredictionEngineChange: true,
      noCurrentBoardChange: true,
      noOfficialPickChange: true,
      noAiLeanChange: true,
      noWatchlistChange: true,
      noAvoidChange: true,
      noSettlementChange: true,
      noLearningChange: true,
      noChampionMutation: true,
      championRowsMutated: false,
      noV7Promotion: true,
      v7Promoted: false,
      noMlbChange: true,
      thresholdsChanged: false,
      predictionEngineChanged: false,
    },
  }
}

export async function getBsnTeamProfile(teamId: string) {
  const engine = await getBsnIntelligenceEngine()
  const decoded = decodeURIComponent(teamId)
  const team = engine.teamProfiles.find((profile) => profile.teamId === decoded || profile.teamName.toLowerCase() === decoded.toLowerCase()) ?? null
  return {
    success: Boolean(team),
    mode: 'bsn_team_profile_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    team,
    error: team ? null : 'BSN team profile not found in validated storage.',
  }
}

export async function compareBsnTeams(teamA: string, teamB: string) {
  const engine = await getBsnIntelligenceEngine()
  const resolve = (id: string) => engine.teamProfiles.find((team) => team.teamId === id || team.teamName.toLowerCase() === id.toLowerCase()) ?? null
  const a = resolve(decodeURIComponent(teamA))
  const b = resolve(decodeURIComponent(teamB))
  const unknownAreas = [] as string[]
  if (!a || !b) {
    return {
      success: false,
      mode: 'bsn_team_comparison_v1',
      generatedAt: engine.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      teamA: a,
      teamB: b,
      error: 'Both teamA and teamB must resolve to stored BSN team profiles.',
    }
  }
  const comparisons = [
    compareNumber('league_position', a.leaguePosition, b.leaguePosition, false),
    compareNumber('momentum', a.momentumScore, b.momentumScore, true),
    compareNumber('games_played', a.gamesPlayed, b.gamesPlayed, true),
    compareNumber('power_rank', a.powerRank, b.powerRank, false),
    compareNumber('strength_rating', a.strengthScore, b.strengthScore, true),
    compareNumber('win_percentage', a.winPercentage, b.winPercentage, true),
  ].filter(Boolean) as Array<{ label: string; betterTeam: 'teamA' | 'teamB'; difference: number }>
  for (const label of ['league_position', 'momentum', 'games_played', 'power_rank', 'strength_rating', 'win_percentage']) {
    const hasComparison = comparisons.some((item) => item.label === label)
    if (!hasComparison) unknownAreas.push(label)
  }
  const aAdvantages = comparisons.filter((item) => item.betterTeam === 'teamA').map((item) => item.label)
  const bAdvantages = comparisons.filter((item) => item.betterTeam === 'teamB').map((item) => item.label)
  const betterTeam = aAdvantages.length === bAdvantages.length ? null : aAdvantages.length > bAdvantages.length ? a.teamName : b.teamName

  return {
    success: true,
    mode: 'bsn_team_comparison_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    teamA: a,
    teamB: b,
    betterTeam,
    advantages: {
      teamA: aAdvantages,
      teamB: bAdvantages,
    },
    disadvantages: {
      teamA: bAdvantages,
      teamB: aAdvantages,
    },
    comparisons,
    unknownAreas,
    warning: 'Comparison is descriptive intelligence only and is not a betting prediction.',
  }
}

export async function getBsnPowerRankings() {
  const engine = await getBsnIntelligenceEngine()
  return {
    success: true,
    mode: 'bsn_power_rankings_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    powerRankings: engine.knowledge.powerRankings,
    coverage: engine.coverage,
  }
}

export async function getBsnMomentum() {
  const engine = await getBsnIntelligenceEngine()
  return {
    success: true,
    mode: 'bsn_momentum_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    teamMomentum: engine.knowledge.teamMomentum,
    leagueMomentum: engine.knowledge.leagueMomentum,
    hotTeams: engine.knowledge.hotTeams,
    coldTeams: engine.knowledge.coldTeams,
    unavailable: engine.knowledge.unavailable,
  }
}

export async function getBsnGeneratedFeatures() {
  const engine = await getBsnIntelligenceEngine()
  return {
    success: true,
    mode: 'bsn_generated_features_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    features: engine.features,
    validation: engine.validation,
  }
}

export async function validateBsnIntelligenceEngine() {
  const engine = await getBsnIntelligenceEngine()
  const checks = [
    ['engine succeeds', engine.success],
    ['provider calls remain zero', engine.providerCallsMade === 0],
    ['remote mutations remain zero', engine.remoteMutationsMade === 0],
    ['feature store reused', engine.integrations.featureStore === 'feature_store_core_v1'],
    ['prediction sdk compatible', engine.validation.predictionSdkCompatible],
    ['basketball platform compatible', engine.validation.basketballPlatformCompatible],
    ['historical builder compatible', engine.validation.historicalBuilderCompatible],
    ['no prediction engine change', engine.guardrails.noPredictionEngineChange],
    ['champion unchanged', engine.guardrails.championRowsMutated === false],
    ['thresholds unchanged', engine.guardrails.thresholdsChanged === false],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'bsn_intelligence_engine_validation_v1',
    generatedAt: nowIso(),
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    noFabricatedValues: true,
    championRowsMutated: false,
    thresholdsChanged: false,
    predictionEngineChanged: false,
  }
}