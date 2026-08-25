import { NextRequest } from 'next/server'
import { apiError, apiOk, requestId } from '@/lib/api-contract'
import { buildMlbResearchAuthStatusPayload } from '@/services/mlb-04d-research-auth-status.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Protected MLB research authorization status requires CRON_SECRET authorization.',
      status: 401,
    })
  }

  return apiOk(buildMlbResearchAuthStatusPayload(), id)
}
