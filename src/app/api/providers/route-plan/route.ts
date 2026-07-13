import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { planProviderRoute } from '@/services/provider-intelligence.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const result = planProviderRoute({
      sportKey: searchParams.get('sport'),
      leagueKey: searchParams.get('league'),
      dataType: searchParams.get('dataType'),
      market: searchParams.get('market'),
      providerId: searchParams.get('provider'),
      dryRun: true,
    })

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message:
          'errors' in result && Array.isArray(result.errors)
            ? result.errors.join(' ')
            : 'Invalid provider route planning request.',
        status: 400,
      })
    }

    return apiOk(result, id)
  } catch (error) {
    console.error('Provider route plan error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown provider route plan error'),
    })
  }
}
