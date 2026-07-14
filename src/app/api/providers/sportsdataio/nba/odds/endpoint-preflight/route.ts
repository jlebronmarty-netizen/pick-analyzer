import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaOddsReadiness } from '@/services/sportsdataio-nba-odds-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const readiness = getSportsDataIoNbaOddsReadiness()

    return apiOk(
      {
        success: readiness.success,
        mode: 'sportsdataio_nba_odds_endpoint_preflight_v1',
        compatibilityAlias: true,
        operationalPreflight: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'nextPilotGatePreflights.odds',
        aliasNotice:
          'Operational preflight alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness for aggregate NBA readiness and use this route only for focused odds endpoint approval checks.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.status,
        endpoints: readiness.endpoints,
        endpointPreflight: readiness.endpointPreflight,
        persistence: readiness.persistence,
        validation: readiness.validation,
        warnings: [
          'This odds endpoint preflight is generated without provider calls.',
          'It does not authorize current odds, historical odds, CLV, backtesting, model training or production prediction use.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA odds endpoint preflight error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA odds endpoint preflight error'
      ),
    })
  }
}
