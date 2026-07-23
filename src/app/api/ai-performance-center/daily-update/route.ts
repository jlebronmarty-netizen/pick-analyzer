import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterDailyUpdateLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') !== 'false'
    const validationMode = request.nextUrl.searchParams.get('validationMode') === 'true'
    const data = await getAiPerformanceCenterDailyUpdateLazy({ dryRun, validationMode })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AIPEC daily update error',
      },
      { status: 500 }
    )
  }
}
