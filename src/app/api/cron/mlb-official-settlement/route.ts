import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { settleMlbOfficialPickBacklog } from '@/services/pick2-mlb-certified-settlement-cron.service'
import { freezeBdlPregameLineups } from '@/services/mlb-bdl-pregame-lineup-freeze.service'
import { captureBdlMainMarketMovement } from '@/services/mlb-bdl-main-market-movement-capture.service'
import { runMlbOpeningConsensusProspective } from '@/services/mlb-opening-consensus-prospective.service'
import { runMlbOpeningConsensusV2Shadow } from '@/services/mlb-opening-consensus-v2-forward.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ success: false, status: 'AUTH_REQUIRED' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, status: 'UNAUTHORIZED' }, { status: 401 })
  }

  let researchOpeningConsensusMoneyline: unknown
  try {
    researchOpeningConsensusMoneyline = await runMlbOpeningConsensusProspective()
  } catch (error) {
    researchOpeningConsensusMoneyline = {
      success: false,
      status: 'MLB_OPENING_CONSENSUS_PROSPECTIVE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      modelRetuned: false,
      historicalOddsApiCalls: 0,
      providerCallsMade: 0,
      error: error instanceof Error ? error.message : 'UNKNOWN_OPENING_CONSENSUS_PROSPECTIVE_ERROR',
    }
  }

  let researchOpeningConsensusMoneylineV2: unknown
  try {
    researchOpeningConsensusMoneylineV2 = await runMlbOpeningConsensusV2Shadow()
  } catch (error) {
    researchOpeningConsensusMoneylineV2 = {
      success: false,
      status: 'MLB_OPENING_CONSENSUS_V2_SHADOW_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_V2_SHADOW_ERROR',
    }
  }

  let researchMainMarketMovement: unknown
  try {
    researchMainMarketMovement = await captureBdlMainMarketMovement()
  } catch (error) {
    researchMainMarketMovement = {
      success: false,
      status: 'BDL_MAIN_MARKET_MOVEMENT_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      historicalOddsApiCalls: 0,
      providerCallsMade: 0,
      rowsInserted: 0,
      error: error instanceof Error ? error.message : 'UNKNOWN_BDL_MAIN_MARKET_CAPTURE_ERROR',
    }
  }

  let researchLineupCapture: unknown
  try {
    researchLineupCapture = await freezeBdlPregameLineups()
  } catch (error) {
    researchLineupCapture = {
      success: false,
      status: 'BDL_PREGAME_LINEUP_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      providerCallsMade: 0,
      rowsInserted: 0,
      error: error instanceof Error ? error.message : 'UNKNOWN_BDL_LINEUP_CAPTURE_ERROR',
    }
  }

  try {
    const result = await settleMlbOfficialPickBacklog()
    return NextResponse.json({
      ...result,
      researchLineupCapture,
      researchMainMarketMovement,
      researchOpeningConsensusMoneyline,
      researchOpeningConsensusMoneylineV2,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'MLB_OFFICIAL_SETTLEMENT_CRON_FAILED',
      error: error instanceof Error ? error.message : 'UNKNOWN_SETTLEMENT_CRON_ERROR',
      researchLineupCapture,
      researchMainMarketMovement,
      researchOpeningConsensusMoneyline,
      researchOpeningConsensusMoneylineV2,
      officialPicksModified: false,
      apostarActivated: false,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
