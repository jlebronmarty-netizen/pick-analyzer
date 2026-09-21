import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'
import { freezeRunlineV2HomeP15Alternate } from '@/services/mlb-runline-home-p15-alt-forward-freeze.service'
import { freezeMlbRunlineV2StandardForward } from '@/services/mlb-runline-v2-standard-forward-freeze.service'
import { settleRunlineV2HomeP15Alternate } from '@/services/mlb-runline-home-p15-alt-forward-settlement.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 300

function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? ''
}

function authorized(request: NextRequest) {
  const secret = cronSecret()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function safeStandardFreeze() {
  try {
    return await freezeMlbRunlineV2StandardForward()
  } catch (error) {
    return {
      success: false,
      status: 'RUNLINE_STANDARD_V2_FORWARD_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      writes: 0,
      error: errorMessage(error, 'Unknown Standard Run Line V2 forward freeze error'),
    }
  }
}

async function safeFreeze() {
  try {
    return await freezeRunlineV2HomeP15Alternate()
  } catch (error) {
    return {
      success: false,
      status: 'RUNLINE_HOME_P15_FORWARD_FREEZE_FAILED_NON_BLOCKING',
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      writes: 0,
      error: errorMessage(error, 'Unknown Run Line V2 HOME +1.5 forward freeze error'),
    }
  }
}

async function safeSettlement(targetDate: string) {
  try {
    return await settleRunlineV2HomeP15Alternate(targetDate)
  } catch (error) {
    return {
      success: false,
      status: 'RUNLINE_HOME_P15_SETTLEMENT_FAILED_NON_BLOCKING',
      targetDate,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      roiCertified: false,
      writes: 0,
      error: errorMessage(error, 'Unknown Run Line V2 HOME +1.5 settlement error'),
    }
  }
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  if (!cronSecret()) {
    return apiError({
      id,
      code: 'AUTH_REQUIRED',
      message: 'CRON_SECRET must be configured before Run Line V2 forward research can run.',
      status: 503,
    })
  }
  if (!authorized(request)) {
    return apiError({ id, code: 'UNAUTHORIZED', message: 'Unauthorized Run Line V2 forward research request.', status: 401 })
  }

  // Freeze both Run Line research tracks independently before settlement.
  // Neither track may abort the other, and neither touches Official Picks/APOSTAR.
  const [standardFreeze, freeze] = await Promise.all([
    safeStandardFreeze(),
    safeFreeze(),
  ])

  let readiness: Awaited<ReturnType<typeof getMlbDailyHistoryReadiness>> | null = null
  let settlement: Awaited<ReturnType<typeof safeSettlement>> | null = null
  let readinessError: string | null = null

  try {
    readiness = await getMlbDailyHistoryReadiness()
    if (readiness.ready && typeof readiness.targetDate === 'string') {
      settlement = await safeSettlement(readiness.targetDate)
    }
  } catch (error) {
    readinessError = errorMessage(error, 'Unknown MLB daily-history readiness error')
  }

  const success = standardFreeze.success !== false && freeze.success !== false && (!settlement || settlement.success !== false)
  if (!success) {
    console.error('RUNLINE_V2_FORWARD_RESEARCH_PARTIAL', {
      standardStatus: standardFreeze.status ?? null,
      standardError: 'error' in standardFreeze ? standardFreeze.error : null,
      alternateStatus: freeze.status ?? null,
      alternateError: 'error' in freeze ? freeze.error : null,
      settlementStatus: settlement?.status ?? null,
      settlementError: settlement && 'error' in settlement ? settlement.error : null,
      readinessError,
    })
  }
  return apiOk({
    success,
    status: success ? 'RUNLINE_V2_FORWARD_RESEARCH_EVALUATED' : 'RUNLINE_V2_FORWARD_RESEARCH_PARTIAL',
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    roiCertified: false,
    pricingPolicyCertified: false,
    standardFreeze,
    freeze,
    dailyHistoryReadiness: readiness,
    readinessError,
    settlement,
  }, id, {
    status: success ? 200 : 500,
    headers: { 'Cache-Control': 'no-store' },
  })
}
