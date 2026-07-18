import { NextResponse } from 'next/server'
import { getBsnFeatureEngineeringValidation } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnFeatureEngineeringValidation())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN feature validation error',
      },
      { status: 500 }
    )
  }
}
