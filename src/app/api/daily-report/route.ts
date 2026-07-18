import { NextResponse } from 'next/server'
import { normalizeBankroll } from '@/services/bankroll.service'
import { getDailyReport } from '@/services/daily-report.service'
import { getDailyReportFast } from '@/services/daily-report-fast.service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bankroll = normalizeBankroll(searchParams.get('bankroll'))
    const mode = searchParams.get('mode')
    const summaryOnly = mode === 'summary' || searchParams.get('summary') === 'true'

    const result = summaryOnly
      ? {
          ...(await getDailyReportFast(bankroll)),
          mode: 'daily_report_summary_v1',
          advancedSectionsDeferred: true,
          sourceRoute: '/api/daily-report',
        }
      : await getDailyReport(bankroll)

    return NextResponse.json(result, { headers: { 'Cache-Control': summaryOnly ? 'private, max-age=30, stale-while-revalidate=120' : 'no-store, max-age=0' } })
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
