import 'server-only'

import {
  freezeMlbMoneylineForwardTracker,
  type FreezeMoneylineInput,
} from '@/services/mlb-moneyline-forward-freeze.service'

function hasSuppliedReadiness(input: FreezeMoneylineInput) {
  return Boolean(input.historyReadiness && typeof input.historyReadiness.targetDate === 'string')
}

export async function runMlbMoneylineForwardFreeze(input: FreezeMoneylineInput = {}) {
  const suppliedReadiness = hasSuppliedReadiness(input)
  const result = await freezeMlbMoneylineForwardTracker(input)
  const status = String(result.status ?? '')

  let mlbOfficialCalls = 0
  if (status === 'BLOCK_DAILY_HISTORY_NOT_READY') {
    mlbOfficialCalls = suppliedReadiness ? 0 : 1
  } else if (status !== 'NOT_IN_FREEZE_WINDOW') {
    // Once the 10:45 PR gate opens, the freeze always performs one MLB Official
    // current-slate read. A second MLB Official read occurs only when the caller
    // did not already supply the previous-day readiness result.
    mlbOfficialCalls = suppliedReadiness ? 1 : 2
  }

  return {
    ...result,
    providerCalls: {
      MLB_OFFICIAL: mlbOfficialCalls,
      sportsbook: 0,
    },
  }
}
