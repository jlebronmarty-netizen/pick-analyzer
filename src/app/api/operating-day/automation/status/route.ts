import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getOperatingDayAutomationStatus,
  validateOperatingDayAutomationFixtures,
} from '@/services/operating-day-automation.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const status = await getOperatingDayAutomationStatus()
    return apiOk(
      {
        ...status,
        validation: includeValidation ? validateOperatingDayAutomationFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown operating-day automation status error'),
    })
  }
}
