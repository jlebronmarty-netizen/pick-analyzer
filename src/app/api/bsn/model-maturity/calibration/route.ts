import { NextResponse } from 'next/server'
import { loadBsnModelMaturity } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getBsnCalibrationEngine } = await loadBsnModelMaturity()
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
