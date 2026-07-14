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
        mode: 'sportsdataio_nba_production_usage_exclusion_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.productionUsageExclusionAudit.status,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        providerExecutionGate: readiness.providerExecutionGate,
        productionGateAudit: readiness.productionGateAudit,
        externalBlockerLedger: readiness.externalBlockerLedger,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This production usage exclusion audit is generated without provider calls.',
          'The audit proves local exclusion guardrails only and does not approve production predictions, backtesting, model training or confidence improvement.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA production usage exclusion error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA production usage exclusion error'
      ),
    })
  }
}
