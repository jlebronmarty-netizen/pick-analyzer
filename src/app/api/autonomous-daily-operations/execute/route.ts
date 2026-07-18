import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { executeAutonomousDailyOperation } from '@/services/autonomous-daily-operations.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized autonomous execution request.', status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const result = await executeAutonomousDailyOperation({
      dryRun: body.dryRun ?? true,
      confirmed: body.confirmed ?? false,
      selectedDate: body.selectedDate ?? body.date ?? null,
      requestedStage: body.requestedStage ?? 'auto',
      idempotencyKey: body.idempotencyKey ?? null,
      requestId: id,
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown autonomous execution error'),
      status: 500,
    })
  }
}
