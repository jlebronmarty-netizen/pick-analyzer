import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropHealth } from '@/services/mlb-player-prop-comparison.service'
import { getMlbPlayerPropRecentIngestionHealth } from '@/services/mlb-player-prop-health.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const market = request.nextUrl.searchParams.get('market')
    const [comparison, ingestion] = await Promise.all([
      getMlbPlayerPropHealth({ date, market }),
      getMlbPlayerPropRecentIngestionHealth(),
    ])
    return apiOk({ ...comparison, ingestion }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop health error') })
  }
}
