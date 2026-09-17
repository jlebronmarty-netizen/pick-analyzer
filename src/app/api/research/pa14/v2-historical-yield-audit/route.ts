import { NextResponse } from 'next/server'

import {
  auditHistoricalPa14V2Target,
  type Pa14HistoricalAuditTarget,
} from '@/services/pa14-v2-historical-yield-audit.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TARGETS = new Map<number, Pa14HistoricalAuditTarget>([
  [778105, { canonicalGamePk: 778105, expectedPitcherIds: [650633, 694738], targetPitcherId: 650633 }],
  [777291, { canonicalGamePk: 777291, expectedPitcherIds: [657277, 669194], targetPitcherId: 657277 }],
  [776136, { canonicalGamePk: 776136, expectedPitcherIds: [676664, 694297], targetPitcherId: 676664 }],
])

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const first = message.split(':')[0]?.trim() || 'UNKNOWN_ERROR'
  if (/Starter reconciliation failed/i.test(message)) return { reason: 'STARTER_RECONCILIATION_FAILED', message }
  if (/Opponent reconciliation failed/i.test(message)) return { reason: 'OPPONENT_RECONCILIATION_FAILED', message }
  if (/Uncertified unfinished witness/i.test(message)) return { reason: 'INCOMPLETE_PA', message }
  if (/Missing .* provenance|Schedule coverage incomplete/i.test(message)) return { reason: 'TEMPORAL_PROVENANCE_MISSING', message }
  return { reason: first, message }
}

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store, max-age=0' }
  const gamePk = Number(new URL(request.url).searchParams.get('gamePk'))
  const target = TARGETS.get(gamePk)
  if (!target) {
    return NextResponse.json({
      status: 'INVALID_TARGET',
      allowedGamePks: [...TARGETS.keys()],
      researchOnly: true,
      productionEligible: false,
    }, { status: 400, headers })
  }

  try {
    const evidence = await auditHistoricalPa14V2Target(target)
    const result = evidence.result
    return NextResponse.json({
      status: 'PA14_V2_HISTORICAL_YIELD_AUDIT_COMPLETE',
      canonicalGamePk: gamePk,
      pitcherMlbamId: target.targetPitcherId,
      builderStatus: result.status,
      blockReasons: result.status === 'BLOCKED' ? result.reasons : [],
      replayMatch: evidence.replayMatch,
      historicalAuditEligible: evidence.historicalAuditEligible,
      certificationCandidate: false,
      productionEligible: false,
      researchOnly: true,
      target: evidence.target,
      features: result.status === 'ELIGIBLE' ? result.row.features : null,
      statistics: result.status === 'ELIGIBLE' ? result.row.statistics : null,
      audit: {
        builderVersion: evidence.audit.builderVersion,
        startCount: evidence.audit.startCount,
        opponentGameCount: evidence.audit.opponentGameCount,
        pitcherStatcastRows: evidence.audit.pitcherStatcastRows,
        opponentStatcastRows: evidence.audit.opponentStatcastRows,
        missingOpponentGames: evidence.audit.missingOpponentGames,
        unfinishedOpponentPas: evidence.audit.unfinishedOpponentPas,
        maxHistoricalCompletion: evidence.audit.maxHistoricalCompletion,
        censusDigest: evidence.audit.censusDigest,
        archivedTarget: evidence.audit.archivedTarget,
      },
      boundaries: {
        supabaseWrites: 0,
        sportsbookCalls: 0,
        officialPicksModified: false,
        apostarActivated: false,
        modelTrainingAuthorized: false,
      },
    }, { status: 200, headers })
  } catch (error) {
    const classified = classifyError(error)
    return NextResponse.json({
      status: 'PA14_V2_HISTORICAL_YIELD_AUDIT_REJECTED',
      canonicalGamePk: gamePk,
      pitcherMlbamId: target.targetPitcherId,
      rejectionReason: classified.reason,
      error: classified.message,
      certificationCandidate: false,
      productionEligible: false,
      researchOnly: true,
      boundaries: {
        supabaseWrites: 0,
        sportsbookCalls: 0,
        officialPicksModified: false,
        apostarActivated: false,
        modelTrainingAuthorized: false,
      },
    }, { status: 200, headers })
  }
}
