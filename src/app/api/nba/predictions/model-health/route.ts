import { NextResponse } from 'next/server'
import { loadNbaPredictionSettlement } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getNbaModelHealthV2 } = await loadNbaPredictionSettlement()
    const result = await getNbaModelHealthV2()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA model health V2 failed',
      },
      { status: 500 }
    )
  }
}
