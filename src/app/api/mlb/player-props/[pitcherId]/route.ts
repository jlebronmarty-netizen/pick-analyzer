import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropComparisonForPitcher } from '@/services/mlb-player-prop-comparison.service'

export async function GET(request: NextRequest, context: { params: Promise<{ pitcherId: string }> }) {
  const id = requestId(request)
  try {
    const { pitcherId } = await context.params
    const date = request.nextUrl.searchParams.get('date')
    const result = await getMlbPlayerPropComparisonForPitcher(decodeURIComponent(pitcherId), { date })
    if (!result.comparisons.length) return apiError({ id, code: 'NOT_FOUND', message: 'MLB player prop comparison not found.', status: 404 })
    return apiOk(result, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop detail error') })
  }
}
