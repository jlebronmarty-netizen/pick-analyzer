import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getOddsPrimaryAuthorityRuntimeStatus,
  validateOddsPrimaryAuthorityFixtures,
} from '@/services/odds-primary-authority.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    return apiOk({
      ...getOddsPrimaryAuthorityRuntimeStatus(),
      validation: includeValidation ? validateOddsPrimaryAuthorityFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown odds primary authority status error'),
    })
  }
}
