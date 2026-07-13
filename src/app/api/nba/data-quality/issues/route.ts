import { NextResponse } from 'next/server'
import { getNbaDataQualityIssues } from '@/services/nba-data-quality.service'

export async function GET() {
  try {
    const result = await getNbaDataQualityIssues()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA data quality issues failed',
      },
      { status: 500 }
    )
  }
}
