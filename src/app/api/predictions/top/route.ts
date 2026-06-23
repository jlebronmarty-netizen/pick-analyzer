import { NextResponse } from 'next/server'
import { getTopPicks } from '@/services/top-picks.service'

export async function GET() {
  try {
    const data = await getTopPicks()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Top picks failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown top picks error',
      },
      { status: 500 }
    )
  }
}