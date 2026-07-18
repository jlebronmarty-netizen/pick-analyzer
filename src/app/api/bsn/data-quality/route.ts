import { NextResponse } from 'next/server'
import { getBsnDataQualityStatus } from '@/services/bsn-platform.service'

export async function GET() {
  try {
    return NextResponse.json(await getBsnDataQualityStatus())
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown BSN data quality error',
      },
      { status: 500 }
    )
  }
}
