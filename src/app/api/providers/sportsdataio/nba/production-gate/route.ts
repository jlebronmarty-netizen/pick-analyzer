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
        mode: 'sportsdataio_nba_production_gate_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.productionGateAudit.status,
        productionGateAudit: readiness.productionGateAudit,
        providerExecutionGate: readiness.providerExecutionGate,
        externalBlockerLedger: readiness.externalBlockerLedger,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This production gate audit is generated without provider calls.',
          'The audit proves production gates are closed only and does not approve provider transport, prediction persistence, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA production gate audit error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA production gate audit error'
      ),
    })
  }
}
