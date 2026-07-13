import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { getDailyReportFast } from '@/services/daily-report-fast.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))

    const result = await getDailyReportFast(bankroll)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Fast daily report error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown fast daily report error',
      },
      { status: 500 }
    )
  }
}