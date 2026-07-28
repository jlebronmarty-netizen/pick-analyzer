import { NextRequest, NextResponse } from 'next/server'
import {
  getAutonomousDailyAiPlan,
  runAutonomousDailyAiDryRun,
  validateAutonomousDailyAiFixtures,
} from '@/services/autonomous-daily-ai.service'

export async function GET(request: NextRequest) {
  try {
    const validate = request.nextUrl.searchParams.get('validate') === 'true'
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
    const expectedAction = request.nextUrl.searchParams.get('expectedAction')

    if (validate) {
      return NextResponse.json({
        mode: 'autonomous_daily_ai_v1_validation',
        ...validateAutonomousDailyAiFixtures(),
      })
    }

    if (dryRun) {
      return NextResponse.json(await runAutonomousDailyAiDryRun({ expectedAction }))
    }

    return NextResponse.json(await getAutonomousDailyAiPlan())
  } catch (error) {
    console.error('Autonomous Daily AI failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Autonomous Daily AI failed',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const expectedAction = typeof body.expectedAction === 'string' ? body.expectedAction : null
    return NextResponse.json(await runAutonomousDailyAiDryRun({ expectedAction }))
  } catch (error) {
    console.error('Autonomous Daily AI dry-run failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Autonomous Daily AI dry-run failed',
        providerCallsMade: 0,
        remoteMutationsMade: 0,
      },
      { status: 500 }
    )
  }
}
