import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
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
    return apiOk({
      success: true,
      mode: 'mlb_player_projection_detail_v1',
      generatedAt: data.generatedAt,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      projection,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player projection detail error') })
  }
}
