import { NextResponse } from 'next/server'
import { getNbaDataQualityAudit } from '@/services/nba-data-quality.service'

export async function GET() {
  try {
    const result = await getNbaDataQualityAudit()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA data quality audit failed',
      },
      { status: 500 }
    )
  }
}
