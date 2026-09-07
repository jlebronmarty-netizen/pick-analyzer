import { NextRequest } from 'next/server'

import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbPitcherKShadowProjection } from '@/services/mlb-pitcher-k-shadow.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function positiveInt(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function propLine(value: string | null) {
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const targetGamePk = positiveInt(request.nextUrl.searchParams.get('gamePk'))
    const pitcherId = positiveInt(request.nextUrl.searchParams.get('pitcherId'))
    const opponentTeam = request.nextUrl.searchParams.get('opponentTeam')?.trim()
    const line = propLine(request.nextUrl.searchParams.get('line'))

    if (!targetGamePk) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'gamePk is required.', status: 400 })
    }
    if (!pitcherId) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'pitcherId is required.', status: 400 })
    }
    if (!opponentTeam) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'opponentTeam is required.', status: 400 })
    }
    if (line === null) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'line must be a positive number when supplied.', status: 400 })
    }

    const projection = await getMlbPitcherKShadowProjection({
      targetGamePk,
      pitcherId,
      opponentTeam,
      line,
    })

    return apiOk({
      mode: 'pitcher-strikeouts-shadow',
      projection,
      caveat: 'Research-only shadow output. No sportsbook price, EV, recommendation, Official Pick write, or betting activation is produced.',
    }, id, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB pitcher strikeout shadow projection error'),
    })
  }
}
