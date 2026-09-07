import { NextRequest } from 'next/server'

import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbStatcastMatchup } from '@/services/mlb-statcast-matchup.service'

function positiveInt(value: string | null, fallback?: number) {
  if (value === null || value === '') return fallback ?? null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function batterIds(value: string | null) {
  if (!value) return []
  return [...new Set(value.split(',').map((item) => Number(item.trim())).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 13)
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const pitcherId = positiveInt(request.nextUrl.searchParams.get('pitcherId'))
    const season = positiveInt(request.nextUrl.searchParams.get('season'), 2026)
    const opponentTeam = request.nextUrl.searchParams.get('opponentTeam')?.trim()

    if (!pitcherId) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'pitcherId is required.', status: 400 })
    }
    if (!season || season < 2008 || season > 2100) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'season must be a valid MLB Statcast season.', status: 400 })
    }
    if (!opponentTeam) {
      return apiError({ id, code: 'BAD_REQUEST', message: 'opponentTeam is required.', status: 400 })
    }

    const matchup = await getMlbStatcastMatchup({
      pitcherId,
      opponentTeam,
      season,
      batterIds: batterIds(request.nextUrl.searchParams.get('batterIds')),
    })

    return apiOk({
      mode: 'matchup',
      matchup,
      caveat: 'This endpoint exposes descriptive Statcast matchup evidence only. It does not return a calibrated win/prop probability or activate a betting market.',
    }, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB Statcast matchup error'),
    })
  }
}
