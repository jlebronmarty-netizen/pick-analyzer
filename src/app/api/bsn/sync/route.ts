import { NextResponse } from 'next/server'
import { syncBsnResultsToGameResults } from '@/services/bsn.service'

export async function GET() {
  try {
    const data = await syncBsnResultsToGameResults()

    return NextResponse.json({
      success: true,
      message: 'BSN results synced to game_results',
      data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}