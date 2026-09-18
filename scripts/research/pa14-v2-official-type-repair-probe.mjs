#!/usr/bin/env node
const EXPECTED_BRANCH = 'research/pa14-v2-official-type-repair-20260917'
if (
  process.env.VERCEL !== '1' ||
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
) {
  console.log(JSON.stringify({status:'PA14_V2_OFFICIAL_TYPE_REPAIR_PROBE_SKIPPED'}))
  process.exit(0)
}
const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')
const targets = [
  { canonicalGamePk: 776410, expectedPitcherIds: [676979, 806960], targetPitcherId: 676979 },
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 607074 },
]
for (const target of targets) {
  try {
    const evidence = await auditHistoricalPa14V2Target(target)
    console.log('PA14_V2_OFFICIAL_TYPE_REPAIR_PROBE=' + JSON.stringify({
      target:evidence.target,
      status:evidence.result.status,
      reasons:evidence.result.status==='BLOCKED'?evidence.result.reasons:[],
      historicalAuditEligible:evidence.historicalAuditEligible,
      replayMatch:evidence.replayMatch,
      sourceVersions:evidence.result.status==='ELIGIBLE'?evidence.result.row.sourceVersions:[],
      officialTypeRepairs:evidence.audit.officialTypeRepairs,
      productionEligible:false,
      researchOnly:true,
      supabaseWrites:0,
      sportsbookCalls:0,
      modelTrainingAuthorized:false,
    }))
  } catch (error) {
    console.log('PA14_V2_OFFICIAL_TYPE_REPAIR_PROBE_ERROR=' + JSON.stringify({
      target,
      error:error instanceof Error?error.message:String(error),
      productionEligible:false,
      researchOnly:true,
    }))
  }
}
