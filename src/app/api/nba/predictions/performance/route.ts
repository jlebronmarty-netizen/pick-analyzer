import { NextResponse } from 'next/server'
import { loadNbaPredictionSettlement } from '@/lib/server-lazy-diagnostics'

export async function GET() {
  try {
    const { getNbaPredictionPerformance } = await loadNbaPredictionSettlement()
    const result = await getNbaPredictionPerformance()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'NBA prediction performance failed',
      },
      { status: 500 }
    )
  }
}
