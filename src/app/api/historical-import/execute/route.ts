import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

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
      providerVariant: body?.providerVariant ?? null,
      seasonType: body?.seasonType ?? null,
      timeoutMs: body?.timeoutMs ?? null,
      mode: body?.mode ?? body?.action ?? null,
      selectedDate: body?.selectedDate ?? body?.date ?? null,
      operatingDayId: body?.operatingDayId ?? null,
      finalPregameRefresh: body?.finalPregameRefresh ?? false,
      operatingDayRefresh: body?.operatingDayRefresh ?? false,
      operatingDayFinalRefresh: body?.operatingDayFinalRefresh ?? false,
    }
    if (
      requestPayload.mode === 'mlb_prospective_preview' ||
      requestPayload.mode === 'sportsdataio_mlb_prospective_preview_v1'
    ) {
      const { runSportsDataIoMlbProspectivePreview } = await import('@/services/sportsdataio-mlb-prospective-preview.service')
      const result = await runSportsDataIoMlbProspectivePreview({
        dryRun: requestPayload.dryRun,
        confirmed: requestPayload.confirmed,
        selectedDate: requestPayload.selectedDate,
        operatingDayId: requestPayload.operatingDayId,
        finalPregameRefresh: requestPayload.finalPregameRefresh,
        operatingDayRefresh: requestPayload.operatingDayRefresh,
        operatingDayFinalRefresh: requestPayload.operatingDayFinalRefresh,
        maximumRequests: requestPayload.maximumRequests,
        timeoutMs: requestPayload.timeoutMs,
      })

      return apiOk(result, id)
    }

    if (
      requestPayload.mode === 'sportsdataio_mlb_teams_verification_v1' ||
      requestPayload.mode === 'mlb_teams_verification'
    ) {
      const { verifySportsDataIoMlbTeamsForStandings2025 } = await import('@/services/sportsdataio-mlb-historical-import-executor.service')
      const result = await verifySportsDataIoMlbTeamsForStandings2025({
        confirmed: requestPayload.confirmed,
        timeoutMs: requestPayload.timeoutMs,
      })

      return apiOk(result, id)
    }

    const isMlbDiscoveryLab =
      requestPayload.provider === 'sportsdataio' &&
      requestPayload.sportKey === 'baseball_mlb'
    const result = isMlbDiscoveryLab
      ? await (async () => {
          const {
            executeSportsDataIoMlbDiscoveryImport,
            planSportsDataIoMlbDiscoveryExecution,
          } = await import('@/services/sportsdataio-mlb-historical-import-executor.service')
          return requestPayload.dryRun === false
            ? executeSportsDataIoMlbDiscoveryImport(requestPayload)
            : planSportsDataIoMlbDiscoveryExecution(requestPayload)
        })()
      : await (async () => {
          const {
            executeSportsDataIoNbaPilotImport,
            planSportsDataIoHistoricalExecution,
          } = await import('@/services/sportsdataio-historical-import-readiness.service')
          return requestPayload.dryRun === false
            ? executeSportsDataIoNbaPilotImport(requestPayload)
            : planSportsDataIoHistoricalExecution(requestPayload)
        })()

    if (!result.success) {
      const validation =
        result && typeof result === 'object' && 'validation' in result
          ? (result.validation as { errors?: unknown } | null)
          : null
      const validationErrors = Array.isArray(validation?.errors)
        ? validation.errors.filter((item): item is string => typeof item === 'string')
        : []
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message:
          validationErrors.join(' ') ||
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
