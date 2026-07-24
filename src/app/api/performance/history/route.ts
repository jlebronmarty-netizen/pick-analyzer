import { NextRequest, NextResponse } from 'next/server'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback
}

function sanitizeHistoryRow(row: Record<string, any>) {
  return {
    id: row.id,
    timestamp: row.timestamp ?? row.generatedAt ?? row.generated_at ?? null,
    sport: row.sport,
    league: row.league ?? null,
    matchup: row.matchup ?? null,
    prediction: row.prediction ?? null,
    probability: row.probability ?? null,
    confidence: row.confidence ?? null,
    modelVersion: row.modelVersion ?? null,
    category: row.category ?? 'uncategorized',
    result: row.result,
    lifecycleBadge: row.lifecycleBadge,
    actualResult: row.actualResult ?? null,
    correct: row.correct ?? null,
    push: row.push === true,
    pending: row.pending === true,
    official: row.official === true,
    shadow: row.shadow === true,
    missingData: Array.isArray(row.missingData) ? row.missingData.slice(0, 8) : [],
    settlement: row.settlement
      ? {
          settledAt: row.settlement.settledAt ?? null,
          details: row.settlement.details
            ? {
                source: row.settlement.details.source ?? row.settlement.details.settlementSource ?? null,
                reason: row.settlement.details.reason ?? row.settlement.details.settlementReason ?? null,
                version: row.settlement.details.version ?? row.settlement.details.settlementVersion ?? null,
              }
            : null,
        }
      : undefined,
    outcomeExplanation: row.outcomeExplanation,
    featureSnapshot: row.featureSnapshot
      ? {
          featureQualityScore: row.featureSnapshot.featureQualityScore ?? row.featureSnapshot.feature_quality ?? row.featureSnapshot.featureQuality ?? null,
          dataSufficiencyScore: row.featureSnapshot.dataSufficiencyScore ?? row.featureSnapshot.data_sufficiency ?? row.featureSnapshot.dataSufficiency ?? null,
          leakageStatus: row.featureSnapshot.leakageStatus ?? row.featureSnapshot.leakage_status ?? null,
          modelVersion: row.featureSnapshot.modelVersion ?? null,
        }
      : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const sportKey = request.nextUrl.searchParams.get('sportKey')
    const category = request.nextUrl.searchParams.get('category')
    const modelVersion = request.nextUrl.searchParams.get('modelVersion')
    const status = request.nextUrl.searchParams.get('status')
    const mode = request.nextUrl.searchParams.get('mode')
    const minConfidence = Number(request.nextUrl.searchParams.get('minConfidence') ?? Number.NaN)
    const maxConfidence = Number(request.nextUrl.searchParams.get('maxConfidence') ?? Number.NaN)
    const limit = boundedInteger(request.nextUrl.searchParams.get('limit'), 50, 1, 100)
    const page = boundedInteger(request.nextUrl.searchParams.get('page'), 1, 1, 10000)
    const offset = (page - 1) * limit
    const performanceScopeV2 = await getPerformanceScopeV2({ sportKey })
    const active = (value: string | null) => value && value !== 'all'
    const rows = performanceScopeV2.historyRows.filter((row) => {
      if (active(category) && row.category !== category) return false
      if (modelVersion && row.modelVersion !== modelVersion) return false
      if (active(status) && row.result !== status) return false
      if (mode === 'official' && !row.official) return false
      if (Number.isFinite(minConfidence) && Number(row.confidence ?? 0) < minConfidence) return false
      if (Number.isFinite(maxConfidence) && Number(row.confidence ?? 0) > maxConfidence) return false
      return true
    })
    const pageRows = rows.slice(offset, offset + limit).map((row) => sanitizeHistoryRow(row as Record<string, any>))
    return NextResponse.json({
      success: true,
      apiStatus: rows.length ? 'SUCCESS' : 'INSUFFICIENT_DATA',
      mode: 'performance_history_api_v1',
      generatedAt: performanceScopeV2.generatedAt,
      filters: { sportKey, category, modelVersion, status, mode, minConfidence: Number.isFinite(minConfidence) ? minConfidence : null, maxConfidence: Number.isFinite(maxConfidence) ? maxConfidence : null, limit, page },
      rows: pageRows,
      rowsV2: performanceScopeV2.historyPreview,
      pendingReasons: performanceScopeV2.pending.byReason,
      timelineV2: performanceScopeV2.timeline,
      totalRows: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit),
      immutableHistory: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown performance history error' }, { status: 500 })
  }
}
