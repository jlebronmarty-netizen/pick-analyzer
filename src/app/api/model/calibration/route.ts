import { NextResponse } from 'next/server'
import { getModelCalibration } from '@/services/model-calibration.service'

export async function GET() {
  try {
    const result = await getModelCalibration()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Model calibration error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown model calibration error',
      },
      { status: 500 }
    )
  }
}