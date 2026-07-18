import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbMissingIntelligenceStatus,
  runMlbMissingIntelligencePreflight,
} from '@/services/mlb-missing-intelligence.service'

export async function GET(request: Request) {
  const id = requestId(request)
  try {
    const url = new URL(request.url)
    const selectedDate = url.searchParams.get('selectedDate')
    const includeValidation = url.searchParams.get('includeValidation') === 'true'
    const preflight = url.searchParams.get('preflight') === 'true'
    const confirmed = url.searchParams.get('confirmed') === 'true'
    const writePlayers = url.searchParams.get('writePlayers') === 'true'
    const maxCalls = Number(url.searchParams.get('maxCalls') ?? 3)

    if (preflight) {
      return apiOk(
        await runMlbMissingIntelligencePreflight({
          selectedDate,
          confirmed,
          writePlayers,
          maxCalls,
        }),
        id
      )
    }

    return apiOk(await getMlbMissingIntelligenceStatus({ selectedDate, includeValidation }), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB missing intelligence health error'),
    })
  }
}
