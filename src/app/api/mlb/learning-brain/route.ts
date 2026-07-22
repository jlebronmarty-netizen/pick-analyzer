import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  executeMlbLearningBrain,
  getMlbLearningBrain,
  validateMlbLearningBrainFixtures,
} from '@/services/mlb-learning-brain.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') return apiOk(validateMlbLearningBrainFixtures(), id)
    return apiOk(
      await getMlbLearningBrain({
        season: searchParams.get('season'),
        date: searchParams.get('date'),
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB learning brain error'),
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    if (!dryRun && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized MLB learning brain execution request.',
        status: 401,
      })
    }
    return apiOk(
      await executeMlbLearningBrain({
        season: typeof body?.season === 'string' ? body.season : null,
        dryRun,
      }),
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB learning brain execution error'),
      status: 500,
    })
  }
}
