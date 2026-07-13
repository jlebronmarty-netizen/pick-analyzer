import { NextResponse } from 'next/server'
import { getModelWeights } from '@/services/model-learning.service'
import { getModelCalibration } from '@/services/model-calibration.service'
import { getModelHistory } from '@/services/model-versioning.service'

export async function GET() {
  try {
    const [weights, calibration, versions] = await Promise.all([
      getModelWeights(),
      getModelCalibration(),
      getModelHistory('baseball_mlb', 10),
    ])

    return NextResponse.json({
      success: true,
      weights,
      calibration,
      latestVersion: versions[0] ?? null,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unable to load model status',
      },
      { status: 500 }
    )
  }
}