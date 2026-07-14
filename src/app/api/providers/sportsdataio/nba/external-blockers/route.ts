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
        mode: 'sportsdataio_nba_external_blockers_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.externalBlockerLedger.status,
        externalBlockerLedger: readiness.externalBlockerLedger,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        providerExecutionGate: readiness.providerExecutionGate,
        productionGateAudit: readiness.productionGateAudit,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This blocker ledger is generated without provider calls.',
          'Open blockers keep provider execution, production confidence improvement, prediction persistence, backtesting and model training disabled.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA external blockers error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA external blockers error'
      ),
    })
  }
}
