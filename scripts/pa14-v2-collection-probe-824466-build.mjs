#!/usr/bin/env node

import { POST } from '../src/app/api/research/pa14/v2-collection-probe-824466/route.ts'

const response = await POST()
const body = await response.json()

const checks = [
  [response.status === 200, `http:${response.status}`],
  [body.status === 'PA14_V2_COLLECTION_PROBE_PASS', `status:${body.status}`],
  [body.canonicalGamePk === 824466, `gamePk:${body.canonicalGamePk}`],
  [body.pitcherMlbamId === 808967, `pitcher:${body.pitcherMlbamId}`],
  [body.replayStatus === 'PASS', `replay:${body.replayStatus}`],
  [body.certificationCandidate === true, 'candidate'],
  [body.productionEligible === false, 'productionEligible'],
  [body.shadowOnly === true, 'shadowOnly'],
  [body.networkCallsDuringStoredReplay === 0, 'storedReplayNetwork'],
  [body.deterministicReplay === true, 'deterministicReplay'],
  [body.expectedMatch === true, 'expectedMatch'],
  [body.lineageMatch === true, 'lineageMatch'],
  [body.temporalLeakageZero === true, 'temporalLeakage'],
]
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label)

console.log(`PA14_V2_COLLECTION_BUILD_RESULT=${JSON.stringify(body)}`)
if (failed.length) {
  throw new Error(`PA14_V2_COLLECTION_BUILD_ASSERTION_FAILED:${failed.join(',')}:${body.error ?? 'NO_ERROR_DETAIL'}`)
}
console.log('PA14_V2_COLLECTION_PROBE_824466=PASS')
