import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { probeHistoricalFeatureSchemaCapabilities } from '@/lib/server-schema-capabilities'
import { planHistoricalImport } from '@/services/historical-import-engine.service'
import {
  runHistoricalFeatureSnapshotWritePilot,
  runHistoricalPredictionLineagePilot,
} from '@/services/historical-feature-generation.service'

export async function POST(request: NextRequest) {
  const id = requestId(request)

  try {
    const body = await request.json().catch(() => ({}))
    const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
    const result = planHistoricalImport({
      sportKey: body?.sportKey ?? body?.sport ?? null,
      leagueKey: body?.leagueKey ?? body?.league ?? null,
      providerId: body?.providerId ?? body?.provider ?? null,
      season: body?.season ?? null,
      dateFrom: body?.dateFrom ?? null,
      dateTo: body?.dateTo ?? null,
      dataTypes: Array.isArray(body?.dataTypes) ? body.dataTypes : null,
      dryRun: body?.dryRun ?? true,
      batchSizeDays: body?.batchSizeDays ?? body?.batchSize ?? null,
    }, schemaCapabilities)

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: result.validation.errors.join(' '),
        status: 400,
      })
    }

    const snapshotWritePilot = await runHistoricalFeatureSnapshotWritePilot({
      dryRun: true,
      confirmed: false,
      maximumEvents: 5,
      maximumMarketsPerEvent: 3,
      maximumSnapshots: 15,
    })
    const predictionLineagePilot = await runHistoricalPredictionLineagePilot({
      dryRun: true,
      confirmed: false,
      maximumSnapshots: 15,
      maximumPredictions: 5,
      settle: false,
    })

    return apiOk({
      ...result,
      historicalFeatureSnapshotWritePilot: snapshotWritePilot,
      historicalPredictionLineagePilot: predictionLineagePilot,
    }, id)
  } catch (error) {
    console.error('Historical import plan error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown historical import plan error'),
    })
  }
}

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const dataTypes = searchParams.get('dataTypes')
    const schemaCapabilities = await probeHistoricalFeatureSchemaCapabilities()
    const result = planHistoricalImport({
      sportKey: searchParams.get('sport') ?? searchParams.get('sportKey'),
      leagueKey: searchParams.get('league') ?? searchParams.get('leagueKey'),
      providerId: searchParams.get('provider') ?? searchParams.get('providerId'),
      season: searchParams.get('season'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      dataTypes: dataTypes ? dataTypes.split(',') : null,
      dryRun: true,
      batchSizeDays: Number(searchParams.get('batchSizeDays') ?? 7),
    }, schemaCapabilities)

    if (!result.success) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message: result.validation.errors.join(' '),
        status: 400,
      })
    }

    const snapshotWritePilot = await runHistoricalFeatureSnapshotWritePilot({
      dryRun: true,
      confirmed: false,
      maximumEvents: 5,
      maximumMarketsPerEvent: 3,
      maximumSnapshots: 15,
    })
    const predictionLineagePilot = await runHistoricalPredictionLineagePilot({
      dryRun: true,
      confirmed: false,
      maximumSnapshots: 15,
      maximumPredictions: 5,
      settle: false,
    })

    return apiOk({
      ...result,
      historicalFeatureSnapshotWritePilot: snapshotWritePilot,
      historicalPredictionLineagePilot: predictionLineagePilot,
    }, id)
  } catch (error) {
    console.error('Historical import plan GET error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown historical import plan error'),
    })
  }
}
