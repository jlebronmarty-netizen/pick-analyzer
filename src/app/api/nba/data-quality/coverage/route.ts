import { NextResponse } from 'next/server'
import { getNbaDataQualityCoverage } from '@/services/nba-data-quality.service'

export async function GET() {
  try {
    const result = await getNbaDataQualityCoverage()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA data quality coverage failed',
      },
      { status: 500 }
    )
  }
}
