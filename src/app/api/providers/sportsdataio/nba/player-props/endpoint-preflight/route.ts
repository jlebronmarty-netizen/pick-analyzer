import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaPlayerPropsReadiness } from '@/services/sportsdataio-nba-player-props-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const readiness = getSportsDataIoNbaPlayerPropsReadiness()

    return apiOk(
      {
        success: readiness.success,
        mode: 'sportsdataio_nba_player_props_endpoint_preflight_v1',
        compatibilityAlias: true,
        operationalPreflight: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'nextPilotGatePreflights.playerProps',
        aliasNotice:
          'Operational preflight alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness for aggregate NBA readiness and use this route only for focused player-props endpoint approval checks.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.status,
        endpoints: readiness.endpoints,
        endpointPreflight: readiness.endpointPreflight,
        persistence: readiness.persistence,
        validation: readiness.validation,
        warnings: [
          'This player-props endpoint preflight is generated without provider calls.',
          'It does not authorize player-prop provider transport, prediction persistence, settlement, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA player props endpoint preflight error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA player props endpoint preflight error'
      ),
    })
  }
}
