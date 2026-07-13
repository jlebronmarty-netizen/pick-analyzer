import { NextResponse } from 'next/server'

import { settlePredictions } from '@/services/prediction-settlement.service'
import { runModelLearning } from '@/services/model-learning.service'
import { getClvAnalytics } from '@/services/clv-analytics.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getTeamStats } from '@/services/team-stats.service'

export async function GET() {
  try {
    const settlement = await settlePredictions()

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
        settlementCompleted: settlement.settled,
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

export async function POST() {
  return GET()
}