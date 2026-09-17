#!/usr/bin/env node

const EXPECTED_BRANCH = 'research/pa14-v2-historical-yield-execution-20260917'

if (
  process.env.VERCEL !== '1' ||
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
) {
  console.log(JSON.stringify({ status: 'PA14_V2_HISTORICAL_YIELD_PROBE_SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')

const targets = [
  { canonicalGamePk: 778105, expectedPitcherIds: [650633, 694738], targetPitcherId: 650633 },
]

for (const target of targets) {
  try {
    const evidence = await auditHistoricalPa14V2Target(target)
    console.log('PA14_V2_HISTORICAL_YIELD_PROBE_RESULT=' + JSON.stringify({
      status: 'COMPLETE',
      target: evidence.target,
      builderStatus: evidence.result.status,
      blockReasons: evidence.result.status === 'BLOCKED' ? evidence.result.reasons : [],
      replayMatch: evidence.replayMatch,
      historicalAuditEligible: evidence.historicalAuditEligible,
      certificationCandidate: false,
      productionEligible: false,
      researchOnly: true,
      features: evidence.result.status === 'ELIGIBLE' ? evidence.result.row.features : null,
      statistics: evidence.result.status === 'ELIGIBLE' ? evidence.result.row.statistics : null,
      audit: evidence.audit,
      boundaries: {
        supabaseWrites: 0,
        sportsbookCalls: 0,
        officialPicksModified: false,
        apostarActivated: false,
        modelTrainingAuthorized: false,
      },
    }))
  } catch (error) {
    console.log('PA14_V2_HISTORICAL_YIELD_PROBE_RESULT=' + JSON.stringify({
      status: 'REJECTED',
      canonicalGamePk: target.canonicalGamePk,
      pitcherMlbamId: target.targetPitcherId,
      error: error instanceof Error ? error.message : String(error),
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
    }))
  }
}
