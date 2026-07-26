import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPlayerPropsProviderAudit } from '@/services/mlb-player-props-readiness-audit.service'
import { getMlbPlayerPropIngestionProviderAudit } from '@/services/mlb-player-prop-sync.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const [readiness, ingestion] = await Promise.all([
      getMlbPlayerPropsProviderAudit(),
      getMlbPlayerPropIngestionProviderAudit(),
    ])
    return apiOk({ ...readiness, ingestion }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB player props provider audit error'),
    })
  }
}
