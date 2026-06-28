import { NextResponse } from 'next/server'
import { getAIGameAnalysis } from '@/services/ai-game-analysis.service'

export async function GET() {
  try {
    const result = await getAIGameAnalysis()

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI game analysis error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown AI game analysis error',
      },
      { status: 500 }
    )
  }
}