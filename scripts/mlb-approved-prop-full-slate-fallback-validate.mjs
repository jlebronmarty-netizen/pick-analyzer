import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const capture=fs.readFileSync('src/services/mlb-approved-prop-market-capture.service.ts','utf8')
const bdl=fs.readFileSync('src/services/mlb-approved-prop-balldontlie-capture.service.ts','utf8')
const evaluator=fs.readFileSync('src/services/mlb-approved-prop-daily-evaluation.service.ts','utf8')

test('Odds API reserve is checked before the per-event loop',()=>{
  const preflight=capture.indexOf('const knownRemainingBefore = await latestKnownRequestsRemaining(targetDate)')
  const loop=capture.indexOf('if (oddsApiAllowed) for (const item of planned)')
  assert(preflight>=0)
  assert(loop>preflight)
  assert(capture.includes('knownRemainingBefore === null || knownRemainingBefore > CREDIT_RESERVE'))
})

test('capture completion is coverage-aware and can use BDL fallback',()=>{
  assert(capture.includes('const oddsCoverageComplete = planned.every'))
  assert(capture.includes('captureApprovedPropsFromBallDontLie'))
  assert(capture.includes('const combinedCoverageComplete = oddsCoverageComplete || Boolean(bdlFallback?.coverageComplete)'))
  assert(capture.includes('coverageComplete: combinedCoverageComplete'))
})

test('BDL fallback preserves exact identity and strict pregame rules',()=>{
  assert(bdl.includes("fuzzyMatchingUsed: false"))
  assert(bdl.includes("BDL_PLAYER_NAME_TO_MLB_DIRECTORY_UNIQUE_EXACT_NORMALIZED_NAME"))
  assert(bdl.includes("Date.parse(updatedAt) >= Date.parse(input.event.startTime)"))
  assert(bdl.includes("marketType === 'over_under'"))
  assert(bdl.includes("provider: PROVIDER"))
  assert(bdl.includes("const PROVIDER = 'balldontlie'"))
})

test('daily evaluator reads both approved capture providers',()=>{
  assert(evaluator.includes("query.in('provider', ['the-odds-api', 'balldontlie'])"))
  assert(evaluator.includes('CAPTURE_SOURCES.has'))
})
