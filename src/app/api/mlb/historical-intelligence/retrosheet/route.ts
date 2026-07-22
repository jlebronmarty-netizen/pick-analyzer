import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getRetrosheetHistoricalDataLakeDiagnostics } from '@/services/retrosheet-historical-data-lake.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const result = await getRetrosheetHistoricalDataLakeDiagnostics()
    return apiOk(result, id)
  } catch (error) {
    console.error('Retrosheet historical data lake diagnostics error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Retrosheet historical data lake diagnostics error'),
    })
  }
}
