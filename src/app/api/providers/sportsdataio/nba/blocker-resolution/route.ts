import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaIntegrationReadiness } from '@/services/sportsdataio-nba-integration-readiness.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const readiness = getSportsDataIoNbaIntegrationReadiness()

    return apiOk(
      {
        success: readiness.success,
        mode: 'sportsdataio_nba_blocker_resolution_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.externalBlockerResolutionChecklist.status,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        externalBlockerLedger: readiness.externalBlockerLedger,
        providerExecutionGate: readiness.providerExecutionGate,
        productionGateAudit: readiness.productionGateAudit,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This blocker resolution checklist is generated without provider calls.',
          'The checklist records required evidence and forbidden actions only; it does not approve provider transport, migrations, prediction persistence, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA blocker resolution error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA blocker resolution error'
      ),
    })
  }
}
