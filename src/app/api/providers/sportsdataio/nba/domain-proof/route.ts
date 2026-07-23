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
        mode: 'sportsdataio_nba_domain_proof_v1',
        compatibilityAlias: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'domainCompletionProofLedger',
        aliasNotice:
          'Compatibility alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness and read domainCompletionProofLedger for new integrations.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.domainCompletionProofLedger.status,
        completionClaimAllowed:
          readiness.domainCompletionProofLedger.completionClaimAllowed,
        domainCompletionProofLedger:
          readiness.domainCompletionProofLedger,
        completionEvidenceMatrix: readiness.completionEvidenceMatrix,
        externalBlockerLedger: readiness.externalBlockerLedger,
        providerExecutionGate: readiness.providerExecutionGate,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This domain completion proof ledger is generated without provider calls.',
          'The ledger preserves completion-blocking proof gaps and does not mark the SportsDataIO NBA objective complete.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA domain proof error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA domain proof error'
      ),
    })
  }
}
