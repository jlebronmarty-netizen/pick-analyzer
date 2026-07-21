import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbPlayerPropsFoundation,
  validateMlbPlayerPropsFoundationFixtures,
} from '@/services/mlb-player-props-foundation.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const includeValidation = searchParams.get('includeValidation') === 'true'
    const foundation = await getMlbPlayerPropsFoundation()
    return apiOk({
      ...foundation,
      validation: includeValidation ? validateMlbPlayerPropsFoundationFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB player props foundation error'),
      status: 500,
    })
  }
}
