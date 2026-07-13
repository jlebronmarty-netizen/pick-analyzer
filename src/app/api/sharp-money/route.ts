import { NextResponse } from 'next/server'
import { getSharpMoneyIntelligence } from '@/services/sharp-money-intelligence.service'

export async function GET() {
  try {
    const result = await getSharpMoneyIntelligence()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sharp money intelligence failed:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Sharp money intelligence failed',
      },
      { status: 500 }
    )
  }
}