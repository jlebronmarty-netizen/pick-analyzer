import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getProviderCapabilityRegistry,
  type ProviderDataType,
} from '@/services/provider-intelligence.service'
import { isSportKey } from '@/services/multi-sport-resolution.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const sport = request.nextUrl.searchParams.get('sport')
    const league = request.nextUrl.searchParams.get('league')
    const dataType = request.nextUrl.searchParams.get('dataType')
    const market = request.nextUrl.searchParams.get('market')

    if (sport && !isSportKey(sport)) {
      return apiError({
        id,
        code: 'NOT_FOUND',
        message: `Unsupported sport key: ${sport}`,
        status: 404,
      })
    }

    const sportKey = sport && isSportKey(sport) ? sport : null

    return apiOk(
      getProviderCapabilityRegistry({
        sportKey,
        leagueKey: league,
        dataType: (dataType as ProviderDataType | null) ?? null,
        market,
      }),
      id
    )
  } catch (error) {
    console.error('Provider capabilities error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown provider capabilities error'),
    })
  }
}
