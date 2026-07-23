import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  getRetrosheetHistoricalFeatureContract,
  getRetrosheetHistoricalFeatureStoreDiagnostics,
  runRetrosheetHistoricalFeatureStore,
  type RetrosheetHistoricalFeatureMode,
} from '@/services/retrosheet-historical-feature-store.service'

const MODES: RetrosheetHistoricalFeatureMode[] = [
  'DRY_RUN',
  'SINGLE_GAME_PREVIEW',
  'RANGE_IMPORT',
  'FULL_SEASON_IMPORT',
  'VALIDATE_ONLY',
]

function parseMode(value: unknown): RetrosheetHistoricalFeatureMode {
  return MODES.includes(value as RetrosheetHistoricalFeatureMode)
    ? value as RetrosheetHistoricalFeatureMode
    : 'DRY_RUN'
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') ?? 'diagnostics'

    if (view === 'contract' || view === 'definitions') {
      return apiOk(getRetrosheetHistoricalFeatureContract(), id)
    }

    const result = await getRetrosheetHistoricalFeatureStoreDiagnostics({
      gameId: searchParams.get('gameId'),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 1, min: 1, max: 10 }),
    })
    return apiOk(result, id)
  } catch (error) {
    console.error('Retrosheet historical feature-store diagnostics error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Retrosheet historical feature-store diagnostics error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret')

  if (!expected || provided !== expected) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      status: 401,
    })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string | null
      gameId?: string | null
      dateFrom?: string | null
      dateTo?: string | null
      limit?: number | null
    }
    const result = await runRetrosheetHistoricalFeatureStore({
      mode: parseMode(body.mode),
      gameId: body.gameId,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      limit: body.limit,
    })
    return apiOk(result, id)
  } catch (error) {
    console.error('Retrosheet historical feature-store run error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Retrosheet historical feature-store run error'),
    })
  }
}
