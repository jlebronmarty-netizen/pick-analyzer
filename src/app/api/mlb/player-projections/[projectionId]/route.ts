import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectionId: string }> }) {
  const id = requestId(request)
  try {
    const { projectionId } = await params
    const date = request.nextUrl.searchParams.get('date')
    const data = await getMlbPlayerProjectionEngine({ date, limit: 200 })
    const projection = data.projections.find((item) => item.projectionId === projectionId)
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
    return apiOk({
      success: true,
      mode: 'mlb_player_projection_detail_v1',
      generatedAt: data.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      projection,
      relatedProjections,
      comparison,
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
