import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculateAdaptiveScore } from '@/services/adaptive-scoring.service'
import { getAdaptiveWeightRecommendations } from '@/services/adaptive-weight-engine.service'
import { getModelWeights } from '@/services/model-learning.service'
import { getNbaDataHealth, resolveNbaSeason } from '@/services/nba-data-sync.service'
import { getNbaInjuryLineupConfidenceStatus } from '@/services/nba-injury-lineup-confidence.service'
import { NBA_SPORT_KEY, type NbaPredictionCandidate, validateNbaPredictionCandidates } from '@/services/nba-prediction-validation.service'
import {
  NBA_INPUTS_SHADOW_MODEL_VERSION, buildNbaInputsShadowPredictions,
  type NbaInputEvent, type NbaInputStats, type NbaInputQuote, type NbaInputsShadowPrediction,
} from '@/lib/nba/prediction-inputs-shadow'

function round(value: number, digits = 2) { return Number(value.toFixed(digits)) }

async function loadInputs({ season, limit, asOf }: {
  season: ReturnType<typeof resolveNbaSeason>; limit: number; asOf: string
}) {
  const [eventsResult, statsResult, oddsResult, injuryLineup] = await Promise.all([
    supabaseAdmin.from('sport_events').select('*').eq('sport_key', NBA_SPORT_KEY)
      .eq('season', season.key).eq('status', 'scheduled').gte('start_time', asOf)
      .order('start_time', { ascending: true }).limit(limit),
    supabaseAdmin.from('team_stats').select('*').eq('sport_key', NBA_SPORT_KEY).eq('season', season.startYear),
    supabaseAdmin.from('sports_odds_snapshots').select('*').eq('sport_key', NBA_SPORT_KEY)
      .eq('season', season.key).eq('provider', 'balldontlie')
      .gte('snapshot_time', new Date(Date.parse(asOf) - 30 * 60 * 1000).toISOString())
      .lte('snapshot_time', asOf).order('snapshot_time', { ascending: false }).limit(3000),
    getNbaInjuryLineupConfidenceStatus(),
  ])
  // Partial database reads must not silently become neutral team/price inputs.
  if (eventsResult.error || statsResult.error || oddsResult.error) throw new Error('NBA_INPUTS_SHADOW_READ_FAILED')
  if ((oddsResult.data?.length ?? 0) >= 3000) throw new Error('NBA_INPUTS_SHADOW_QUOTE_WINDOW_TRUNCATED')
  return {
    events: (eventsResult.data ?? []) as NbaInputEvent[], stats: (statsResult.data ?? []) as NbaInputStats[],
    odds: (oddsResult.data ?? []) as NbaInputQuote[], injuryLineup,
  }
}

async function enrichAdaptive(predictions: NbaInputsShadowPrediction[]) {
  const adaptiveWeights = await getAdaptiveWeightRecommendations(NBA_SPORT_KEY).catch(() => null)
  return predictions.map(prediction => {
    const adaptive = calculateAdaptiveScore({ odds: prediction.odds, confidence: prediction.confidence,
      ev: prediction.ev, edge: prediction.edge, smartScore: prediction.smartScore, adaptiveWeights })
    return { ...prediction, adaptiveScore: adaptive.adjusted.adaptiveScore }
  })
}

function buildValidationCandidate(prediction: NbaInputsShadowPrediction, event: NbaInputEvent, generatedAt: string): NbaPredictionCandidate {
  return {
    sport_key: NBA_SPORT_KEY, game_id: prediction.gameId, commence_time: event.start_time,
    home_team: event.home_team, away_team: event.away_team, team: prediction.team, opponent: prediction.opponent,
    market: prediction.market, sportsbook: prediction.sportsbook, odds: prediction.odds,
    implied_probability: prediction.impliedProbability, model_probability: prediction.modelProbability,
    edge: prediction.edge, ev: prediction.ev, confidence: prediction.confidence, recommended_pick: false,
    line: prediction.line, projected_line: prediction.projectedLine, odds_timestamp: prediction.oddsTimestamp,
    generated_at: generatedAt, cutoff_at: prediction.cutoffAt, model_version: prediction.modelVersion,
    feature_snapshot: prediction.featureSnapshot, validation_warnings: prediction.explanation.warnings,
  }
}

export async function generateNbaPredictions({ persist = false, limit = 20 }: { persist?: boolean; limit?: number } = {}) {
  // This entry point used to save rows with generic/default champion metadata. Corrected
  // probabilities belong to a distinct research cohort and must use the explicit SHADOW writer.
  if (persist) throw new Error('NBA_EXPLORATORY_REQUIRES_SHADOW_WRITER')
  const requestedAt = new Date().toISOString(), season = resolveNbaSeason()
  const [{ events, stats, odds, injuryLineup }, learnedWeights] = await Promise.all([
    loadInputs({ season, limit, asOf: requestedAt }), getModelWeights(NBA_SPORT_KEY, {initialize: false}),
  ])
  const generatedAt = new Date().toISOString()
  const evaluations = events.map(event => buildNbaInputsShadowPredictions({
    event, stats, odds, coverage: injuryLineup, learnedWeights, asOf: generatedAt,
  }))
  const unvalidated = await enrichAdaptive(evaluations.flatMap(result => result.predictions))
  const validation = unvalidated.length ? await validateNbaPredictionCandidates(unvalidated.map(prediction =>
    buildValidationCandidate(prediction, events.find(event => event.id === prediction.gameId)!, generatedAt))) : null
  const accepted = new Set(validation?.items.filter(item => item.status === 'valid').map(item =>
    String(item.candidate.feature_snapshot.inputHash)) ?? [])
  const predictions = unvalidated.filter(prediction => accepted.has(prediction.inputHash))
  return {
    success: true, generatedAt, mode: NBA_INPUTS_SHADOW_MODEL_VERSION, modelVersion: NBA_INPUTS_SHADOW_MODEL_VERSION,
    probabilityStatus: 'EXPLORATORY_UNVALIDATED', sportKey: NBA_SPORT_KEY, season: season.key, persisted: false, saved: 0,
    validation: validation ? { checked: validation.checked, valid: validation.valid, skipped: validation.skipped,
      skippedReasons: validation.items.filter(item => item.status === 'skipped').reduce<Record<string, number>>((acc, item) => {
        const key = item.reason ?? 'unknown'; acc[key] = (acc[key] ?? 0) + 1; return acc
      }, {}) } : null,
    inputIssues: evaluations.flatMap((evaluation, index) => evaluation.issues.map(reason => ({ gameId: events[index]!.id, reason }))),
    summary: {
      eventsScanned: events.length, predictionsGenerated: predictions.length, recommended: 0,
      averageFeatureQuality: round(evaluations.reduce((sum, item) => sum + item.featureQualityScore, 0) / Math.max(evaluations.length, 1)),
      averageDataSufficiency: round(evaluations.reduce((sum, item) => sum + item.dataSufficiencyScore, 0) / Math.max(evaluations.length, 1)),
      bestPrediction: [...predictions].sort((a, b) => b.adaptiveScore - a.adaptiveScore || b.ev - a.ev || b.confidence - a.confidence)[0] ?? null,
      injuryFeedStatus: injuryLineup.injuryFeed.status, activeInjuryCount: injuryLineup.injuryFeed.activeInjuryCount,
      unresolvedInjuryPlayers: injuryLineup.injuryFeed.unresolvedPlayerCount, unresolvedInjuryTeams: injuryLineup.injuryFeed.unresolvedTeamCount,
      injuryConfidencePenalty: injuryLineup.confidence.penalty,
      trialInjuryRowsExcluded: injuryLineup.confidence.trialDataExcludedFromProductionConfidence,
      lineupFeedStatus: injuryLineup.lineupFeed.availabilityStatus,
    },
    predictions: predictions.sort((a, b) => b.adaptiveScore - a.adaptiveScore || b.ev - a.ev || b.confidence - a.confidence),
  }
}

export async function getNbaPredictionHealth() {
  const [dataHealth, latestPredictions, injuryLineup] = await Promise.all([
    getNbaDataHealth(),
    supabaseAdmin
      .from('prediction_history')
      .select('id, market, created_at')
      .eq('sport_key', NBA_SPORT_KEY)
      .eq('model_version', NBA_INPUTS_SHADOW_MODEL_VERSION)
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
  if (!['moneyline', 'spread', 'total'].every((market) => markets.has(market))) {
    issues.push('Not all supported NBA research markets have persisted history in the current model version yet.')
  }
  issues.push(...injuryLineup.warnings)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    mode: `${NBA_INPUTS_SHADOW_MODEL_VERSION}_health`,
    modelVersion: NBA_INPUTS_SHADOW_MODEL_VERSION,
    probabilityStatus: 'EXPLORATORY_UNVALIDATED',
    unavailableMarkets: [{ market: 'first_half', reason: 'Period-specific archived inputs and a supported exact contract are required.' }],
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
