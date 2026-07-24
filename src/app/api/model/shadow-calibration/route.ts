import { NextResponse } from 'next/server'
import { getHistoricalShadowCalibration } from '@/services/historical-shadow-calibration.service'

export async function GET() {
  try {
    return NextResponse.json(await getHistoricalShadowCalibration())
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
