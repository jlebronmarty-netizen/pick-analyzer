import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type PredictionEvolutionRow = {
  id: string
  game_id: string | null
  market: string | null
  team: string | null
  line: number | null
  odds: number | null
  model_probability: number | null
  confidence: number | null
  model_version: string | null
  feature_set_version: string | null
  generated_at: string | null
  odds_timestamp: string | null
  commence_time: string | null
  feature_snapshot: Record<string, unknown> | null
}

type PlayerEvolutionRow = {
  id: string
  event_id: string | null
  entity_id: string | null
  entity_name: string | null
  projection_key: string | null
  projected_value: number | null
  confidence: number | null
  model_version: string | null
  readiness: string | null
  starter_status: string | null
  generated_at: string | null
  metadata: Record<string, unknown> | null
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function key(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => part === null || part === undefined ? 'null' : String(part)).join('|')
}

function changeReason(first: Record<string, unknown> | null | undefined, latest: Record<string, unknown> | null | undefined) {
  const firstReason = String(first?.changeReason ?? first?.reasonForChange ?? first?.updateReason ?? '').trim()
  const latestReason = String(latest?.changeReason ?? latest?.reasonForChange ?? latest?.updateReason ?? '').trim()
  return latestReason || firstReason || 'No stored change reason; showing bounded chronological version delta only.'
}

function sorted<T extends { generated_at: string | null }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftTime = left.generated_at ? Date.parse(left.generated_at) : 0
    const rightTime = right.generated_at ? Date.parse(right.generated_at) : 0
    return leftTime - rightTime
  })
}

export async function getProjectionEvolution({
  eventId,
  playerId,
  limit = 60,
}: {
  eventId?: string | null
  playerId?: string | null
  limit?: number
} = {}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const startTime = eventId
    ? await supabaseAdmin
      .from('sport_events')
      .select('start_time')
      .eq('id', eventId)
      .maybeSingle()
    : { data: null, error: null }
  if (startTime.error) throw new Error(`projection evolution event read failed: ${startTime.error.message}`)
  const cutoff = startTime.data?.start_time ? Date.parse(String(startTime.data.start_time)) : Number.POSITIVE_INFINITY

  const gameQuery = eventId
    ? await supabaseAdmin
      .from('prediction_history')
      .select('id, game_id, market, team, line, odds, model_probability, confidence, model_version, feature_set_version, generated_at, odds_timestamp, commence_time, feature_snapshot')
      .eq('sport_key', 'baseball_mlb')
      .eq('game_id', eventId)
      .not('model_probability', 'is', null)
      .order('generated_at', { ascending: true })
      .limit(safeLimit)
    : { data: [], error: null }
  if (gameQuery.error) throw new Error(`prediction evolution read failed: ${gameQuery.error.message}`)

  let playerQuery = { data: [] as unknown[] | null, error: null as { message: string } | null }
  if (eventId || playerId) {
    let query = supabaseAdmin
      .from('universal_projection_history')
      .select('id, event_id, entity_id, entity_name, projection_key, projected_value, confidence, model_version, readiness, starter_status, generated_at, metadata')
      .eq('sport_key', 'baseball_mlb')
      .order('generated_at', { ascending: true })
      .limit(safeLimit)
    if (eventId) query = query.eq('event_id', eventId)
    if (playerId) query = query.eq('entity_id', playerId)
    playerQuery = await query
  }
  if (playerQuery.error) throw new Error(`player projection evolution read failed: ${playerQuery.error.message}`)

  const gameRows = ((gameQuery.data ?? []) as PredictionEvolutionRow[])
    .filter((row) => {
      const generated = row.generated_at ? Date.parse(row.generated_at) : Number.NaN
      const commence = row.commence_time ? Date.parse(row.commence_time) : cutoff
      const safeCutoff = Number.isFinite(cutoff) ? cutoff : commence
      return Number.isFinite(generated) && generated < safeCutoff
    })
  const gameGroups = new Map<string, PredictionEvolutionRow[]>()
  for (const row of gameRows) {
    const groupKey = key([row.game_id, row.market, row.team, row.line])
    gameGroups.set(groupKey, [...(gameGroups.get(groupKey) ?? []), row])
  }
  const gameEvolution = Array.from(gameGroups.values()).map((rows) => {
    const ordered = sorted(rows)
    const initial = ordered[0]
    const latest = ordered[ordered.length - 1]
    return {
      eventId: initial.game_id,
      market: initial.market,
      selection: initial.team,
      line: initial.line,
      versions: ordered.length,
      initialProjection: {
        predictionId: initial.id,
        probability: num(initial.model_probability),
        confidence: num(initial.confidence),
        odds: num(initial.odds),
        generatedAt: initial.generated_at,
        oddsSnapshotTime: initial.odds_timestamp,
        modelVersion: initial.model_version,
        featureSetVersion: initial.feature_set_version,
      },
      latestValidPregameProjection: {
        predictionId: latest.id,
        probability: num(latest.model_probability),
        confidence: num(latest.confidence),
        odds: num(latest.odds),
        generatedAt: latest.generated_at,
        oddsSnapshotTime: latest.odds_timestamp,
        modelVersion: latest.model_version,
        featureSetVersion: latest.feature_set_version,
      },
      change: {
        probabilityDelta: num(latest.model_probability) !== null && num(initial.model_probability) !== null
          ? Number((Number(latest.model_probability) - Number(initial.model_probability)).toFixed(2))
          : null,
        confidenceDelta: num(latest.confidence) !== null && num(initial.confidence) !== null
          ? Number((Number(latest.confidence) - Number(initial.confidence)).toFixed(2))
          : null,
        reason: changeReason(initial.feature_snapshot, latest.feature_snapshot),
      },
      cutoffSafe: true,
    }
  })

  const playerRows = ((playerQuery.data ?? []) as PlayerEvolutionRow[])
    .filter((row) => {
      if (!Number.isFinite(cutoff)) return true
      const generated = row.generated_at ? Date.parse(row.generated_at) : Number.NaN
      return Number.isFinite(generated) && generated < cutoff
    })
  const playerGroups = new Map<string, PlayerEvolutionRow[]>()
  for (const row of playerRows) {
    const groupKey = key([row.event_id, row.entity_id, row.projection_key])
    playerGroups.set(groupKey, [...(playerGroups.get(groupKey) ?? []), row])
  }
  const playerEvolution = Array.from(playerGroups.values()).map((rows) => {
    const ordered = sorted(rows)
    const initial = ordered[0]
    const latest = ordered[ordered.length - 1]
    return {
      eventId: initial.event_id,
      playerId: initial.entity_id,
      playerName: initial.entity_name,
      projectionKey: initial.projection_key,
      versions: ordered.length,
      initialProjection: {
        projectionId: initial.id,
        projectedValue: num(initial.projected_value),
        confidence: num(initial.confidence),
        readiness: initial.readiness,
        starterStatus: initial.starter_status,
        generatedAt: initial.generated_at,
        modelVersion: initial.model_version,
      },
      latestValidPregameProjection: {
        projectionId: latest.id,
        projectedValue: num(latest.projected_value),
        confidence: num(latest.confidence),
        readiness: latest.readiness,
        starterStatus: latest.starter_status,
        generatedAt: latest.generated_at,
        modelVersion: latest.model_version,
      },
      change: {
        projectedValueDelta: num(latest.projected_value) !== null && num(initial.projected_value) !== null
          ? Number((Number(latest.projected_value) - Number(initial.projected_value)).toFixed(2))
          : null,
        confidenceDelta: num(latest.confidence) !== null && num(initial.confidence) !== null
          ? Number((Number(latest.confidence) - Number(initial.confidence)).toFixed(2))
          : null,
        reason: changeReason(initial.metadata, latest.metadata),
      },
      cutoffSafe: true,
    }
  })

  return {
    success: true,
    mode: 'projection_evolution_v1',
    generatedAt: new Date().toISOString(),
    scope: { eventId: eventId ?? null, playerId: playerId ?? null, limit: safeLimit },
    chronologicalOrdering: 'ascending_generated_at',
    postStartEvidenceExcluded: true,
    boundedQueries: true,
    gameProjectionEvolution: gameEvolution,
    playerProjectionEvolution: playerEvolution,
    modelEvidence: {
      productionModelVersion: gameEvolution[0]?.latestValidPregameProjection.modelVersion ?? null,
      shadowModelVersion: playerEvolution[0]?.latestValidPregameProjection.modelVersion ?? null,
      calibrationState: 'reported_by_existing_performance_and_projection_validation_surfaces',
      productionScopeSample: gameRows.length,
      playerProjectionSample: playerRows.length,
      marketSpecificSample: gameEvolution.length,
      cutoffSafeStatus: 'post_start_rows_excluded',
      dataQuality: gameRows.length || playerRows.length ? 'stored_evidence_available' : 'insufficient_stored_evidence',
    },
    performanceLinks: {
      gameMarketPerformance: '/performance',
      projectionFamilyPerformance: '/api/mlb/player-projections/performance',
      playerProjectionPerformance: '/player-projections',
      modelCalibration: '/performance',
    },
    guardrails: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionModelsChanged: false,
      sportsbookPerformanceMergedWithSportsProjectionPerformance: false,
    },
  }
}
