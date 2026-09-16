#!/usr/bin/env node

import { materializePa14V2RealBazRow } from '../src/services/pa14-v2-real-evidence.service.ts'

const evidence = await materializePa14V2RealBazRow()
const diagnostic = {
  target: evidence.target,
  result: evidence.result,
  replayMatch: evidence.replayMatch,
  researchOnly: evidence.researchOnly,
  productionEligible: evidence.productionEligible,
  audit: evidence.audit,
}
console.log(`PA14_V2_824466_DIAGNOSTIC=${JSON.stringify(diagnostic)}`)
if (evidence.result?.status !== 'ELIGIBLE') {
  throw new Error(`PA14_V2_824466_BLOCKED:${JSON.stringify(evidence.result)}`)
}
console.log('PA14_V2_824466_ELIGIBLE=YES')
