import fs from 'node:fs'

const adaptive = fs.readFileSync('src/services/adaptive-refresh-orchestrator.service.ts', 'utf8')
const trace = fs.readFileSync('src/services/recommendation-pipeline-trace.service.ts', 'utf8')

const checks = [
  [
    'adaptive status detects pregame odds due',
    adaptive.includes("const pregameOddsDue = dueDomains.includes('odds') && marketRefreshNeeded"),
  ],
  [
    'adaptive status prioritizes odds before settlement backlog',
    adaptive.indexOf('pregameOddsDue') < adaptive.indexOf("dueDomains.includes('settlement')"),
  ],
  [
    'adaptive execution also guards against settlement masking odds',
    adaptive.includes("status.marketRefreshEligibility?.marketRefreshNeeded === true") &&
      adaptive.includes("Number(status.gamesWaitingForOdds ?? 0) > 0"),
  ],
  [
    'stale available odds can trigger pregame refresh before settlement',
    adaptive.includes("status.marketRefreshEligibility?.marketRefreshNeeded === true || Number(status.gamesWaitingForOdds ?? 0) > 0"),
  ],
  [
    'learning labels are derived from production settled predictions',
    trace.includes('const productionSettledPredictions = predictions.filter(isProductionSettled)') &&
      trace.includes('const acceptedLearningLabels = productionSettledPredictions.filter(hasFeatureEvidence).length'),
  ],
  [
    'learning labels no longer count ai performance snapshots',
    !trace.includes("safeCount('ai_performance_snapshots'"),
  ],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

const result = {
  success: failedChecks.length === 0,
  mode: 'mlb_operating_day_recovery_v1_validation',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))

if (!result.success) process.exit(1)
