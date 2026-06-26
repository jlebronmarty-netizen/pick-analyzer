import { NextResponse } from 'next/server'
import { getClvAnalytics } from '@/services/clv-analytics.service'

export async function GET() {
  try {
    const result = await getClvAnalytics()

    return NextResponse.json(result)
  } catch (error) {
    console.error('CLV analytics error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown CLV analytics error',
      },
      { status: 500 }
    )
  }
}