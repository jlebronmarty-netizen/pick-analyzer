import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenter } from '@/services/ai-performance-center.service'

export async function GET(request: NextRequest) {
  const sportKey = request.nextUrl.searchParams.get('sportKey')
  const data = await getAiPerformanceCenter({ sportKey, dryRun: true })
  return NextResponse.json({ success: true, apiStatus: data.apiStatus, mode: 'performance_goals_api_v1', generatedAt: data.generatedAt, goals: data.goals, providerCallsMade: 0, remoteMutationsMade: 0 })
}
