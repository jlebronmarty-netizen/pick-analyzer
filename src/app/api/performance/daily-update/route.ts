import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterDailyUpdateLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'
    const validationMode = request.nextUrl.searchParams.get('validationMode') === 'true'
    return NextResponse.json(await getAiPerformanceCenterDailyUpdateLazy({ dryRun, validationMode }))
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown performance daily update error' }, { status: 500 })
  }
}
