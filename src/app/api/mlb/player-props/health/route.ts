import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropHealth } from '@/services/mlb-player-prop-comparison.service'
import { getMlbPlayerPropIngestionHealth } from '@/services/mlb-player-prop-sync.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date')
    const [comparison, ingestion] = await Promise.all([
      getMlbPlayerPropHealth({ date }),
      getMlbPlayerPropIngestionHealth(),
    ])
    return apiOk({ ...comparison, ingestion }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop health error') })
  }
}
