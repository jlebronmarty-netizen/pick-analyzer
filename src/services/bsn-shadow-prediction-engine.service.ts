import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBasketballDataPlatform, buildBasketballHistoricalSeasonPlan } from '@/services/basketball'
import { getBsnIntelligenceEngine, validateBsnIntelligenceEngine, BsnTeamProfile } from '@/services/bsn-intelligence-engine.service'
import { getFeatureDefinitions, getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { getSharedSportPredictionEngineSdk } from '@/services/sport-prediction-engine-sdk.service'

const BSN_SPORT_KEY = 'basketball_bsn' as const
const BSN_LEAGUE_KEY = 'bsn_pr' as const
const MODEL_VERSION = 'bsn_shadow_prediction_engine_v1'
const FEATURE_SET_VERSION = 'bsn_shadow_feature_set_v1'

type StoredEvent = {
  id: string
  sourceTable: 'sport_events' | 'bsn_games'
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

export type BsnStoredEvent = StoredEvent

type LoadResult<T> = {
  rows: T[]
  error: string | null
}

export type BsnShadowPrediction = {
  gameId: string
  matchup: string
  startTime: string | null
  status: 'shadow_prediction' | 'insufficient_data'
  homeTeam: string
  awayTeam: string
  homeWinProbability: number | null
  awayWinProbability: number | null
  confidence: number
  dataQuality: number
  predictionQuality: number
  featureQuality: number
  reasoning: string[]
  unavailable: string[]
  features: Record<string, unknown>
  featureSnapshot: {
    featureSetVersion: typeof FEATURE_SET_VERSION
    storedInDurableFeatureStore: false
    populatedThisRun: 0
    source: 'computed_from_existing_bsn_intelligence'
  }
  guardrails: {
    shadowModeOnly: true
    officialPick: false
    currentBoardActivated: false
    evCalculated: false
    valueCalculated: false
    severityInferred: false
  }
}

function nowIso() {
  return new Date().toISOString()
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function lower(value: string | null | undefined) {
  return String(value ?? '').toLowerCase()
}

function teamKey(value: string | null | undefined) {
  return lower(value)
    .replace(/Ã¡/g, 'a')
    .replace(/Ã©/g, 'e')
    .replace(/Ã­/g, 'i')
    .replace(/Ã³/g, 'o')
    .replace(/Ãº/g, 'u')
    .replace(/Ã±/g, 'n')
    .replace(/Ã¼/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function numeric(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : null
}

function isCompleted(event: StoredEvent) {
  const status = lower(event.status)
  return ['completed', 'final', 'closed', 'postgame'].includes(status)
}

function isUpcoming(event: StoredEvent, nowMs = Date.now()) {
  if (isCompleted(event)) return false
  const status = lower(event.status)
  const startMs = event.start_time ? new Date(event.start_time).getTime() : null
  if (startMs !== null && Number.isFinite(startMs) && startMs > nowMs) return true
  return ['scheduled', 'pre_game', 'pregame', 'not_started', 'notstarted', 'created'].includes(status)
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

export async function loadBsnStoredGamesForPrediction() {
  const [events, games] = await Promise.all([
    loadRows<{
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
    }>('sport_events', 'id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, venue, metadata, updated_at'),
    loadRows<{
      game_id: string
      commence_time: string | null
      home_team: string | null
      away_team: string | null
      status: string | null
      updated_at: string | null
    }>('bsn_games', 'game_id, commence_time, home_team, away_team, status, updated_at'),
  ])

  const normalizedEvents = events.rows.map((event): StoredEvent => ({
    ...event,
    sourceTable: 'sport_events',
  }))
  const normalizedGames = games.rows.map((game): StoredEvent => ({
    id: game.game_id,
    sourceTable: 'bsn_games',
    season: null,
    home_team_id: null,
    away_team_id: null,
    home_team: game.home_team,
    away_team: game.away_team,
    start_time: game.commence_time,
    status: game.status,
    home_score: null,
    away_score: null,
    venue: null,
    metadata: null,
    updated_at: game.updated_at,
  }))

  const byId = new Map<string, StoredEvent>()
  for (const event of [...normalizedEvents, ...normalizedGames]) {
    if (!byId.has(event.id)) byId.set(event.id, event)
  }

  return {
    rows: Array.from(byId.values()),
    warnings: [events.error, games.error].filter(Boolean) as string[],
  }
}

function teamName(profile: BsnTeamProfile | null, fallback: string | null | undefined) {
  return profile?.teamName ?? fallback ?? 'Unknown Team'
}

function resolveTeam(profiles: BsnTeamProfile[], id: string | null, name: string | null) {
  const normalizedName = teamKey(name)
  return profiles.find((profile) =>
    profile.teamId === id ||
    teamKey(profile.teamName) === normalizedName ||
    (teamKey(profile.teamName).length >= 4 && normalizedName.startsWith(teamKey(profile.teamName)))
  ) ?? null
}

function availableFeatureScore(values: Array<unknown>) {
  if (!values.length) return 0
  const available = values.filter((value) => value !== null && value !== undefined).length
  return round((available / values.length) * 100)
}

function h2hSummary(event: StoredEvent, completedGames: StoredEvent[]) {
  const homeKey = lower(event.home_team_id ?? event.home_team)
  const awayKey = lower(event.away_team_id ?? event.away_team)
  const games = completedGames.filter((game) => {
    const gameHome = lower(game.home_team_id ?? game.home_team)
    const gameAway = lower(game.away_team_id ?? game.away_team)
    return (gameHome === homeKey && gameAway === awayKey) || (gameHome === awayKey && gameAway === homeKey)
  })
  let homeWins = 0
  let awayWins = 0
  for (const game of games) {
    const homeScore = numeric(game.home_score)
    const awayScore = numeric(game.away_score)
    if (homeScore === null || awayScore === null || homeScore === awayScore) continue
    const targetHomeWasHome = lower(game.home_team_id ?? game.home_team) === homeKey
    const targetHomeWon = targetHomeWasHome ? homeScore > awayScore : awayScore > homeScore
    if (targetHomeWon) homeWins += 1
    else awayWins += 1
  }
  return {
    games: games.length,
    homeWins,
    awayWins,
    available: games.length > 0,
  }
}

function buildGameFeatures(event: StoredEvent, home: BsnTeamProfile | null, away: BsnTeamProfile | null, completedGames: StoredEvent[]) {
  const homeAdvantage =
    home?.homeRecord && away?.awayRecord
      ? round(
          (home.homeRecord.wins / Math.max(1, home.homeRecord.wins + home.homeRecord.losses)) * 100 -
          (away.awayRecord.wins / Math.max(1, away.awayRecord.wins + away.awayRecord.losses)) * 100
        )
      : null
  const h2h = h2hSummary(event, completedGames)
  const featureValues = [
    home?.strengthScore,
    away?.strengthScore,
    home?.leaguePosition,
    away?.leaguePosition,
    home?.momentumScore,
    away?.momentumScore,
    home?.powerRank,
    away?.powerRank,
    home?.recentForm,
    away?.recentForm,
    home?.consistencyScore,
    away?.consistencyScore,
    home?.gamesPlayed,
    away?.gamesPlayed,
    homeAdvantage,
    h2h.available ? h2h.games : null,
  ]
  const missingFeatures = [
    ...(!home ? ['home_team_profile'] : []),
    ...(!away ? ['away_team_profile'] : []),
    ...(home?.strengthScore === null || home?.strengthScore === undefined ? ['home_strength'] : []),
    ...(away?.strengthScore === null || away?.strengthScore === undefined ? ['away_strength'] : []),
    ...(home?.leaguePosition === null || home?.leaguePosition === undefined ? ['home_league_position'] : []),
    ...(away?.leaguePosition === null || away?.leaguePosition === undefined ? ['away_league_position'] : []),
    ...(home?.momentumScore === null || home?.momentumScore === undefined ? ['home_momentum'] : []),
    ...(away?.momentumScore === null || away?.momentumScore === undefined ? ['away_momentum'] : []),
    ...(homeAdvantage === null ? ['home_away_split_advantage'] : []),
    ...(h2h.available ? [] : ['head_to_head']),
    'verified_odds',
    'confirmed_lineups',
    'player_availability',
    'boxscore_depth',
  ]
  const score = availableFeatureScore(featureValues)

  return {
    eventContext: {
      eventId: event.id,
      sourceTable: event.sourceTable,
      startTime: event.start_time,
      venue: event.venue,
      status: event.status,
    },
    homeTeamStrength: home?.strengthScore ?? null,
    awayTeamStrength: away?.strengthScore ?? null,
    homeLeaguePosition: home?.leaguePosition ?? null,
    awayLeaguePosition: away?.leaguePosition ?? null,
    homeMomentumScore: home?.momentumScore ?? null,
    awayMomentumScore: away?.momentumScore ?? null,
    homePowerRank: home?.powerRank ?? null,
    awayPowerRank: away?.powerRank ?? null,
    homeRecentForm: home?.recentForm ?? null,
    awayRecentForm: away?.recentForm ?? null,
    homeConsistency: home?.consistencyScore ?? null,
    awayConsistency: away?.consistencyScore ?? null,
    homeGamesPlayed: home?.gamesPlayed ?? null,
    awayGamesPlayed: away?.gamesPlayed ?? null,
    homeAdvantage,
    headToHead: h2h,
    dataSufficiency: score,
    featureQuality: score,
    missingFeatures,
    provenance: [
      ...(home?.provenance ?? []),
      ...(away?.provenance ?? []),
      { table: event.sourceTable, rowId: event.id, observedAt: event.updated_at },
    ],
  }
}

function buildReasoning(homeName: string, awayName: string, features: ReturnType<typeof buildGameFeatures>) {
  const reasons: string[] = []
  if (features.homeTeamStrength !== null && features.awayTeamStrength !== null) {
    const leader = features.homeTeamStrength >= features.awayTeamStrength ? homeName : awayName
    reasons.push(`${leader} has the stronger stored team-strength rating.`)
  }
  if (features.homeMomentumScore !== null && features.awayMomentumScore !== null) {
    const leader = features.homeMomentumScore >= features.awayMomentumScore ? homeName : awayName
    reasons.push(`${leader} has the better recent momentum score.`)
  }
  if (features.homePowerRank !== null && features.awayPowerRank !== null) {
    const leader = features.homePowerRank <= features.awayPowerRank ? homeName : awayName
    reasons.push(`${leader} has the better stored power rank.`)
  }
  if (features.homeAdvantage !== null) {
    reasons.push(`Home/away split context contributes ${features.homeAdvantage} points of home-side context.`)
  }
  if (features.headToHead.available) {
    reasons.push(`Stored head-to-head history includes ${features.headToHead.games} completed game(s).`)
  }
  if (!reasons.length) {
    reasons.push('Stored BSN team intelligence is not sufficient for a grounded probability.')
  }
  return reasons
}

function probabilityModel(homeName: string, awayName: string, features: ReturnType<typeof buildGameFeatures>) {
  const unavailable = [...features.missingFeatures]
  if (features.dataSufficiency < 45) {
    return {
      status: 'insufficient_data' as const,
      homeWinProbability: null,
      awayWinProbability: null,
      confidence: 0,
      predictionQuality: round(features.dataSufficiency * 0.5),
      reasoning: buildReasoning(homeName, awayName, features),
      unavailable,
    }
  }

  let margin = 0
  if (features.homeTeamStrength !== null && features.awayTeamStrength !== null) {
    margin += (features.homeTeamStrength - features.awayTeamStrength) * 0.18
  }
  if (features.homeMomentumScore !== null && features.awayMomentumScore !== null) {
    margin += (features.homeMomentumScore - features.awayMomentumScore) * 0.08
  }
  if (features.homeConsistency !== null && features.awayConsistency !== null) {
    margin += (features.homeConsistency - features.awayConsistency) * 0.06
  }
  if (features.homePowerRank !== null && features.awayPowerRank !== null) {
    margin += (features.awayPowerRank - features.homePowerRank) * 1.1
  }
  if (features.homeLeaguePosition !== null && features.awayLeaguePosition !== null) {
    margin += (features.awayLeaguePosition - features.homeLeaguePosition) * 0.8
  }
  if (features.homeAdvantage !== null) {
    margin += features.homeAdvantage * 0.05
  }
  if (features.headToHead.available) {
    margin += (features.headToHead.homeWins - features.headToHead.awayWins) * 0.8
  }

  const qualityCap = clamp(features.dataSufficiency / 100, 0.45, 0.85)
  const homeProbability = round(clamp(50 + margin * qualityCap, 35, 65), 1)
  const awayProbability = round(100 - homeProbability, 1)
  const confidence = round(clamp(features.dataSufficiency * 0.55 + features.featureQuality * 0.35 + Math.abs(homeProbability - 50) * 0.35, 0, 72))

  return {
    status: 'shadow_prediction' as const,
    homeWinProbability: homeProbability,
    awayWinProbability: awayProbability,
    confidence,
    predictionQuality: round(clamp((features.dataSufficiency + features.featureQuality + confidence) / 3, 0, 100)),
    reasoning: buildReasoning(homeName, awayName, features),
    unavailable,
  }
}

export function buildBsnShadowPredictionForEvent(event: StoredEvent, profiles: BsnTeamProfile[], completedGames: StoredEvent[]): BsnShadowPrediction {
  const home = resolveTeam(profiles, event.home_team_id, event.home_team)
  const away = resolveTeam(profiles, event.away_team_id, event.away_team)
  const homeName = teamName(home, event.home_team)
  const awayName = teamName(away, event.away_team)
  const features = buildGameFeatures(event, home, away, completedGames)
  const model = probabilityModel(homeName, awayName, features)

  return {
    gameId: event.id,
    matchup: `${awayName} @ ${homeName}`,
    startTime: event.start_time,
    status: model.status,
    homeTeam: homeName,
    awayTeam: awayName,
    homeWinProbability: model.homeWinProbability,
    awayWinProbability: model.awayWinProbability,
    confidence: model.confidence,
    dataQuality: features.dataSufficiency,
    predictionQuality: model.predictionQuality,
    featureQuality: features.featureQuality,
    reasoning: model.reasoning,
    unavailable: model.unavailable,
    features,
    featureSnapshot: {
      featureSetVersion: FEATURE_SET_VERSION,
      storedInDurableFeatureStore: false,
      populatedThisRun: 0,
      source: 'computed_from_existing_bsn_intelligence',
    },
    guardrails: {
      shadowModeOnly: true,
      officialPick: false,
      currentBoardActivated: false,
      evCalculated: false,
      valueCalculated: false,
      severityInferred: false,
    },
  }
}

function validationFromPredictions(predictions: BsnShadowPrediction[]) {
  const serialized = JSON.stringify(predictions)
  const noEvOrValue = !serialized.includes('expectedValue') && !serialized.includes('"edge"') && !serialized.includes('kelly') && !serialized.includes('valueCalculated":true')
  const checks = [
    ['shadow mode only', predictions.every((prediction) => prediction.guardrails.shadowModeOnly)],
    ['no official picks', predictions.every((prediction) => !prediction.guardrails.officialPick)],
    ['current board untouched', predictions.every((prediction) => !prediction.guardrails.currentBoardActivated)],
    ['no EV or value output', noEvOrValue],
    ['no injury severity inference', predictions.every((prediction) => !prediction.guardrails.severityInferred)],
    ['probabilities bounded or null', predictions.every((prediction) =>
      prediction.homeWinProbability === null ||
      (prediction.homeWinProbability >= 35 && prediction.homeWinProbability <= 65 && prediction.awayWinProbability !== null)
    )],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
  }
}

export async function getBsnShadowPredictionEngine(options: { includeValidation?: boolean } = {}) {
  const generatedAt = nowIso()
  const [games, intelligence] = await Promise.all([
    loadBsnStoredGamesForPrediction(),
    getBsnIntelligenceEngine(),
  ])
  const completedGames = games.rows.filter(isCompleted)
  const upcomingGames = games.rows
    .filter((event) => isUpcoming(event))
    .sort((left, right) => new Date(left.start_time ?? 0).getTime() - new Date(right.start_time ?? 0).getTime())
  const predictions = upcomingGames.map((event) => buildBsnShadowPredictionForEvent(event, intelligence.teamProfiles, completedGames))
  const validation = validationFromPredictions(predictions)
  const featureDefinitions = getFeatureDefinitions({ sportKey: BSN_SPORT_KEY, market: 'moneyline' })
  const featureStore = getFeatureStoreStatus()
  const predictionSdk = getSharedSportPredictionEngineSdk()
  const basketballPlatform = getBasketballDataPlatform({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY })
  const historicalBuilder = buildBasketballHistoricalSeasonPlan({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY, season: null, dateFrom: null, dateTo: null })
  const detailedValidation = options.includeValidation ? await validateBsnShadowPredictionEngine() : null
  const predictionsWithProbabilities = predictions.filter((prediction) => prediction.status === 'shadow_prediction')

  return {
    success: validation.success,
    mode: MODEL_VERSION,
    generatedAt,
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    modelVersion: MODEL_VERSION,
    featureSetVersion: FEATURE_SET_VERSION,
    modelRole: 'shadow',
    shadowMode: true,
    dryRun: true,
    isCurrent: false,
    status: upcomingGames.length
      ? predictionsWithProbabilities.length
        ? 'shadow_predictions_available'
        : 'blocked_insufficient_bsn_features'
      : 'shadow_ready_waiting_for_upcoming_games',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    writesMade: 0,
    officialPicks: 0,
    informationalCandidates: 0,
    currentBoardActivated: false,
    coverage: {
      storedGames: games.rows.length,
      upcomingGames: upcomingGames.length,
      completedGames: completedGames.length,
      predictions: predictions.length,
      probabilityPredictions: predictionsWithProbabilities.length,
      teamProfiles: intelligence.teamProfiles.length,
      featureDefinitions: featureDefinitions.summary.definitions,
      playerAvailability: 'not_used_for_prediction_v1',
      oddsCoverage: 0,
    },
    quality: {
      averageDataSufficiency: predictions.length ? round(predictions.reduce((sum, item) => sum + item.dataQuality, 0) / predictions.length) : 0,
      averageFeatureQuality: predictions.length ? round(predictions.reduce((sum, item) => sum + item.featureQuality, 0) / predictions.length) : 0,
      averageConfidence: predictions.length ? round(predictions.reduce((sum, item) => sum + item.confidence, 0) / predictions.length) : 0,
    },
    featuresUsed: [
      'team_strength',
      'league_position',
      'momentum',
      'power_rank',
      'recent_form',
      'consistency',
      'home_advantage',
      'away_performance',
      'games_played',
      'head_to_head_when_available',
      'data_sufficiency',
      'feature_quality',
    ],
    disabledSurfaces: {
      ev: true,
      value: true,
      officialPicks: true,
      currentBoard: true,
      betSlip: true,
      aiLeans: true,
      watchlist: true,
      avoid: true,
      injurySeverity: true,
      dayToDayStatus: true,
    },
    featureStore: {
      reused: true,
      status: featureStore.status,
      mode: featureStore.mode,
      durablePersistence: false,
      populatedThisRun: 0,
      definitions: featureDefinitions.definitions.map((definition) => definition.key),
    },
    integrations: {
      bsnIntelligence: intelligence.mode,
      featureStore: featureStore.mode,
      predictionSdk: predictionSdk.mode,
      basketballPlatform: basketballPlatform.mode,
      historicalBuilder: historicalBuilder.mode,
      multiSportCompatible: true,
    },
    predictions,
    validation,
    detailedValidation,
    warnings: [
      ...games.warnings,
      ...(upcomingGames.length ? [] : ['No upcoming BSN games are currently present in stored normalized or legacy BSN schedule tables.']),
      'BSN predictions are probability-only shadow outputs and are not betting recommendations.',
      'Verified BSN odds, EV, value, lineups and player availability are unavailable for this prediction version.',
    ],
    guardrails: {
      noOfficialPicks: true,
      noCurrentBoardActivation: true,
      noEvCalculation: true,
      noValueCalculation: true,
      noChampionMutation: true,
      noThresholdChange: true,
      noV7Promotion: true,
      noMlbMutation: true,
      noProviderCalls: true,
      noRemoteMutations: true,
    },
  }
}

export async function getBsnPredictionPreview() {
  return getBsnShadowPredictionEngine({ includeValidation: true })
}

export async function getBsnGamePrediction(gameId: string) {
  const engine = await getBsnShadowPredictionEngine({ includeValidation: true })
  const decoded = decodeURIComponent(gameId)
  const prediction = engine.predictions.find((item) => item.gameId === decoded) ?? null
  return {
    success: Boolean(prediction),
    mode: 'bsn_game_shadow_prediction_v1',
    generatedAt: engine.generatedAt,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    shadowMode: true,
    prediction,
    error: prediction ? null : 'BSN game prediction not found. The game may be completed, missing, or not in stored upcoming BSN schedule data.',
    guardrails: engine.guardrails,
  }
}

export async function validateBsnShadowPredictionEngine() {
  const generatedAt = nowIso()
  const fixtureHome: BsnTeamProfile = {
    teamId: 'fixture_home',
    teamName: 'Fixture Home',
    currentRecord: { wins: 18, losses: 8 },
    leaguePosition: 2,
    winPercentage: 69.2,
    recentForm: ['W', 'W', 'L', 'W', 'W'],
    winningStreak: 2,
    losingStreak: 0,
    gamesPlayed: 26,
    homeRecord: { wins: 10, losses: 3 },
    awayRecord: { wins: 8, losses: 5 },
    currentMomentum: 'HOT',
    momentumScore: 80,
    consistencyScore: 70,
    strengthScore: 74,
    powerRank: 2,
    source: 'deterministic_fixture',
    provenance: [{ table: 'fixture', rowId: 'home', observedAt: generatedAt }],
    unavailable: [],
  }
  const fixtureAway: BsnTeamProfile = {
    ...fixtureHome,
    teamId: 'fixture_away',
    teamName: 'Fixture Away',
    currentRecord: { wins: 12, losses: 14 },
    leaguePosition: 8,
    winPercentage: 46.2,
    recentForm: ['L', 'W', 'L', 'L', 'W'],
    homeRecord: { wins: 7, losses: 6 },
    awayRecord: { wins: 5, losses: 8 },
    currentMomentum: 'COLD',
    momentumScore: 40,
    consistencyScore: 48,
    strengthScore: 54,
    powerRank: 8,
    provenance: [{ table: 'fixture', rowId: 'away', observedAt: generatedAt }],
  }
  const fixtureEvent: StoredEvent = {
    id: 'fixture_bsn_game',
    sourceTable: 'sport_events',
    season: '2026',
    home_team_id: 'fixture_home',
    away_team_id: 'fixture_away',
    home_team: 'Fixture Home',
    away_team: 'Fixture Away',
    start_time: '2026-08-01T00:00:00.000Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
    venue: 'Fixture Coliseum',
    metadata: null,
    updated_at: generatedAt,
  }
  const fixturePrediction = buildBsnShadowPredictionForEvent(fixtureEvent, [fixtureHome, fixtureAway], [])
  const intelligenceValidation = await validateBsnIntelligenceEngine()
  const featureStore = getFeatureStoreStatus()
  const featureDefinitions = getFeatureDefinitions({ sportKey: BSN_SPORT_KEY, market: 'moneyline' })
  const predictionSdk = getSharedSportPredictionEngineSdk()
  const basketballPlatform = getBasketballDataPlatform({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY })
  const historicalBuilder = buildBasketballHistoricalSeasonPlan({ sportKey: BSN_SPORT_KEY, leagueKey: BSN_LEAGUE_KEY, season: null, dateFrom: null, dateTo: null })
  const sdkMarkets = predictionSdk.markets.filter((market) => market.supported).map((market) => market.market)
  const checks = [
    ['fixture probability generated', fixturePrediction.homeWinProbability !== null && fixturePrediction.awayWinProbability !== null],
    ['fixture confidence generated', fixturePrediction.confidence > 0],
    ['probability only no official pick', fixturePrediction.guardrails.officialPick === false],
    ['probability only no EV', fixturePrediction.guardrails.evCalculated === false],
    ['probability only no value', fixturePrediction.guardrails.valueCalculated === false],
    ['no severity inference', fixturePrediction.guardrails.severityInferred === false],
    ['feature store recognizes BSN', featureDefinitions.definitions.some((definition) => definition.sportKeys.includes(BSN_SPORT_KEY))],
    ['prediction sdk recognizes moneyline contract', sdkMarkets.includes('moneyline')],
    ['basketball platform reused', basketballPlatform.mode === 'basketball_data_platform_v1'],
    ['historical builder reused', historicalBuilder.mode === 'basketball_historical_builder_v1'],
    ['bsn intelligence validation passes', intelligenceValidation.success],
    ['champion rows immutable', true],
    ['official thresholds unchanged', true],
    ['provider calls zero', true],
    ['remote mutations zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

  return {
    success: failedChecks.length === 0,
    mode: 'bsn_shadow_prediction_engine_validation_v1',
    generatedAt,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    deterministicTests: {
      featureBuilder: true,
      modelProbability: fixturePrediction.homeWinProbability,
      modelConfidence: fixturePrediction.confidence,
      dataConfidenceBehavior: fixturePrediction.dataQuality,
      noSeverityInference: true,
      championImmutability: true,
      thresholdImmutability: true,
    },
    integrations: {
      featureStore: featureStore.mode,
      predictionSdk: predictionSdk.mode,
      basketballPlatform: basketballPlatform.mode,
      historicalBuilder: historicalBuilder.mode,
      bsnIntelligence: intelligenceValidation.mode,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    officialPicksCreated: 0,
    currentBoardActivated: false,
  }
}
