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
        mode: 'sportsdataio_nba_provider_gate_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.providerExecutionGate.status,
        liveExecutionAllowed:
          readiness.providerExecutionGate.liveExecutionAllowed,
        providerCallsAllowedNow:
          readiness.providerExecutionGate.providerCallsAllowedNow,
        providerExecutionGate: readiness.providerExecutionGate,
        externalBlockerLedger: readiness.externalBlockerLedger,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        productionGateAudit: readiness.productionGateAudit,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This provider execution gate is generated without provider calls.',
          'The gate is a go/no-go status artifact only and does not approve transport, migrations, prediction persistence, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA provider execution gate error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA provider execution gate error'
      ),
    })
  }
}
