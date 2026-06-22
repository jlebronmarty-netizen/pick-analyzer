import { NextResponse } from 'next/server'
import { getAnalyticsCharts } from '@/services/analytics-charts.service'

export async function GET() {
  try {
    const data = await getAnalyticsCharts()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics charts failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown analytics charts error',
      },
      { status: 500 }
    )
  }
}