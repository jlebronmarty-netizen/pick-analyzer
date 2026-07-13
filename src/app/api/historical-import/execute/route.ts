import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import {
  executeSportsDataIoNbaPilotImport,
  planSportsDataIoHistoricalExecution,
} from '@/services/sportsdataio-historical-import-readiness.service'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true

  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get('secret') === secret
  )
}

export async function POST(request: NextRequest) {
  const id = requestId(request)

  if (!authorized(request)) {
    return apiError({
      id,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized historical import execution request.',
      status: 401,
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const requestPayload = {
      provider: body?.provider ?? null,
      sportKey: body?.sportKey ?? body?.sport ?? null,
      leagueKey: body?.leagueKey ?? body?.league ?? null,
      season: body?.season ?? null,
      dateFrom: body?.dateFrom ?? null,
      dateTo: body?.dateTo ?? null,
      domains: Array.isArray(body?.domains)
        ? body.domains
        : Array.isArray(body?.dataTypes)
          ? body.dataTypes
          : null,
      dryRun: body?.dryRun ?? true,
      confirmed: body?.confirmed ?? false,
      maximumRequests: body?.maximumRequests ?? body?.maxRequests ?? null,
      maximumRecords: body?.maximumRecords ?? null,
      batchSizeDays: body?.batchSizeDays ?? body?.batchSize ?? null,
      concurrencyLimit: body?.concurrencyLimit ?? null,
      requestDelayMs: body?.requestDelayMs ?? null,
    }
    const result =
      requestPayload.dryRun === false
        ? await executeSportsDataIoNbaPilotImport(requestPayload)
        : planSportsDataIoHistoricalExecution(requestPayload)

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message:
          result.validation?.errors.join(' ') ||
          'SportsDataIO execution request was rejected by guardrails.',
        status: 400,
      })
    }

    return apiOk(result, id)
  } catch (error) {
    console.error('SportsDataIO historical import execute error:', {
      requestId: id,
      error,
    })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(
        error,
        'Unknown SportsDataIO historical import execute error'
      ),
    })
  }
}
