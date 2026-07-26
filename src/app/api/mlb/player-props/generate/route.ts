import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import { generateMlbPlayerPropComparison } from '@/services/mlb-player-prop-comparison.service'

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const date = typeof body?.date === 'string' ? body.date : null
    const limit = parseIntegerParam({ value: body?.limit === undefined ? null : String(body.limit), fallback: 200, min: 1, max: 500 })
    return apiOk(await generateMlbPlayerPropComparison({ date, limit, dryRun: body?.dryRun !== false }), id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB player prop generation error') })
  }
}
