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
        mode: 'sportsdataio_nba_readiness_evidence_export_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.readinessEvidenceExport.status,
        readinessEvidenceExport: readiness.readinessEvidenceExport,
        externalBlockerLedger: readiness.externalBlockerLedger,
        productionGateAudit: readiness.productionGateAudit,
        domainCompletionProofLedger: readiness.domainCompletionProofLedger,
        completionEvidenceMatrix: readiness.completionEvidenceMatrix,
        providerExecutionGate: readiness.providerExecutionGate,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This evidence export is generated without provider calls.',
          'The export is handoff evidence only; it does not approve provider execution, migrations, prediction persistence, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA evidence export error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA evidence export error'
      ),
    })
  }
}
