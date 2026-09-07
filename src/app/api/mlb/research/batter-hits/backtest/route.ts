import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runMlbBatterHitsBacktest } from '@/services/mlb-batter-hits-backtest.service'

export const dynamic = 'force-dynamic'
export const revalidate = 3600
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const rawReport = await runMlbBatterHitsBacktest()
    const report = {
      ...rawReport,
      probabilities: {
        ...rawReport.probabilities,
        externalHoldout2026: [],
        externalHoldout2026Status: 'BLOCKED_PENDING_OOS_2025_TEST_RESIDUAL_CALIBRATION',
        externalHoldout2026Reason:
          'The point-prediction holdout remains valid, but probability/Brier output is withheld until calibration residuals come from an untouched out-of-sample 2025 surface.',
      },
    }

    return apiOk(report, id, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown MLB batter hits backtest error'),
    })
  }
}
