import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbDataQualityStatus, validateMlbDataQualityFixtures } from '@/services/mlb-data-quality.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? '2026-07-17'
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const status = await getMlbDataQualityStatus(date)
    return apiOk(
      {
        ...status,
        validation: includeValidation ? validateMlbDataQualityFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB data-quality status error'),
    })
  }
}
