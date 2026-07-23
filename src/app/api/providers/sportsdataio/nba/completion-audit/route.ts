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
        mode: 'sportsdataio_nba_completion_audit_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.blockedStateAudit.status,
        completionClaimAllowed:
          readiness.blockedStateAudit.completionClaimAllowed,
        objectiveAudit: readiness.objectiveAudit,
        completionEvidenceMatrix: readiness.completionEvidenceMatrix,
        domainCompletionProofLedger: readiness.domainCompletionProofLedger,
        blockedStateAudit: readiness.blockedStateAudit,
        providerExecutionGate: readiness.providerExecutionGate,
        productionUsageExclusionAudit:
          readiness.productionUsageExclusionAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This completion audit is generated without provider calls.',
          'A false completionClaimAllowed value means the long-horizon objective is not complete while external evidence is missing.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA completion audit error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA completion audit error'
      ),
    })
  }
}
