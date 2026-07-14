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
        mode: 'sportsdataio_nba_completion_evidence_v1',
        compatibilityAlias: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'completionEvidenceMatrix',
        aliasNotice:
          'Compatibility alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness and read completionEvidenceMatrix for new integrations.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.completionEvidenceMatrix.status,
        completionEvidenceMatrix: readiness.completionEvidenceMatrix,
        domainCompletionProofLedger:
          readiness.domainCompletionProofLedger,
        objectiveAudit: readiness.objectiveAudit,
        externalBlockerLedger: readiness.externalBlockerLedger,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This completion evidence matrix is generated without provider calls.',
          'The matrix preserves unresolved completion evidence and does not mark the SportsDataIO NBA objective complete.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA completion evidence error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA completion evidence error'
      ),
    })
  }
}
