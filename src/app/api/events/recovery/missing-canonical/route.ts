import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMissingCanonicalEventsRecoveryPlan,
  validateMissingCanonicalEventsRecoveryFixtures,
} from '@/services/missing-canonical-events-recovery.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateMissingCanonicalEventsRecoveryFixtures(), id)
    }
    return apiOk(await getMissingCanonicalEventsRecoveryPlan(), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown missing canonical events recovery error'),
      status: 500,
    })
  }
}
