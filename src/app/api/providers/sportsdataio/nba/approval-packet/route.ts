import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getSportsDataIoNbaIntegrationReadinessLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const readiness = await getSportsDataIoNbaIntegrationReadinessLazy()

    return apiOk(
      {
        success: readiness.success,
        mode: 'sportsdataio_nba_external_approval_packet_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.externalApprovalPacket.status,
        externalApprovalPacket: readiness.externalApprovalPacket,
        nextPilotApprovalChecklist: readiness.nextPilotApprovalChecklist,
        providerExecutionGate: readiness.providerExecutionGate,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        blockedStateAudit: readiness.blockedStateAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This packet is a zero-call external approval handoff, not execution approval.',
          'Provider calls, migrations, prediction persistence, backtesting and model training remain blocked until required evidence is supplied.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA approval packet error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA approval packet error'
      ),
    })
  }
}
