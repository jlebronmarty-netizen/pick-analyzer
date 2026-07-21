import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getBsnCoreCertification,
  validateBsnCoreCertificationFixtures,
} from '@/services/bsn-core-certification.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const certification = await getBsnCoreCertification()
    return apiOk({
      ...certification,
      validation: includeValidation ? await validateBsnCoreCertificationFixtures() : undefined,
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown BSN Core certification error'),
      status: 500,
    })
  }
}
