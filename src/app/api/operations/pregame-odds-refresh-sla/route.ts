import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getPregameOddsRefreshCadenceSlaV1 } from '@/services/prediction-epoch-shadow-readiness.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    return apiOk(await getPregameOddsRefreshCadenceSlaV1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown pregame odds refresh SLA error') })
  }
}

