import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseBooleanParam, requestId } from '@/lib/api-contract'
import {
  getSportsDataIoMlbDiscovery,
  validateSportsDataIoMlbDiscoveryFixtures,
} from '@/services/sportsdataio-mlb-discovery.service'

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  return header === `Bearer ${expected}`
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const date = request.nextUrl.searchParams.get('date') ?? undefined
    const includeSamples = parseBooleanParam(request.nextUrl.searchParams.get('includeSamples'), false)
    const includeValidation = parseBooleanParam(request.nextUrl.searchParams.get('includeValidation'), false)
    const discovery = await getSportsDataIoMlbDiscovery({ date, includeSamples, dryRun: true })
    return apiOk(
      {
        ...discovery,
        validation: includeValidation ? validateSportsDataIoMlbDiscoveryFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO discovery error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = (await request.json().catch(() => ({}))) as {
      date?: string
      dryRun?: boolean
      includeSamples?: boolean
      includeValidation?: boolean
    }
    const dryRun = body.dryRun !== false

    if (!dryRun && !authorized(request)) {
      return apiError({
        id,
        code: 'UNAUTHORIZED',
        message: 'Protected SportsDataIO discovery execution requires CRON_SECRET authorization.',
        status: 401,
      })
    }

    const discovery = await getSportsDataIoMlbDiscovery({
      date: body.date,
      includeSamples: body.includeSamples === true,
      dryRun,
    })

    return apiOk(
      {
        ...discovery,
        validation: body.includeValidation ? validateSportsDataIoMlbDiscoveryFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown SportsDataIO discovery execution error'),
    })
  }
}
