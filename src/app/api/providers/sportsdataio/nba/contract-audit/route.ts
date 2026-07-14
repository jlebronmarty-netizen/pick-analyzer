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
        mode: 'sportsdataio_nba_contract_audit_v1',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.responseShapeAudit.valid &&
          readiness.surfaceConsistencyAudit.valid
          ? 'valid_with_external_blockers'
          : 'invalid_contract_or_surface_state',
        responseShapeAudit: readiness.responseShapeAudit,
        surfaceConsistencyAudit: readiness.surfaceConsistencyAudit,
        readinessEvidenceExport: {
          status: readiness.readinessEvidenceExport.status,
          route: '/api/providers/sportsdataio/nba/evidence-export',
          validation: readiness.readinessEvidenceExport.validation,
        },
        providerExecutionGate: readiness.providerExecutionGate,
        readinessRoutes: readiness.readinessRoutes,
        warnings: [
          'This contract audit is generated without provider calls.',
          'Valid response shape and surface consistency prove local contract alignment only; they do not approve provider execution or production use.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA contract audit error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA contract audit error'
      ),
    })
  }
}
