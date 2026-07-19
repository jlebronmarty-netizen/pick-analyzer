import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import { getBsnHistoricalReconstruction, validateBsnHistoricalReconstructionFixtures } from '@/services/basketball'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(await validateBsnHistoricalReconstructionFixtures(), id)
    }
    return apiOk(
      await getBsnHistoricalReconstruction({
        season: searchParams.get('season'),
        execute: parseBooleanParam(searchParams.get('execute'), false),
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown BSN historical reconstruction error'),
      status: 500,
    })
  }
}
