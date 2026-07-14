import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaPlayerStatsReadiness } from '@/services/sportsdataio-nba-player-stats-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const readiness = getSportsDataIoNbaPlayerStatsReadiness()

    return apiOk(
      {
        success: readiness.success,
        mode: 'sportsdataio_nba_player_stats_migration_preflight_v1',
        compatibilityAlias: true,
        operationalPreflight: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'nextPilotGatePreflights.playerStats',
        aliasNotice:
          'Operational preflight alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness for aggregate NBA readiness and use this route only for focused player-stats migration approval checks.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.status,
        endpoints: readiness.endpoints,
        migration: readiness.migration,
        preflight: readiness.migration.preflight,
        persistence: readiness.persistence,
        validation: readiness.validation,
        warnings: [
          'This migration preflight is generated without provider calls.',
          'It does not apply migrations or authorize player-stat provider transport.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA player stats migration preflight error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA player stats migration preflight error'
      ),
    })
  }
}
