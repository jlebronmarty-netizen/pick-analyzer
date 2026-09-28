import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { syncMlb2026ForwardMasterLedger } from '@/services/mlb-forward-master-ledger.service'
import { freezeMlbExactLineForwardShadows, settleMlbExactLineForwardShadows } from '@/services/mlb-exact-line-forward-shadow.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() ?? ''
  if (!secret) return false
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json({ success: false, status: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const settlement = await settleMlbExactLineForwardShadows()
    const freeze = await freezeMlbExactLineForwardShadows()
    const ledger = await syncMlb2026ForwardMasterLedger()
    return Response.json({
      success: true,
      status: 'MLB_FORWARD_RESEARCH_SYNCED',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      settlement,
      freeze,
      ledger,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({
      success: false,
      status: 'MLB_2026_FORWARD_MASTER_LEDGER_SYNC_BLOCKED',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      error: error instanceof Error ? error.message : 'Unknown forward master ledger sync error',
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
