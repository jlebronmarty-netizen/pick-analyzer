import { NextResponse } from 'next/server'
import { generateSmartParlays } from '@/services/parlay-generator.service'

export async function GET() {
  try {
    const result = await generateSmartParlays()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Parlay generator error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown parlay generator error',
      },
      { status: 500 }
    )
  }
}