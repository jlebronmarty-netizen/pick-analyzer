import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { buildHedges } from '@/services/hedge-builder.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))

    const result = await buildHedges(bankroll)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Hedge builder error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown hedge error',
      },
      { status: 500 }
    )
  }
}