import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaOddsReadiness } from '@/services/sportsdataio-nba-odds-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getSportsDataIoNbaOddsReadiness(), id)
  } catch (error) {
    console.error('SportsDataIO NBA odds readiness error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO NBA odds readiness error'),
    })
  }
}
