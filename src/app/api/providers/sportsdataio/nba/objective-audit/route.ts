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
        mode: 'sportsdataio_nba_objective_audit_v1',
        compatibilityAlias: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'objectiveAudit',
        aliasNotice:
          'Compatibility alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness and read objectiveAudit for new integrations.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.objectiveAudit.status,
        objectiveAudit: readiness.objectiveAudit,
        completionEvidenceMatrix: readiness.completionEvidenceMatrix,
        domainCompletionProofLedger:
          readiness.domainCompletionProofLedger,
        blockedStateAudit: readiness.blockedStateAudit,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This objective audit is generated without provider calls.',
          'The audit preserves remaining work and does not mark the SportsDataIO NBA objective complete.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA objective audit error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA objective audit error'
      ),
    })
  }
}
