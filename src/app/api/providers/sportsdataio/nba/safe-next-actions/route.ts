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
        mode: 'sportsdataio_nba_safe_next_actions_v1',
        compatibilityAlias: true,
        canonicalRoute: '/api/providers/sportsdataio/nba/readiness',
        canonicalSection: 'handoff.safeNextActions',
        aliasNotice:
          'Compatibility alias preserved for existing consumers. Prefer GET /api/providers/sportsdataio/nba/readiness and read handoff.safeNextActions for new integrations.',
        generatedAt: readiness.generatedAt,
        providerUsage: readiness.providerUsage,
        status: readiness.handoff.status,
        safeNextActions: readiness.handoff.safeNextActions,
        productionGates: readiness.handoff.productionGates,
        providerExecutionGate: readiness.providerExecutionGate,
        nextPilotApprovalChecklist: readiness.nextPilotApprovalChecklist,
        externalBlockerResolutionChecklist:
          readiness.externalBlockerResolutionChecklist,
        productionUsageExclusionAudit: readiness.productionUsageExclusionAudit,
        warnings: [
          'This safe-next-actions packet is generated without provider calls.',
          'Actions are guidance only and do not authorize provider transport, migrations, prediction persistence, backtesting or model training.',
        ],
      },
      id
    )
  } catch (error) {
    console.error('SportsDataIO NBA safe next actions error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO NBA safe next actions error'
      ),
    })
  }
}
