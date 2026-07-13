import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculateAdaptiveScore } from '@/services/adaptive-scoring.service'
import { calculateQuarterKellyStake } from '@/services/kelly.service'
import { getAdaptiveWeightRecommendations } from '@/services/adaptive-weight-engine.service'
import { getModelWeights } from '@/services/model-learning.service'
import { getRiskGrade } from '@/services/risk-grade.service'
import { calculateSmartScore } from '@/services/smart-ranking.service'
import { savePredictionHistory } from '@/services/prediction-history.service'
import { getNbaDataHealth, resolveNbaSeason } from '@/services/nba-data-sync.service'
import { getNbaInjuryLineupConfidenceStatus } from '@/services/nba-injury-lineup-confidence.service'
import {
  NBA_LEAGUE_KEY,
  NBA_PREDICTION_MODEL_VERSION,
  NBA_SPORT_KEY,
  type NbaPredictionCandidate,
  validateNbaPredictionCandidates,
} from '@/services/nba-prediction-validation.service'
import { calculatePredictionV4 } from '@/utils/prediction-engine-v4'

type MarketType = 'moneyline' | 'spread' | 'total' | 'first_half'

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
  metadata?: Record<string, unknown> | null
}

type TeamStatsRow = {
  team_name: string
  wins: number
  losses: number
  home_wins: number
  home_losses: number
  away_wins: number
  away_losses: number
  last_5_wins: number
  last_5_losses: number
  last_10_wins: number
  last_10_losses: number
  win_percentage: number | null
  raw_data: Record<string, unknown> | null
}

type OddsRow = {
  event_id: string
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
}

type NbaTeamFeatures = {
  team: string
  wins: number
  losses: number
  winPct: number
  recentWinPct: number
  homeWinPct: number
  awayWinPct: number
  pointsPerGame: number
  pointsAllowed: number
  netRating: number
  dataPoints: number
}

type NbaGameFeatures = {
  event: EventRow
  home: NbaTeamFeatures
  away: NbaTeamFeatures
  featureQualityScore: number
  dataSufficiencyScore: number
  injuryLineupConfidence: Awaited<ReturnType<typeof getNbaInjuryLineupConfidenceStatus>>
  warnings: string[]
}

type NbaPrediction = {
  id: string
  gameId: string
  market: MarketType
  team: string
  opponent: string
  sportsbook: string
  odds: number
  line: number | null
  projectedLine: number
  impliedProbability: number
  modelProbability: number
  edge: number
  ev: number
  confidence: number
  recommendedPick: boolean
  oddsTimestamp: string | null
  featureQualityScore: number
  dataSufficiencyScore: number
  cutoffAt: string
  modelVersion: string
  smartScore: number
  adaptiveScore: number
  kellyPercent: number
  recommendedStake: number
  riskGrade: string
  explanation: {
    summary: string
    reasons: string[]
    warnings: string[]
  }
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function pct(wins: number, losses: number, fallback = 0.5) {
  const total = wins + losses
  return total > 0 ? wins / total : fallback
}

function impliedProbability(americanOdds: number) {
  if (americanOdds > 0) return round((100 / (americanOdds + 100)) * 100)
  return round((Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100)
}

function decimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function expectedValue(modelProbability: number, americanOdds: number) {
  return round(((modelProbability / 100) * decimalOdds(americanOdds) - 1) * 100)
}

function probabilityFromDiff(diff: number, scale = 7.5) {
  return clamp(50 + Math.tanh(diff / scale) * 35, 5, 95)
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildTeamFeatures(
  teamName: string,
  row: TeamStatsRow | undefined,
  isHome: boolean
): NbaTeamFeatures {
  const wins = safeNumber(row?.wins, 0)
  const losses = safeNumber(row?.losses, 0)
  const raw = row?.raw_data ?? {}
  const games = wins + losses
  const pointsPerGame = safeNumber(raw.points_per_game, 114)
  const pointsAllowed = safeNumber(raw.opponent_points_per_game, 114)
  const netRating = safeNumber(
    raw.net_rating,
    pointsPerGame - pointsAllowed
  )
  const recent = pct(
    safeNumber(row?.last_10_wins, 0),
    safeNumber(row?.last_10_losses, 0),
    pct(wins, losses)
  )

  return {
    team: teamName,
    wins,
    losses,
    winPct: safeNumber(row?.win_percentage, pct(wins, losses)),
    recentWinPct: recent,
    homeWinPct: pct(
      safeNumber(row?.home_wins, 0),
      safeNumber(row?.home_losses, 0),
      pct(wins, losses)
    ),
    awayWinPct: pct(
      safeNumber(row?.away_wins, 0),
      safeNumber(row?.away_losses, 0),
      pct(wins, losses)
    ),
    pointsPerGame,
    pointsAllowed,
    netRating,
    dataPoints:
      (games > 0 ? 1 : 0) +
      (raw.points_per_game !== undefined ? 1 : 0) +
      (raw.opponent_points_per_game !== undefined ? 1 : 0) +
      (isHome ? 1 : 1),
  }
}

function isProductionEligibleEvent(event: EventRow) {
  const metadata = event.metadata ?? {}
  return metadata.trial !== true && metadata.production_eligible !== false
}

function projectedScore(features: NbaGameFeatures) {
  const homeBase =
    (features.home.pointsPerGame + features.away.pointsAllowed) / 2
  const awayBase =
    (features.away.pointsPerGame + features.home.pointsAllowed) / 2
  const homeRecent = (features.home.recentWinPct - 0.5) * 4
  const awayRecent = (features.away.recentWinPct - 0.5) * 4

  const home = clamp(homeBase + homeRecent + 1.6, 88, 142)
  const away = clamp(awayBase + awayRecent, 88, 142)

  return {
    home: round(home, 1),
    away: round(away, 1),
    total: round(home + away, 1),
    margin: round(home - away, 1),
    firstHalfHome: round(home * 0.49, 1),
    firstHalfAway: round(away * 0.49, 1),
    firstHalfTotal: round((home + away) * 0.49, 1),
  }
}

function calculateFeatureQuality(features: NbaGameFeatures) {
  const quality = clamp(
    features.dataSufficiencyScore * 0.65 +
      Math.min(features.home.wins + features.home.losses, 25) * 0.7 +
      Math.min(features.away.wins + features.away.losses, 25) * 0.7 -
      features.injuryLineupConfidence.confidence.featureQualityPenalty,
    0,
    100
  )

  return round(quality)
}

function bestOdds(
  odds: OddsRow[],
  eventId: string,
  market: string,
  preferredOutcome?: string
) {
  const rows = odds.filter(
    (row) =>
      row.event_id === eventId &&
      row.market === market &&
      (!preferredOutcome ||
        row.outcome.toLowerCase().includes(preferredOutcome.toLowerCase()))
  )

  return rows.sort((a, b) => Number(b.price ?? -9999) - Number(a.price ?? -9999))[0]
}

function sideFromProjectedMargin(home: string, away: string, margin: number) {
  return margin >= 0 ? { team: home, opponent: away } : { team: away, opponent: home }
}

function buildExplanation({
  prediction,
  features,
  projected,
}: {
  prediction: NbaPrediction
  features: NbaGameFeatures
  projected: ReturnType<typeof projectedScore>
}) {
  const reasons = [
    `Projected score is ${features.event.home_team} ${projected.home}, ${features.event.away_team} ${projected.away}.`,
    `Feature quality is ${features.featureQualityScore}/100 and data sufficiency is ${features.dataSufficiencyScore}/100.`,
    `Injury feed status is ${features.injuryLineupConfidence.injuryFeed.status}; lineup feed status is ${features.injuryLineupConfidence.lineupFeed.availabilityStatus}.`,
    features.injuryLineupConfidence.explanation.confidenceImpact,
    features.injuryLineupConfidence.explanation.trialDataExclusionNotice,
    `Model probability is ${prediction.modelProbability}% versus implied probability ${prediction.impliedProbability}%.`,
    `Expected value is ${prediction.ev}% with ${prediction.edge}% edge.`,
  ]

  if (prediction.recommendedPick) {
    reasons.push('Recommendation passed the confidence, edge and EV thresholds.')
  } else {
    reasons.push('Recommendation remains watch-only under current thresholds.')
  }

  return {
    summary: `${prediction.market.replace('_', ' ')} lean: ${prediction.team} at ${prediction.odds}.`,
    reasons,
    warnings: features.warnings,
  }
}

async function loadInputs({
  season,
  limit,
}: {
  season: ReturnType<typeof resolveNbaSeason>
  limit: number
}) {
  const [{ data: events }, { data: stats }, { data: odds }, injuryLineup] = await Promise.all([
    supabaseAdmin
      .from('sport_events')
      .select('*')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('season', season.key)
      .in('status', ['scheduled', 'live'])
      .order('start_time', { ascending: true })
      .limit(limit),
    supabaseAdmin
      .from('team_stats')
      .select('*')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('season', season.startYear),
    supabaseAdmin
      .from('sports_odds_snapshots')
      .select('*')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('season', season.key)
      .order('snapshot_time', { ascending: false })
      .limit(3000),
    getNbaInjuryLineupConfidenceStatus(),
  ])

  return {
    events: ((events ?? []) as EventRow[]).filter(isProductionEligibleEvent),
    stats: (stats ?? []) as TeamStatsRow[],
    odds: (odds ?? []) as OddsRow[],
    injuryLineup,
  }
}

function buildFeatures(
  event: EventRow,
  stats: TeamStatsRow[],
  injuryLineup: Awaited<ReturnType<typeof getNbaInjuryLineupConfidenceStatus>>
): NbaGameFeatures {
  const homeStats = stats.find((row) => row.team_name === event.home_team)
  const awayStats = stats.find((row) => row.team_name === event.away_team)
  const home = buildTeamFeatures(event.home_team, homeStats, true)
  const away = buildTeamFeatures(event.away_team, awayStats, false)
  const dataSufficiencyScore = round(
    clamp(
      (home.dataPoints + away.dataPoints) * 12.5 -
        injuryLineup.confidence.dataSufficiencyPenalty,
      0,
      100
    )
  )
  const warnings: string[] = []

  if (!homeStats) warnings.push(`Missing team_stats for ${event.home_team}.`)
  if (!awayStats) warnings.push(`Missing team_stats for ${event.away_team}.`)
  warnings.push(...injuryLineup.warnings)

  const base: NbaGameFeatures = {
    event,
    home,
    away,
    featureQualityScore: 0,
    dataSufficiencyScore,
    injuryLineupConfidence: injuryLineup,
    warnings,
  }

  return {
    ...base,
    featureQualityScore: calculateFeatureQuality(base),
  }
}

function recommendation({
  market,
  team,
  opponent,
  oddsRow,
  modelProbability,
  projectedLine,
  line,
  quality,
  warnings,
}: {
  market: MarketType
  team: string
  opponent: string
  oddsRow?: OddsRow
  modelProbability: number
  projectedLine: number
  line: number | null
  quality: number
  warnings: string[]
}): Omit<NbaPrediction, 'id' | 'gameId' | 'explanation'> {
  const odds = Number(oddsRow?.price ?? -110)
  const implied = impliedProbability(odds)
  const edge = round(modelProbability - implied)
  const ev = expectedValue(modelProbability, odds)
  const confidence = round(
    clamp(modelProbability * 0.58 + quality * 0.32 + Math.max(edge, 0) * 0.55, 1, 99)
  )
  const risk = getRiskGrade(confidence, ev, edge)
  const kelly = calculateQuarterKellyStake(1000, modelProbability, odds)
  const smartScore = calculateSmartScore({
    confidence,
    ev,
    edge,
    risk_stars: risk.stars,
    kelly_percent: kelly.kellyPercent,
  })

  const recommendedPick =
    ev >= 3 &&
    edge >= 2.5 &&
    confidence >= 58 &&
    quality >= 45 &&
    !warnings.some((warning) =>
      warning.includes('Missing team_stats') ||
      warning.includes('trial/scrambled') ||
      warning.includes('Trial') ||
      warning.includes('unavailable') ||
      warning.includes('stale')
    )

  return {
    market,
    team,
    opponent,
    sportsbook: oddsRow?.sportsbook ?? 'Model Projection',
    odds,
    line,
    projectedLine,
    impliedProbability: implied,
    modelProbability: round(modelProbability),
    edge,
    ev,
    confidence,
    recommendedPick,
    oddsTimestamp: oddsRow?.snapshot_time ?? null,
    featureQualityScore: quality,
    dataSufficiencyScore: 0,
    cutoffAt: '',
    modelVersion: NBA_PREDICTION_MODEL_VERSION,
    smartScore,
    adaptiveScore: smartScore,
    kellyPercent: kelly.kellyPercent,
    recommendedStake: kelly.stake,
    riskGrade: risk.grade,
  }
}

async function enrichAdaptive(predictions: NbaPrediction[]) {
  const adaptiveWeights = await getAdaptiveWeightRecommendations(NBA_SPORT_KEY).catch(() => null)

  return predictions.map((prediction) => {
    const adaptive = calculateAdaptiveScore({
      odds: prediction.odds,
      confidence: prediction.confidence,
      ev: prediction.ev,
      edge: prediction.edge,
      smartScore: prediction.smartScore,
      adaptiveWeights,
    })

    return {
      ...prediction,
      adaptiveScore: adaptive.adjusted.adaptiveScore,
    }
  })
}

function buildPredictionsForEvent({
  features,
  odds,
  learnedWeights,
}: {
  features: NbaGameFeatures
  odds: OddsRow[]
  learnedWeights: Awaited<ReturnType<typeof getModelWeights>>
}) {
  const event = features.event
  const projected = projectedScore(features)
  const moneylineSide = sideFromProjectedMargin(
    event.home_team,
    event.away_team,
    projected.margin
  )
  const mlOdds = bestOdds(odds, event.id, 'moneyline', moneylineSide.team)
  const spreadOdds =
    bestOdds(odds, event.id, 'spread', moneylineSide.team) ??
    bestOdds(odds, event.id, 'spreads', moneylineSide.team)
  const totalOdds =
    bestOdds(odds, event.id, 'total', 'Over') ??
    bestOdds(odds, event.id, 'totals', 'Over')

  const homeRating =
    features.home.winPct * 60 +
    features.home.recentWinPct * 25 +
    features.home.netRating * 1.5 +
    10
  const awayRating =
    features.away.winPct * 60 +
    features.away.recentWinPct * 25 +
    features.away.netRating * 1.5 +
    10

  const mlBase = calculatePredictionV4(
    {
      teamName: moneylineSide.team,
      opponentName: moneylineSide.opponent,
      americanOdds: Number(mlOdds?.price ?? -110),
      opponentAmericanOdds: -110,
      teamRating: moneylineSide.team === event.home_team ? homeRating : awayRating,
      opponentRating: moneylineSide.team === event.home_team ? awayRating : homeRating,
      isHomeTeam: moneylineSide.team === event.home_team,
    },
    {
      homeAwayAdvantage: moneylineSide.team === event.home_team ? 2 : -1,
      headToHeadAdvantage: projected.margin * 0.25,
      injuryImpact: -features.injuryLineupConfidence.confidence.penalty,
      weatherImpact: 0,
      pitcherAdvantage: 0,
    },
    learnedWeights
  )

  const spreadLine = Number(spreadOdds?.line ?? (moneylineSide.team === event.home_team ? -1.5 : 1.5))
  const totalLine = Number(totalOdds?.line ?? 225.5)
  const firstHalfLine = round(totalLine * 0.49, 1)
  const spreadProb = probabilityFromDiff(
    Math.abs(projected.margin) - Math.abs(spreadLine),
    5
  )
  const totalProb = probabilityFromDiff(projected.total - totalLine, 8)
  const firstHalfProb = probabilityFromDiff(projected.firstHalfTotal - firstHalfLine, 5)

  const raw = [
    recommendation({
      market: 'moneyline',
      team: moneylineSide.team,
      opponent: moneylineSide.opponent,
      oddsRow: mlOdds,
      modelProbability: mlBase.modelProbability,
      projectedLine: projected.margin,
      line: null,
      quality: features.featureQualityScore,
      warnings: features.warnings,
    }),
    recommendation({
      market: 'spread',
      team: moneylineSide.team,
      opponent: moneylineSide.opponent,
      oddsRow: spreadOdds,
      modelProbability: spreadProb,
      projectedLine: projected.margin,
      line: spreadLine,
      quality: features.featureQualityScore,
      warnings: features.warnings,
    }),
    recommendation({
      market: 'total',
      team: projected.total >= totalLine ? 'Over' : 'Under',
      opponent: `${event.away_team} @ ${event.home_team}`,
      oddsRow: totalOdds,
      modelProbability: projected.total >= totalLine ? totalProb : 100 - totalProb,
      projectedLine: projected.total,
      line: totalLine,
      quality: features.featureQualityScore,
      warnings: features.warnings,
    }),
    recommendation({
      market: 'first_half',
      team: projected.firstHalfTotal >= firstHalfLine ? 'First Half Over' : 'First Half Under',
      opponent: `${event.away_team} @ ${event.home_team}`,
      modelProbability:
        projected.firstHalfTotal >= firstHalfLine ? firstHalfProb : 100 - firstHalfProb,
      projectedLine: projected.firstHalfTotal,
      line: firstHalfLine,
      quality: features.featureQualityScore * 0.82,
      warnings: [
        ...features.warnings,
        'First-half market uses projected pace split when provider first-half odds are unavailable.',
      ],
    }),
  ]

  return raw.map((prediction) => {
    const item: NbaPrediction = {
      ...prediction,
      id: `${event.id}:${prediction.market}:${prediction.team}`,
      gameId: event.id,
      dataSufficiencyScore: features.dataSufficiencyScore,
      cutoffAt: new Date().toISOString(),
      explanation: { summary: '', reasons: [], warnings: [] },
    }

    return {
      ...item,
      explanation: buildExplanation({
        prediction: item,
        features,
        projected,
      }),
    }
  })
}

function buildValidationCandidate({
  prediction,
  event,
  generatedAt,
}: {
  prediction: NbaPrediction
  event: EventRow
  generatedAt: string
}): NbaPredictionCandidate {
  return {
    sport_key: NBA_SPORT_KEY,
    game_id: prediction.gameId,
    commence_time: event.start_time,
    home_team: event.home_team,
    away_team: event.away_team,
    team: prediction.team,
    opponent: prediction.opponent,
    market: prediction.market,
    sportsbook: prediction.sportsbook,
    odds: prediction.odds,
    implied_probability: prediction.impliedProbability,
    model_probability: prediction.modelProbability,
    edge: prediction.edge,
    ev: prediction.ev,
    confidence: prediction.confidence,
    recommended_pick: prediction.recommendedPick,
    line: prediction.line,
    projected_line: prediction.projectedLine,
    odds_timestamp: prediction.oddsTimestamp,
    generated_at: generatedAt,
    cutoff_at: prediction.cutoffAt || generatedAt,
    model_version: prediction.modelVersion,
    feature_snapshot: {
      modelVersion: prediction.modelVersion,
      market: prediction.market,
      featureQualityScore: prediction.featureQualityScore,
      dataSufficiencyScore: prediction.dataSufficiencyScore,
      projectedLine: prediction.projectedLine,
      line: prediction.line,
      smartScore: prediction.smartScore,
      adaptiveScore: prediction.adaptiveScore,
      kellyPercent: prediction.kellyPercent,
      recommendedStake: prediction.recommendedStake,
      riskGrade: prediction.riskGrade,
      injuryAvailability: prediction.explanation.warnings.some((warning) =>
        warning.includes('injury') || warning.includes('Injury')
      )
        ? 'warnings_present'
        : 'available',
      injuryConfidencePenalty:
        prediction.explanation.warnings.length > 0
          ? prediction.explanation.warnings.filter((warning) =>
              warning.includes('injury') || warning.includes('Injury') || warning.includes('lineup')
            ).length
          : 0,
      trialDataExcludedFromProductionConfidence: prediction.explanation.warnings.some((warning) =>
        warning.includes('trial/scrambled') || warning.includes('Trial')
      ),
    },
    validation_warnings: prediction.explanation.warnings,
  }
}

export async function generateNbaPredictions({
  persist = false,
  limit = 20,
}: {
  persist?: boolean
  limit?: number
} = {}) {
  const season = resolveNbaSeason()
  const [{ events, stats, odds, injuryLineup }, learnedWeights] = await Promise.all([
    loadInputs({ season, limit }),
    getModelWeights(NBA_SPORT_KEY),
  ])

  const featureSets = events.map((event) => buildFeatures(event, stats, injuryLineup))
  const predictions = await enrichAdaptive(
    featureSets.flatMap((features) =>
      buildPredictionsForEvent({
        features,
        odds,
        learnedWeights,
      })
    )
  )

  const generatedAt = new Date().toISOString()
  const validation =
    predictions.length > 0
      ? await validateNbaPredictionCandidates(
          predictions.map((prediction) => {
            const event = events.find((item) => item.id === prediction.gameId)!
            return buildValidationCandidate({ prediction, event, generatedAt })
          })
        )
      : null

  if (persist && validation && validation.acceptedRows.length > 0) {
    await savePredictionHistory(validation.acceptedRows)
  }

  const recommended = predictions.filter((prediction) => prediction.recommendedPick)

  return {
    success: true,
    generatedAt,
    mode: 'nba_prediction_engine_v1',
    sportKey: NBA_SPORT_KEY,
    season: season.key,
    persisted: persist,
    validation: validation
      ? {
          checked: validation.checked,
          valid: validation.valid,
          skipped: validation.skipped,
          skippedReasons: validation.items
            .filter((item) => item.status === 'skipped')
            .reduce<Record<string, number>>((acc, item) => {
              const key = item.reason ?? 'unknown'
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {}),
        }
      : null,
    saved: persist ? validation?.acceptedRows.length ?? 0 : 0,
    summary: {
      eventsScanned: events.length,
      predictionsGenerated: predictions.length,
      recommended: recommended.length,
      averageFeatureQuality: round(
        featureSets.reduce((sum, item) => sum + item.featureQualityScore, 0) /
          Math.max(featureSets.length, 1)
      ),
      averageDataSufficiency: round(
        featureSets.reduce((sum, item) => sum + item.dataSufficiencyScore, 0) /
          Math.max(featureSets.length, 1)
      ),
      bestPrediction:
        [...predictions].sort(
          (a, b) =>
          b.adaptiveScore - a.adaptiveScore ||
            b.ev - a.ev ||
            b.confidence - a.confidence
        )[0] ?? null,
      injuryFeedStatus: injuryLineup.injuryFeed.status,
      activeInjuryCount: injuryLineup.injuryFeed.activeInjuryCount,
      unresolvedInjuryPlayers: injuryLineup.injuryFeed.unresolvedPlayerCount,
      unresolvedInjuryTeams: injuryLineup.injuryFeed.unresolvedTeamCount,
      injuryConfidencePenalty: injuryLineup.confidence.penalty,
      trialInjuryRowsExcluded:
        injuryLineup.confidence.trialDataExcludedFromProductionConfidence,
      lineupFeedStatus: injuryLineup.lineupFeed.availabilityStatus,
    },
    predictions: predictions.sort(
      (a, b) =>
        b.adaptiveScore - a.adaptiveScore ||
        b.ev - a.ev ||
        b.confidence - a.confidence
    ),
  }
}

export async function getNbaPredictionHealth() {
  const [dataHealth, latestPredictions, injuryLineup] = await Promise.all([
    getNbaDataHealth(),
    supabaseAdmin
      .from('prediction_history')
      .select('id, market, created_at')
      .eq('sport_key', NBA_SPORT_KEY)
      .order('created_at', { ascending: false })
      .limit(100),
    getNbaInjuryLineupConfidenceStatus(),
  ])

  const rows = latestPredictions.data ?? []
  const markets = new Set(rows.map((row) => row.market))
  const issues = [...dataHealth.issues]

  if (dataHealth.coverage.teamStats < 30) {
    issues.push('NBA Prediction Engine needs team_stats coverage for all 30 teams.')
  }
  if (dataHealth.coverage.events === 0) {
    issues.push('No upcoming NBA events are available for prediction generation.')
  }
  if (!['moneyline', 'spread', 'total', 'first_half'].every((market) => markets.has(market))) {
    issues.push('Not all NBA prediction markets have persisted history yet.')
  }
  issues.push(...injuryLineup.warnings)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: 'nba_prediction_engine_v1_health',
    status:
      issues.length === 0
        ? 'healthy'
        : dataHealth.coverage.teamStats >= 30
          ? 'degraded'
          : 'unavailable',
    issues,
    coverage: {
      dataHealth: dataHealth.coverage,
      recentPredictions: rows.length,
      markets: Array.from(markets).sort(),
    },
    injuryLineup,
  }
}
