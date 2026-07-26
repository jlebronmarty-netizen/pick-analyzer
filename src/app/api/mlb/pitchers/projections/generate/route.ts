import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { generatePitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    if (!dryRun && !authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized MLB pitcher projection generation request.', status: 401 })
    }
    const date = typeof body?.date === 'string' ? body.date : null
    const limit = parseIntegerParam({ value: body?.limit === undefined ? null : String(body.limit), fallback: 80, min: 1, max: 200 })
    return apiOk(await generatePitcherProjection({ date, limit, persist: !dryRun }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB pitcher projection generation error') })
  }
}
