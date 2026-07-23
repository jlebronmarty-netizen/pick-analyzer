import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import {
  getBsnAcquisitionDiscovery,
  runBsnAcquisitionEngine,
  validateBsnAcquisitionEngineFixtures,
} from '@/services/basketball/acquisition/bsn-acquisition-engine'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (parseBooleanParam(searchParams.get('validate'), false)) {
      return apiOk(await validateBsnAcquisitionEngineFixtures(), id)
    }
    if (parseBooleanParam(searchParams.get('discover'), false)) {
      return apiOk(await getBsnAcquisitionDiscovery(), id)
    }
    return apiOk(
      await runBsnAcquisitionEngine({
        execute: parseBooleanParam(searchParams.get('execute'), false),
        confirmed: parseBooleanParam(searchParams.get('confirmed'), false),
        forceRefresh: parseBooleanParam(searchParams.get('forceRefresh'), false),
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown BSN acquisition error'),
      status: 500,
    })
  }
}
