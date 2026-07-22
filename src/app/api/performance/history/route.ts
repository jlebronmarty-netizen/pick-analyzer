import { NextRequest, NextResponse } from 'next/server'
import { getAiPerformanceCenter } from '@/services/ai-performance-center.service'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const category = request.nextUrl.searchParams.get('category')
    const modelVersion = request.nextUrl.searchParams.get('modelVersion')
    const status = request.nextUrl.searchParams.get('status')
    const mode = request.nextUrl.searchParams.get('mode')
    const minConfidence = Number(request.nextUrl.searchParams.get('minConfidence') ?? Number.NaN)
    const maxConfidence = Number(request.nextUrl.searchParams.get('maxConfidence') ?? Number.NaN)
    const [data, performanceScopeV2] = await Promise.all([
      getAiPerformanceCenter({ sportKey, dryRun: true }),
      getPerformanceScopeV2({ sportKey }),
    ])
    const rows = data.predictionHistory.rows.filter((row) => {
      if (category && row.category !== category) return false
      if (modelVersion && row.modelVersion !== modelVersion) return false
      if (status && row.result !== status) return false
      if (mode === 'official' && !row.official) return false
      if (mode === 'shadow' && !row.shadow) return false
      if (Number.isFinite(minConfidence) && Number(row.confidence ?? 0) < minConfidence) return false
      if (Number.isFinite(maxConfidence) && Number(row.confidence ?? 0) > maxConfidence) return false
      return true
    })
    return NextResponse.json({
      success: true,
      apiStatus: rows.length ? 'SUCCESS' : 'INSUFFICIENT_DATA',
      mode: 'performance_history_api_v1',
      generatedAt: data.generatedAt,
      filters: { sportKey, category, modelVersion, status, mode, minConfidence: Number.isFinite(minConfidence) ? minConfidence : null, maxConfidence: Number.isFinite(maxConfidence) ? maxConfidence : null },
      rows,
      rowsV2: performanceScopeV2.historyPreview,
      pendingReasons: performanceScopeV2.pending.byReason,
      timelineV2: performanceScopeV2.timeline,
      totalRows: rows.length,
      immutableHistory: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown performance history error' }, { status: 500 })
  }
}
