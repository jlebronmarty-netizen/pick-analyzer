import { NextRequest, NextResponse } from 'next/server'
import { getPerformanceScopeV2 } from '@/services/performance-scope-v2.service'

type PerformanceHistoryRow = {
  id?: string
  timestamp?: string | null
  generatedAt?: string | null
  generated_at?: string | null
  sport?: string | null
  league?: string | null
  matchup?: string | null
  prediction?: string | null
  probability?: number | null
  confidence?: number | null
  modelVersion?: string | null
  category?: string | null
  result?: string | null
  lifecycleBadge?: string | null
  actualResult?: string | null
  correct?: boolean | null
  probabilityError?: number | null
  brierContribution?: number | null
  push?: boolean | null
  pending?: boolean | null
  official?: boolean | null
  shadow?: boolean | null
  missingData?: unknown
  settlement?: {
    settledAt?: string | null
    details?: {
      source?: unknown
      settlementSource?: unknown
      reason?: unknown
      settlementReason?: unknown
      version?: unknown
      settlementVersion?: unknown
    } | null
  } | null
  outcomeExplanation?: string | null
  featureSnapshot?: {
    featureQualityScore?: unknown
    feature_quality?: unknown
    featureQuality?: unknown
    dataSufficiencyScore?: unknown
    data_sufficiency?: unknown
    dataSufficiency?: unknown
    leakageStatus?: unknown
    leakage_status?: unknown
    modelVersion?: unknown
  } | null
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback
}

function probabilityError(row: PerformanceHistoryRow) {
  const probability = Number(row.probability)
  if (row.correct === null || row.correct === undefined || !Number.isFinite(probability)) return null
  return Number((row.correct ? 100 - probability : probability).toFixed(2))
}

function brierContribution(row: PerformanceHistoryRow) {
  const probability = Number(row.probability)
  if (row.correct === null || row.correct === undefined || !Number.isFinite(probability)) return null
  return Number((((probability / 100) - (row.correct ? 1 : 0)) ** 2).toFixed(4))
}

function sanitizeHistoryRow(row: PerformanceHistoryRow) {
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
    probabilityError: probabilityError(row),
    probabilityErrorLabel: 'Absolute probability error in percentage points for this settled outcome.',
    brierContribution: brierContribution(row),
    brierContributionLabel: 'Per-prediction Brier contribution: squared probability error on a 0-1 scale.',
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
    const performanceScopeV2 = await getPerformanceScopeV2({
      sportKey,
      includeHistoryRows: true,
      maxPredictionRows: 5000,
    })
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
    const pageRows = rows.slice(offset, offset + limit).map((row) => sanitizeHistoryRow(row))
    const totalPages = Math.max(1, Math.ceil(rows.length / limit))
    return NextResponse.json({
      success: true,
      apiStatus: rows.length ? 'SUCCESS' : 'INSUFFICIENT_DATA',
      mode: 'performance_history_api_v1',
      generatedAt: performanceScopeV2.generatedAt,
      filters: { sportKey, category, modelVersion, status, mode, minConfidence: Number.isFinite(minConfidence) ? minConfidence : null, maxConfidence: Number.isFinite(maxConfidence) ? maxConfidence : null, limit, page },
      rows: pageRows,
      categories: Array.from(new Set(performanceScopeV2.historyRows.map((row) => row.category).filter(Boolean))).sort(),
      rowsV2: performanceScopeV2.historyPreview,
      scopePolicy: performanceScopeV2.scopePolicy,
      scopeReconciliation: {
        contract: 'performance_history_scope_v1',
        canonicalScope: 'cutoff_safe_production_scope',
        source: 'performance_scope_v2.historyRows',
        note: 'History rows use the same eligibility function as Trust, Accuracy, Calibration, Timeline and Report Card.',
      },
      pendingReasons: performanceScopeV2.pending.byReason,
      cutoffExclusions: performanceScopeV2.cutoffExclusions,
      schedulerCoverage: performanceScopeV2.schedulerCoverage,
      timelineV2: performanceScopeV2.timeline,
      queryDiagnostics: performanceScopeV2.queryDiagnostics,
      totalRows: rows.length,
      page,
      limit,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      immutableHistory: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    })
  } catch (error) {
    return NextResponse.json({ success: false, apiStatus: 'ERROR', error: error instanceof Error ? error.message : 'Unknown performance history error' }, { status: 500 })
  }
}
