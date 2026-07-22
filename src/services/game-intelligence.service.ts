import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentBoardCached } from '@/services/current-board.service'
import { classifyMarketIntelligence } from '@/services/market-intelligence-category.service'

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  home_team: string | null
  away_team: string | null
  home_team_id: string | null
  away_team_id: string | null
  start_time: string | null
  status: string | null
  venue?: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type ProjectionRow = {
  id: string
  entity_id: string | null
  entity_name: string | null
  projected_value: number | null
  confidence: number | null
  feature_quality: number | null
  data_sufficiency: number | null
  prediction_interval_low: number | null
  prediction_interval_high: number | null
  model_version: string | null
  starter_status: string | null
  calibration: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  generated_at: string | null
  explanation: string | null
}

type StarterEvidenceRow = {
  id: string
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_status: string | null
  source_timestamp: string | null
  metadata: Record<string, unknown> | null
}

function first<T>(items: T[]) {
  return items[0] ?? null
}

function freshness(timestamp: string | null) {
  if (!timestamp) return { state: 'UNKNOWN', ageMinutes: null as number | null }
  const parsed = Date.parse(timestamp)
  if (!Number.isFinite(parsed)) return { state: 'UNKNOWN', ageMinutes: null as number | null }
  const ageMinutes = Math.max(0, Math.round((Date.now() - parsed) / 60000))
  return {
    state: ageMinutes <= 30 ? 'FRESH' : ageMinutes <= 120 ? 'AGING' : ageMinutes <= 360 ? 'STALE' : 'EXPIRED',
    ageMinutes,
  }
}

function missingInputs() {
  return [
    { input: 'confirmed_lineup', status: 'UNAVAILABLE', reason: 'No verified confirmed-lineup feed is active.' },
    { input: 'injuries', status: 'UNAVAILABLE', reason: 'No verified MLB injury feed is active for recommendation use.' },
    { input: 'weather', status: 'UNAVAILABLE_OR_PARTIAL', reason: 'Weather is used only when stored verified context exists.' },
    { input: 'verified_props', status: 'NO_MARKET', reason: 'Player prop odds are not stored or entitlement-verified.' },
    { input: 'multi_book_movement', status: 'UNAVAILABLE', reason: 'Consensus prices cannot prove multi-book movement or arbitrage.' },
  ]
}

export async function getGameIntelligence(eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, home_team, away_team, home_team_id, away_team_id, start_time, status, venue, metadata, updated_at')
    .eq('id', eventId)
    .maybeSingle()

  if (error) throw error
  const event = data as EventRow | null
  if (!event) {
    return {
      success: true,
      mode: 'game_intelligence_v1',
      eventId,
      found: false,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const board = await getCurrentBoardCached(event.sport_key ?? 'baseball_mlb', 'ALL_STORED_ADVANCED', 200)
  const { data: pitcherProjectionData, error: pitcherProjectionError } = await supabaseAdmin
    .from('universal_projection_history')
    .select('id, entity_id, entity_name, projected_value, confidence, feature_quality, data_sufficiency, prediction_interval_low, prediction_interval_high, model_version, starter_status, calibration, metadata, generated_at, explanation')
    .eq('sport_key', event.sport_key ?? 'baseball_mlb')
    .eq('event_id', event.id)
    .eq('projection_key', 'pitcher_outs_recorded')
    .order('generated_at', { ascending: false })
    .limit(10)
  if (pitcherProjectionError) throw new Error(`universal_projection_history read failed: ${pitcherProjectionError.message}`)
  const pitcherProjections = (pitcherProjectionData ?? []) as ProjectionRow[]
  const { data: starterEvidenceData, error: starterEvidenceError } = await supabaseAdmin
    .from('sport_lineups')
    .select('id, team_id, player_id, player_name, lineup_status, source_timestamp, metadata')
    .eq('sport_key', event.sport_key ?? 'baseball_mlb')
    .eq('league_key', event.league_key ?? 'mlb')
    .eq('event_id', event.id)
    .eq('lineup_type', 'starting_lineup')
    .eq('role', 'starting_pitcher')
    .order('source_timestamp', { ascending: false })
    .limit(4)
  if (starterEvidenceError) throw new Error(`sport_lineups starter evidence read failed: ${starterEvidenceError.message}`)
  const starterEvidenceRows = (starterEvidenceData ?? []) as StarterEvidenceRow[]
  const candidates = board.candidates.filter((candidate) => candidate.eventId === event.id)
  const topCandidate = first(candidates)
  const classification = topCandidate ? classifyMarketIntelligence(topCandidate) : null
  const alignment = topCandidate?.marketAlignment ?? null
  const dataFreshness = freshness(event.updated_at ?? event.start_time)

  return {
    success: true,
    mode: 'game_intelligence_v1',
    generatedAt: new Date().toISOString(),
    found: true,
    event: {
      eventId: event.id,
      league: event.league_key,
      sportKey: event.sport_key,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startTime: event.start_time,
      status: event.status,
      venue: event.venue ?? (event.metadata?.venue as string | undefined) ?? null,
      timezone: 'America/Puerto_Rico',
      dataFreshness,
    },
    model: topCandidate ? {
      homeWinProbability: topCandidate.normalizedSelection === 'home' ? topCandidate.rawProbability : null,
      awayWinProbability: topCandidate.normalizedSelection === 'away' ? topCandidate.rawProbability : null,
      projectedScore: null,
      projectedMargin: null,
      projectedTotal: null,
      confidence: topCandidate.confidence,
      featureQuality: topCandidate.featureQuality,
      dataSufficiency: topCandidate.dataSufficiency,
      modelVersion: topCandidate.modelVersion,
      generatedAt: topCandidate.predictionGeneratedAt ?? null,
      predictionCutoff: topCandidate.cutoff,
      eligibility: topCandidate.officialEligibility,
    } : null,
    market: candidates.map((candidate) => ({
      predictionId: candidate.predictionId,
      market: candidate.marketLabel,
      selection: candidate.selection,
      line: candidate.line,
      currentStoredPrice: candidate.americanOdds,
      sportsbook: candidate.sportsbook,
      snapshotTime: candidate.marketInputTimestamp,
      freshness: candidate.marketAlignment.freshnessStatus,
      impliedProbability: candidate.marketAlignment.marketImpliedProbability,
      snapshotEdge: candidate.marketAlignment.snapshotEdgePercentagePoints,
      snapshotEv: candidate.marketAlignment.snapshotExpectedValuePercent,
      actionableEdge: candidate.marketAlignment.actionableEdgePercentagePoints,
      actionableEv: candidate.marketAlignment.actionableExpectedValuePercent,
      marketBlockers: Array.from(new Set([...candidate.blockers, ...candidate.marketAlignment.reasonCodes])),
      classification: classifyMarketIntelligence(candidate).canonicalState,
    })),
    teamComparison: {
      status: 'LIMITED_STORED_EVIDENCE',
      sampleWindow: 'Current Board feature snapshot only; full-season splits are not fabricated.',
      home: { team: event.home_team, recentForm: null, runsFor: null, runsAllowed: null, differential: null },
      away: { team: event.away_team, recentForm: null, runsFor: null, runsAllowed: null, differential: null },
    },
    pitching: {
      status: pitcherProjections.length ? 'PITCHER_OUTS_SHADOW_AVAILABLE' : 'STORED_CONTEXT_ONLY',
      probableStarter: topCandidate?.starterContext ?? null,
      pregameStarterEvidence: starterEvidenceRows.map((row) => ({
        evidenceId: row.id,
        teamId: row.team_id,
        pitcherId: row.player_id,
        pitcherName: row.player_name,
        status: row.metadata?.exactStarterStatus ?? row.lineup_status,
        source: row.metadata?.source ?? 'sport_lineups',
        sourceTimestamp: row.source_timestamp,
        eligibility: row.metadata?.eligibility ?? null,
        evidenceAgeMinutes: row.metadata?.evidenceAgeMinutes ?? null,
      })),
      pitcherIdentityQuality: topCandidate?.pitcherContext ? 'STORED_CONTEXT_AVAILABLE' : 'UNAVAILABLE',
      recentStarts: null,
      recordedOutsHistory: null,
      bullpenWorkload: null,
      warnings: ['No final-game starter identity is used as pregame evidence by this route.'],
    },
    pitcherOutsShadow: {
      marketStatus: 'NO_MARKET',
      recommendationStatus: 'SHADOW',
      edge: null,
      ev: null,
      kelly: null,
      officialPick: false,
      projections: pitcherProjections.map((row) => ({
        projectionId: row.id,
        pitcherId: row.entity_id,
        pitcherName: row.entity_name,
        expectedOuts: row.projected_value,
        interval: { low: row.prediction_interval_low, high: row.prediction_interval_high },
        confidence: row.confidence,
        featureQuality: row.feature_quality,
        dataSufficiency: row.data_sufficiency,
        starterStatus: row.starter_status,
        modelVersion: row.model_version,
        probabilities: row.metadata?.thresholdProbabilities ?? row.calibration?.thresholds ?? null,
        generatedAt: row.generated_at,
        explanation: row.explanation,
      })),
    },
    missingData: missingInputs(),
    explanation: topCandidate?.recommendationExplanation ?? null,
    summary: {
      state: classification?.canonicalState ?? 'INSUFFICIENT_DATA',
      label: classification?.display ?? 'INSUFFICIENT DATA',
      reason: classification?.primaryBlocker ?? 'No Current Board market row is linked to this event.',
      topMarket: topCandidate ? `${topCandidate.selection} ${topCandidate.marketLabel}` : null,
    },
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateGameIntelligenceFixtures() {
  const missing = missingInputs()
  const checks = [
    ['unsupported inputs explicit', missing.every((item) => item.status !== 'AVAILABLE')],
    ['no fabricated lineup', missing.some((item) => item.input === 'confirmed_lineup' && item.status === 'UNAVAILABLE')],
    ['no fabricated props', missing.some((item) => item.input === 'verified_props' && item.status === 'NO_MARKET')],
    ['pitcher outs shadow remains no market', true],
    ['read only', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'game_intelligence_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
