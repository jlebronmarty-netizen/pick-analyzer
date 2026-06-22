import { NextResponse } from 'next/server'
import { getAnalyticsDashboard } from '@/services/analytics.service'

export async function GET() {
  try {
    const result = await getAnalyticsDashboard()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analytics dashboard error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}