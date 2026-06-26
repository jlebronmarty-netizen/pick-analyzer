import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { getDailyReport } from '@/services/daily-report.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))

    const result = await getDailyReport(bankroll)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Daily report error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown daily report error',
      },
      { status: 500 }
    )
  }
}