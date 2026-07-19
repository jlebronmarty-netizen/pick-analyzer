import { NextResponse } from 'next/server'
import { getBsnCalibrationEngine } from '@/services/bsn-model-maturity.service'

export async function GET() {
  try {
    const data = await getBsnCalibrationEngine()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN calibration error',
      },
      { status: 500 }
    )
  }
}
