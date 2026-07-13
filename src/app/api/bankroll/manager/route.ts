import { NextResponse } from 'next/server'
import { getBankrollManager } from '@/services/bankroll-manager.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const amount = searchParams.get('amount')
    const mode = searchParams.get('mode')

    const result = await getBankrollManager({
      amount,
      mode,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Bankroll manager v2 error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown bankroll manager error',
      },
      { status: 500 }
    )
  }
}