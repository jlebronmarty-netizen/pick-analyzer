import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSinglePitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'

export async function GET(request: NextRequest, context: { params: Promise<{ pitcherId: string }> }) {
  const id = requestId(request)
  try {
    const { pitcherId } = await context.params
    const result = await getSinglePitcherProjection(decodeURIComponent(pitcherId), { date: request.nextUrl.searchParams.get('date') })
    if (!result) return apiError({ id, code: 'NOT_FOUND', message: 'MLB pitcher projection not found.', status: 404 })
    return apiOk(result, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projection detail error') })
  }
}
