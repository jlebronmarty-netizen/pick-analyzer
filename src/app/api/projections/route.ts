import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  getUniversalProjectionEngine,
  validateUniversalProjectionEngineFixtures,
} from '@/services/universal-projection-engine.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey') ?? 'baseball_mlb'
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const includeValidation = request.nextUrl.searchParams.get('includeValidation') === 'true'
    const data = await getUniversalProjectionEngine({ sportKey, date, dryRun: true })
    return apiOk(
      {
        ...data,
        validation: includeValidation ? validateUniversalProjectionEngineFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown universal projection engine error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const sportKey = typeof body?.sportKey === 'string' ? body.sportKey : 'baseball_mlb'
    const date = typeof body?.date === 'string' ? body.date : undefined
    const dryRun = body?.dryRun !== false
    if (!dryRun && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized projection persistence request.',
        status: 401,
      })
    }
    const data = await getUniversalProjectionEngine({ sportKey, date, dryRun })
    return apiOk(data, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown universal projection engine persistence error'),
    })
  }
}
