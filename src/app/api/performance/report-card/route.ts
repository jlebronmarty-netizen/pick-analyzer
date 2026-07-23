import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const sportKey = request.nextUrl.searchParams.get('sportKey')
  const data = await getAiPerformanceCenterLazy({ sportKey, dryRun: true })
  return NextResponse.json({ success: true, apiStatus: data.apiStatus, mode: 'performance_report_card_api_v1', generatedAt: data.generatedAt, reportCards: data.reportCards, providerCallsMade: 0, remoteMutationsMade: 0 })
}
