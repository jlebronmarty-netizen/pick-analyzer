import { NextResponse } from 'next/server'
import { getMlbCalibrationShadowV1 } from '@/services/mlb-calibration-shadow-v1.service'

export async function GET() {
  try {
    return NextResponse.json(await getMlbCalibrationShadowV1())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown shadow calibration error',
      },
      { status: 500 }
    )
  }
}
