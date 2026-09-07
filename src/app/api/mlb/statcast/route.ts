import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getMlbStatcastBatterProfile,
  getMlbStatcastCoverage,
  getMlbStatcastPitcherProfile,
  getMlbStatcastTeamProfile,
  MLB_STATCAST_METRIC_DEFINITIONS,
} from '@/services/mlb-statcast-query.service'

function positiveInt(value: string | null, fallback?: number) {
  if (value === null || value === '') return fallback ?? null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const mode = request.nextUrl.searchParams.get('mode') ?? 'coverage'
    const season = positiveInt(request.nextUrl.searchParams.get('season'), 2026)
    if (!season || season < 2008 || season > 2100) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: 'season must be a four-digit MLB Statcast season.',
        status: 400,
      })
    }

    if (mode === 'coverage') {
      const coverage = await getMlbStatcastCoverage(
        request.nextUrl.searchParams.has('season') ? season : undefined,
      )
      return apiOk({
        mode,
        coverage,
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }, id)
    }

    if (mode === 'pitcher') {
      const pitcherId = positiveInt(request.nextUrl.searchParams.get('pitcherId'))
      if (!pitcherId) {
        return apiError({
          id,
          code: 'BAD_REQUEST',
          message: 'pitcherId is required for mode=pitcher.',
          status: 400,
        })
      }
      const recentGames = positiveInt(request.nextUrl.searchParams.get('recentGames'), 20) ?? 20
      const profile = await getMlbStatcastPitcherProfile({ pitcherId, season, recentGames })
      return apiOk({
        mode,
        profile,
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }, id)
    }

    if (mode === 'batter') {
      const batterId = positiveInt(request.nextUrl.searchParams.get('batterId'))
      if (!batterId) {
        return apiError({
          id,
          code: 'BAD_REQUEST',
          message: 'batterId is required for mode=batter.',
          status: 400,
        })
      }
      const recentGames = positiveInt(request.nextUrl.searchParams.get('recentGames'), 20) ?? 20
      const profile = await getMlbStatcastBatterProfile({ batterId, season, recentGames })
      return apiOk({
        mode,
        profile,
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }, id)
    }

    if (mode === 'team') {
      const team = request.nextUrl.searchParams.get('team')?.trim()
      if (!team) {
        return apiError({
          id,
          code: 'BAD_REQUEST',
          message: 'team is required for mode=team.',
          status: 400,
        })
      }
      const profile = await getMlbStatcastTeamProfile({ team, season })
      return apiOk({
        mode,
        profile,
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }, id)
    }

    return apiError({
      id,
      code: 'BAD_REQUEST',
      message: 'mode must be one of coverage, pitcher, batter, or team.',
      status: 400,
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB Statcast query error'),
    })
  }
}
