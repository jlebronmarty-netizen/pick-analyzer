import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPickEdgeGame } from '@/services/pick-edge-consumer-v1.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ gamePk: string }> }) {
  const id = requestId(request)
  try {
    const { gamePk: rawGamePk } = await params
    const gamePk = Number(rawGamePk)
    if (!Number.isSafeInteger(gamePk) || gamePk <= 0) {
      return apiError({ id, code: 'BAD_REQUEST', message: `Invalid gamePk: ${rawGamePk}`, status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const response = await getPickEdgeGame(gamePk, searchParams.get('date'))
    if (!response.data) {
      return apiError({ id, code: 'NOT_FOUND', message: `MLB game ${gamePk} not found in consumer slate`, status: 404 })
    }
    return apiOk({ success: true, ...response }, id)
  } catch (error) {
    return apiError({
      id,
      code: String(error).includes('INVALID_CONSUMER_DATE') ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown consumer game error'),
      status: String(error).includes('INVALID_CONSUMER_DATE') ? 400 : 500,
    })
  }
}
