import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaIntegrationReadiness } from '@/services/sportsdataio-nba-integration-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoNbaIntegrationReadiness(), id)
  } catch (error) {
    console.error('SportsDataIO NBA integration readiness error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO NBA integration readiness error'),
    })
  }
}
