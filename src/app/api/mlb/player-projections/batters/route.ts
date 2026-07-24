import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 80)
    const data = await getMlbPlayerProjectionEngine({ date, limit })
    return apiOk({ ...data, projections: data.batterProjections, scope: 'batters' }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB batter projection error') })
  }
}
