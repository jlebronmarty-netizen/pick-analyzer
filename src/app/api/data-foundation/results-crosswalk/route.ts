import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMultiSportResultsCrosswalkFoundation,
  validateMultiSportResultsCrosswalkFoundationFixtures,
} from '@/services/multi-sport-results-crosswalk-foundation.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const report = await getMultiSportResultsCrosswalkFoundation()
    return apiOk({
      ...report,
      validation: request.nextUrl.searchParams.get('validate') === 'true'
        ? validateMultiSportResultsCrosswalkFoundationFixtures()
        : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown multi-sport results crosswalk foundation error'),
    })
  }
}
