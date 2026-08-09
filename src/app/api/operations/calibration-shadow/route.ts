import { NextRequest, NextResponse } from 'next/server'
import { getMlbCalibrationShadowV1 } from '@/services/mlb-calibration-shadow-v1.service'

export async function GET(request: NextRequest) {
  try {
    const currentLimit = Number(request.nextUrl.searchParams.get('currentLimit') ?? 500)
    return NextResponse.json(await getMlbCalibrationShadowV1({ currentLimit }))
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown calibration shadow error',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
