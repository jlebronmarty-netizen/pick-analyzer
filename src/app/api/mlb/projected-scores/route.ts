import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbProjectedScores, validateMlbProjectedScoreFixtures } from '@/services/mlb-projected-score.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const result = await getMlbProjectedScores()
    return apiOk({
      ...result,
      validation: includeValidation ? validateMlbProjectedScoreFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB projected score error'),
      status: 500,
    })
  }
}
