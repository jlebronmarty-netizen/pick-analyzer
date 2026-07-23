import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  executeSettlementReconciliation,
  getSettlementReconciliationPlan,
  type SettlementReconciliationMode,
  validateSettlementReconciliationFixtures,
} from '@/services/settlement-reconciliation.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')
  return header === `Bearer ${secret}` || querySecret === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateSettlementReconciliationFixtures(), id)
    }
    return apiOk(await getSettlementReconciliationPlan({
      mode: (searchParams.get('mode') as SettlementReconciliationMode | null) ?? 'DRY_RUN',
      gameId: searchParams.get('gameId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : null,
    }), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown settlement reconciliation error'),
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized settlement reconciliation request.',
        status: 401,
      })
    }
    const body = await request.json().catch(() => ({})) as {
      mode?: SettlementReconciliationMode
      gameId?: string | null
      startDate?: string | null
      endDate?: string | null
      limit?: number | null
    }
    return apiOk(await executeSettlementReconciliation({
      mode: body.mode ?? 'DRY_RUN',
      gameId: body.gameId ?? null,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      limit: body.limit ?? null,
    }), id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown settlement reconciliation execution error'),
      status: 500,
    })
  }
}
