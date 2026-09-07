import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPitcherBbShadowProjection } from '@/services/mlb-pitcher-bb-shadow.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function positiveInteger(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function optionalLine(value: string | null) {
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  const targetGamePk = positiveInteger(request.nextUrl.searchParams.get('gamePk'))
  const pitcherId = positiveInteger(request.nextUrl.searchParams.get('pitcherId'))
  const line = optionalLine(request.nextUrl.searchParams.get('line'))

  if (!targetGamePk || !pitcherId || line === null) {
    return apiError({
      id,
      code: 'BAD_REQUEST',
      message: 'gamePk and pitcherId must be positive integers; line is optional and must be positive when supplied.',
    })
  }

  try {
    const projection = await getMlbPitcherBbShadowProjection({ targetGamePk, pitcherId, line })
    return apiOk({
      mode: 'pitcher-walks-shadow',
      projection,
      caveat: 'Research-only shadow output. BB includes intentional walks and excludes HBP. No sportsbook price, EV, recommendation, Official Pick write, or betting activation is produced.',
    }, id, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pitcher walks shadow error'),
    })
  }
}
