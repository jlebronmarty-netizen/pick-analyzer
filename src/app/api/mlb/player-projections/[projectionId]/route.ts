import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildExplainableIntelligence } from '@/services/explainable-intelligence.service'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'
import { getProjectionEvolution } from '@/services/projection-evolution.service'

type StoredProjectionRow = {
  id: string
  sport_key: string | null
  league_key: string | null
  event_id: string | null
  entity_id: string | null
  entity_name: string | null
  team_name: string | null
  projection_key: string | null
  projection_family: string | null
  projected_value: number | null
  confidence: number | null
  feature_quality: number | null
  data_sufficiency: number | null
  prediction_interval_low: number | null
  prediction_interval_high: number | null
  model_version: string | null
  readiness: string | null
  shadow_status: string | null
  starter_status: string | null
  metadata: Record<string, unknown> | null
  generated_at: string | null
  explanation: string | null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function storedProjectionToDetail(row: StoredProjectionRow) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const side: 'home' | 'away' | null = metadata.side === 'home' || metadata.side === 'away' ? metadata.side : null
  return {
    projectionId: row.id,
    sport: row.sport_key ?? 'baseball_mlb',
    league: row.league_key ?? 'mlb',
    eventId: row.event_id,
    playerId: row.entity_id,
    canonicalPlayerId: row.entity_id,
    playerName: row.entity_name ?? 'Unknown player',
    team: row.team_name,
    opponent: null,
    homeOrAway: side,
    projectionType: row.projection_key ?? 'stored_projection',
    projectionLabel: String(metadata.projectionLabel ?? row.projection_key ?? 'Stored Projection'),
    expectedValue: num(row.projected_value),
    medianEstimate: null,
    lowRange: num(row.prediction_interval_low),
    highRange: num(row.prediction_interval_high),
    probabilityDistribution: { method: 'stored_projection_history_row', buckets: [] },
    thresholdProbabilities: [],
    confidence: num(row.confidence) ?? 0,
    dataSufficiency: num(row.data_sufficiency) ?? 0,
    featureQuality: num(row.feature_quality) ?? 0,
    lineupOrStarterStatus: row.starter_status ?? row.readiness ?? row.shadow_status ?? 'STORED_HISTORY',
    lineupStatus: null,
    lineupSource: null,
    battingOrder: null,
    historicalStarts: num(metadata.historicalStarts),
    lineupOrStarterConfidence: null,
    asOfTimestamp: row.generated_at ?? new Date(0).toISOString(),
    cutoffTimestamp: null,
    modelVersion: row.model_version ?? 'stored_projection_history',
    featureVersion: String(metadata.featureVersion ?? 'stored_projection_history'),
    projectionVersion: 'stored_projection_history',
    productionEligibility: false,
    bettingEligibility: false,
    exactBlockerReasons: ['STORED_HISTORY_ROW', 'NO_SPORTSBOOK_LINE', 'NO_SPORTSBOOK_PRICE', 'NO_EV_CALCULATION', 'NO_OFFICIAL_PICK'],
    explanation: row.explanation ?? 'Stored projection history row. No sportsbook line, EV, Kelly or Official Pick is inferred.',
    supportingFeatures: [
      { feature: 'stored_projection_history', status: 'AVAILABLE' as const, contribution: 50, explanation: 'Exact projection id was found in universal_projection_history.' },
      { feature: 'sportsbook_independence', status: 'AVAILABLE' as const, contribution: 10, explanation: 'This detail row does not activate sportsbook prop betting.' },
    ],
    distributionMethod: 'stored_projection_history_row',
    informationalOnly: true,
    noSportsbookComparison: true,
    noBettingRecommendation: true,
    noOfficialPick: true,
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectionId: string }> }) {
  const id = requestId(request)
  try {
    const { projectionId } = await params
    const date = request.nextUrl.searchParams.get('date')
    const data = await getMlbPlayerProjectionEngine({ date, limit: 200 })
    let projection = data.projections.find((item) => item.projectionId === projectionId)
    if (!projection) {
      const stored = await supabaseAdmin
        .from('universal_projection_history')
        .select('id, sport_key, league_key, event_id, entity_id, entity_name, team_name, projection_key, projection_family, projected_value, confidence, feature_quality, data_sufficiency, prediction_interval_low, prediction_interval_high, model_version, readiness, shadow_status, starter_status, metadata, generated_at, explanation')
        .eq('sport_key', 'baseball_mlb')
        .eq('id', projectionId)
        .maybeSingle()
      if (stored.error) throw new Error(`stored player projection read failed: ${stored.error.message}`)
      projection = stored.data ? storedProjectionToDetail(stored.data as StoredProjectionRow) : undefined
    }
    if (!projection) {
      return apiError({ id, code: 'NOT_FOUND', message: 'Projection detail not found.', status: 404 })
    }
    const playerKeys = Array.from(new Set([projection.canonicalPlayerId, projection.playerId].filter(Boolean).map(String)))
    const relatedProjections = data.projections
      .filter((item) =>
        item.projectionId !== projection.projectionId &&
        (
          playerKeys.includes(String(item.canonicalPlayerId ?? '')) ||
          playerKeys.includes(String(item.playerId ?? '')) ||
          item.playerName === projection.playerName
        )
      )
      .slice(0, 24)
    const comparison = data.projections
      .filter((item) =>
        item.eventId === projection.eventId &&
        item.projectionType === projection.projectionType &&
        item.projectionId !== projection.projectionId
      )
      .sort((left, right) => Number(right.expectedValue ?? -Infinity) - Number(left.expectedValue ?? -Infinity))
      .slice(0, 8)
    const historyResult = playerKeys.length
      ? await supabaseAdmin
        .from('universal_projection_history')
        .select('id, event_id, projection_key, projected_value, actual_value, error, absolute_error, confidence, model_version, readiness, shadow_status, starter_status, generated_at, settled_at')
        .eq('sport_key', 'baseball_mlb')
        .in('entity_id', playerKeys)
        .order('generated_at', { ascending: false })
        .limit(25)
      : { data: [], error: null }
    if (historyResult.error) {
      throw new Error(`player projection history read failed: ${historyResult.error.message}`)
    }
    const performance = data.validation.metricsByFamily?.[projection.projectionType as keyof typeof data.validation.metricsByFamily] ?? null
    const projectionEvolution = await getProjectionEvolution({
      eventId: projection.eventId,
      playerId: projection.canonicalPlayerId ?? projection.playerId,
      limit: 60,
    })
    const supportingFeatures = Array.isArray(projection.supportingFeatures) ? projection.supportingFeatures : []
    const positiveFeatures = supportingFeatures
      .filter((item) => Number(item.contribution ?? 0) > 0)
      .map((item) => item.explanation ?? item.feature)
    const negativeFeatures = [
      ...supportingFeatures.filter((item) => Number(item.contribution ?? 0) < 0).map((item) => item.explanation ?? item.feature),
      ...(projection.exactBlockerReasons ?? []),
    ]
    const explanationContract = buildExplainableIntelligence({
      subject: `${projection.playerName} ${projection.projectionLabel ?? projection.projectionType}`,
      positive: positiveFeatures,
      negative: negativeFeatures,
      neutral: [
        projection.explanation,
        'Player projections are sportsbook-independent and do not create prop EV or Official Picks.',
      ].filter(Boolean),
      unavailable: ['sportsbook prop line', 'sportsbook prop price', 'official prop recommendation'],
      missingData: projection.exactBlockerReasons ?? [],
      blockers: projection.exactBlockerReasons ?? [],
      confidence: projection.confidence,
      featureQuality: projection.featureQuality,
      dataSufficiency: projection.dataSufficiency,
      calibrationStatus: performance ? 'validation_available' : 'validation_unavailable',
      officialEligible: false,
    })
    return apiOk({
      success: true,
      mode: 'mlb_player_projection_detail_v1',
      generatedAt: data.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      projection,
      relatedProjections,
      comparison,
      explainableIntelligence: explanationContract,
      projectionEvolution,
      history: {
        rows: historyResult.data ?? [],
        limit: 25,
        source: 'universal_projection_history_entity_idx',
      },
      performance,
      validation: data.validation,
      settlementAndLearning: data.settlementAndLearning,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player projection detail error') })
  }
}
