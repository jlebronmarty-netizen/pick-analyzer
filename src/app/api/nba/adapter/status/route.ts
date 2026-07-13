import { NextResponse } from 'next/server'
import { getNbaAdapterStatus } from '@/services/nba-adapter.service'

export async function GET() {
  try {
    const result = await getNbaAdapterStatus()

    return NextResponse.json(result)
  } catch (error) {
    console.error('NBA Adapter status failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA Adapter status failed',
      },
      { status: 500 }
    )
  }
}