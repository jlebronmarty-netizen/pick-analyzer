import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getAdaptivePlannerTrace } from '@/services/adaptive-refresh-orchestrator.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 10)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(Math.max(Math.round(parsed), 1), 25)
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized planner trace request.', status: 401 })
  }
  try {
    const trace = await getAdaptivePlannerTrace({ limit: parseLimit(request.nextUrl.searchParams.get('limit')) })
    return apiOk(trace, id)
  } catch (error) {
    return apiOk(
      {
        success: false,
        status: 'ERROR',
        mode: 'adaptive_planner_trace_v1',
        error: errorMessage(error, 'Unknown planner trace error'),
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      id,
      { status: 500 }
    )
  }
}
