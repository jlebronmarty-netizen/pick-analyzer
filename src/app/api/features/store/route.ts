import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getFeatureStoreStatus } from '@/services/feature-store-core.service'
import {
  runHistoricalFeatureSnapshotWritePilot,
  runHistoricalPredictionLineagePilot,
} from '@/services/historical-feature-generation.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)

  try {
    return apiOk(getFeatureStoreStatus(), id)
  } catch (error) {
    console.error('Feature Store status error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Feature Store status error'),
    })
  }
}

export async function POST(request: NextRequest) {
  const id = requestId(request)

  try {
    const body = await request.json().catch(() => ({}))

    if (
      body?.action !== 'historical_feature_snapshot_write_pilot' &&
      body?.action !== 'historical_prediction_snapshot_lineage_pilot'
    ) {
      return apiError({
        id,
        code: 'BAD_REQUEST',
        message:
          'Unsupported Feature Store action. Use historical_feature_snapshot_write_pilot or historical_prediction_snapshot_lineage_pilot for bounded pilots.',
        status: 400,
      })
    }

    if (body?.action === 'historical_prediction_snapshot_lineage_pilot') {
      const result = await runHistoricalPredictionLineagePilot({
        dryRun: body?.dryRun ?? true,
        confirmed: body?.confirmed ?? false,
        sportKey: body?.sportKey ?? null,
        leagueKey: body?.leagueKey ?? null,
        season: body?.season ?? null,
        eventId: body?.eventId ?? null,
        markets: Array.isArray(body?.markets) ? body.markets : null,
        maximumSnapshots: body?.maximumSnapshots ?? null,
        maximumPredictions: body?.maximumPredictions ?? null,
        settle: body?.settle ?? true,
      })

      return apiOk(result, id)
    }

    const result = await runHistoricalFeatureSnapshotWritePilot({
      dryRun: body?.dryRun ?? true,
      confirmed: body?.confirmed ?? false,
      sportKey: body?.sportKey ?? null,
      leagueKey: body?.leagueKey ?? null,
      season: body?.season ?? null,
      eventId: body?.eventId ?? null,
      markets: Array.isArray(body?.markets) ? body.markets : null,
      maximumEvents: body?.maximumEvents ?? null,
      maximumMarketsPerEvent: body?.maximumMarketsPerEvent ?? null,
      maximumSnapshots: body?.maximumSnapshots ?? null,
      cancelAfterSnapshots: body?.cancelAfterSnapshots ?? null,
    })

    return apiOk(result, id)
  } catch (error) {
    console.error('Feature Store write action error:', { requestId: id, error })

    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown Feature Store write action error'),
    })
  }
}
