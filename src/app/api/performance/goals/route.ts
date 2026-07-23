import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenterLazy } from '@/lib/server-lazy-diagnostics'

export async function GET(request: NextRequest) {
  const sportKey = request.nextUrl.searchParams.get('sportKey')
  const data = await getAiPerformanceCenterLazy({ sportKey, dryRun: true })
  return NextResponse.json({ success: true, apiStatus: data.apiStatus, mode: 'performance_goals_api_v1', generatedAt: data.generatedAt, goals: data.goals, providerCallsMade: 0, remoteMutationsMade: 0 })
}
