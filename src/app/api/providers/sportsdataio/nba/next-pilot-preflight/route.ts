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
        mode: 'sportsdataio_nba_next_pilot_preflight_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.nextPilotApprovalChecklist.status,
        liveExecutionAllowed:
          readiness.providerExecutionGate.liveExecutionAllowed,
        providerCallsAllowedNow:
          readiness.providerExecutionGate.providerCallsAllowedNow,
        nextPilotApprovalChecklist: readiness.nextPilotApprovalChecklist,
        providerExecutionGate: readiness.providerExecutionGate,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        externalApprovalPacket: {
          status: readiness.externalApprovalPacket.status,
          route: '/api/providers/sportsdataio/nba/approval-packet',
          summary: readiness.externalApprovalPacket.summary,
        },
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This preflight packet is a zero-call go/no-go summary, not execution approval.',
          'Live provider calls remain blocked while liveExecutionAllowed is false and providerCallsAllowedNow is 0.',
          'Migrations, prediction persistence, backtesting and model training remain disabled until the required external evidence is supplied.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA next-pilot preflight error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA next-pilot preflight error'
      ),
    })
  }
}
