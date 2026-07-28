import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMultiSportDataExpansionCheckpoint3V1,
  validateMultiSportDataExpansionCheckpoint3V1Fixtures,
} from '@/services/multi-sport-data-expansion-checkpoint3.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    if (request.nextUrl.searchParams.get('validate') === 'true') {
      return apiOk(validateMultiSportDataExpansionCheckpoint3V1Fixtures(), id)
    }
    return apiOk(await getMultiSportDataExpansionCheckpoint3V1(), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown Checkpoint 3 expansion error') })
  }
}
