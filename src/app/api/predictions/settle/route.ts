import { NextResponse } from 'next/server'

import { settlePredictions } from '@/services/prediction-settlement.service'
import { runModelLearning } from '@/services/model-learning.service'
import { getClvAnalytics } from '@/services/clv-analytics.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getTeamStats } from '@/services/team-stats.service'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const { searchParams } = new URL(request.url)
  return request.headers.get('authorization') === `Bearer ${secret}` || searchParams.get('secret') === secret
}

function parseDryRun(request: Request, defaultValue: boolean) {
  const { searchParams } = new URL(request.url)
  const value = searchParams.get('dryRun')
  if (value === null) return defaultValue
  return value === 'true'
}

async function handle(request: Request, defaultDryRun: boolean) {
  try {
    const dryRun = parseDryRun(request, defaultDryRun)
    if (!dryRun && !authorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const settlement = await settlePredictions({ dryRun })

    let learning = null
    let clv = null
    let calibration = null
    let ratings = null

    if (settlement.settled > 0) {
      learning = await runModelLearning('baseball_mlb')

      try {
        clv = await getClvAnalytics()
      } catch (error) {
        console.error('CLV update failed', error)
      }

      try {
        calibration = await getModelCalibration()
      } catch (error) {
        console.error('Calibration failed', error)
      }

      try {
        ratings = await getTeamStats()
      } catch (error) {
        console.error('Ratings failed', error)
      }
    }

    return NextResponse.json({
      success: true,

      pipeline: {
        dryRun,
        settlementCompleted: settlement.settled,
        settlementWouldComplete: settlement.wouldSettle ?? 0,
        learningCompleted: !!learning,
        clvUpdated: !!clv,
        calibrationUpdated: !!calibration,
        ratingsUpdated: !!ratings,
      },

      settlement,
      learning,
      clv,
      calibration,
      ratings,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown settlement error',
      },
      {
        status: 500,
      }
    )
  }
}

export async function GET(request: Request) {
  return handle(request, true)
}

export async function POST(request: Request) {
  return handle(request, false)
}
