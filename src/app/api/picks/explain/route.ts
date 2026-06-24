import { NextResponse } from 'next/server'
import { explainTopPicks } from '@/services/explainability.service'

export async function GET() {
  try {
    const result = await explainTopPicks()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Pick explainability error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown explainability error',
      },
      { status: 500 }
    )
  }
}