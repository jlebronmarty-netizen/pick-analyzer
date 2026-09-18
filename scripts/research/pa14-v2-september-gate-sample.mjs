#!/usr/bin/env node
const EXPECTED_BRANCH='research/pa14-v2-september-gate-sample-20260917'
if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH){
 console.log(JSON.stringify({status:'PA14_V2_SEPTEMBER_GATE_SAMPLE_SKIPPED'})); process.exit(0)
}
const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')
const targets=[
  { canonicalGamePk:776506, expectedPitcherIds:[607067,675911], targetPitcherId:607067 },
  { canonicalGamePk:776506, expectedPitcherIds:[607067,675911], targetPitcherId:675911 },
  { canonicalGamePk:776430, expectedPitcherIds:[579328,669372], targetPitcherId:579328 },
  { canonicalGamePk:776430, expectedPitcherIds:[579328,669372], targetPitcherId:669372 },
  { canonicalGamePk:776395, expectedPitcherIds:[683004,694477], targetPitcherId:683004 },
  { canonicalGamePk:776395, expectedPitcherIds:[683004,694477], targetPitcherId:694477 },
  { canonicalGamePk:776373, expectedPitcherIds:[669302,700241], targetPitcherId:669302 },
  { canonicalGamePk:776373, expectedPitcherIds:[669302,700241], targetPitcherId:700241 },
  { canonicalGamePk:776350, expectedPitcherIds:[434378,808967], targetPitcherId:434378 },
  { canonicalGamePk:776350, expectedPitcherIds:[434378,808967], targetPitcherId:808967 },
  { canonicalGamePk:776354, expectedPitcherIds:[547179,621111], targetPitcherId:547179 },
  { canonicalGamePk:776354, expectedPitcherIds:[547179,621111], targetPitcherId:621111 },
  { canonicalGamePk:776346, expectedPitcherIds:[686613,693821], targetPitcherId:686613 },
  { canonicalGamePk:776346, expectedPitcherIds:[686613,693821], targetPitcherId:693821 },
  { canonicalGamePk:776317, expectedPitcherIds:[543294,669923], targetPitcherId:543294 },
  { canonicalGamePk:776317, expectedPitcherIds:[543294,669923], targetPitcherId:669923 },
  { canonicalGamePk:776313, expectedPitcherIds:[607074,680573], targetPitcherId:607074 },
  { canonicalGamePk:776313, expectedPitcherIds:[607074,680573], targetPitcherId:680573 },
  { canonicalGamePk:776304, expectedPitcherIds:[605280,650633], targetPitcherId:605280 },
  { canonicalGamePk:776304, expectedPitcherIds:[605280,650633], targetPitcherId:650633 },
  { canonicalGamePk:776284, expectedPitcherIds:[661563,671737], targetPitcherId:661563 },
  { canonicalGamePk:776284, expectedPitcherIds:[661563,671737], targetPitcherId:671737 },
  { canonicalGamePk:776275, expectedPitcherIds:[669373,676440], targetPitcherId:669373 },
  { canonicalGamePk:776275, expectedPitcherIds:[669373,676440], targetPitcherId:676440 },
  { canonicalGamePk:776255, expectedPitcherIds:[592836,669194], targetPitcherId:592836 },
  { canonicalGamePk:776255, expectedPitcherIds:[592836,669194], targetPitcherId:669194 },
  { canonicalGamePk:776242, expectedPitcherIds:[683004,800049], targetPitcherId:683004 },
  { canonicalGamePk:776242, expectedPitcherIds:[683004,800049], targetPitcherId:800049 },
  { canonicalGamePk:776235, expectedPitcherIds:[650633,680732], targetPitcherId:650633 },
  { canonicalGamePk:776235, expectedPitcherIds:[650633,680732], targetPitcherId:680732 },
  { canonicalGamePk:776221, expectedPitcherIds:[519242,669022], targetPitcherId:519242 },
  { canonicalGamePk:776221, expectedPitcherIds:[519242,669022], targetPitcherId:669022 },
  { canonicalGamePk:776210, expectedPitcherIds:[571578,805673], targetPitcherId:571578 },
  { canonicalGamePk:776210, expectedPitcherIds:[571578,805673], targetPitcherId:805673 },
  { canonicalGamePk:776223, expectedPitcherIds:[665152,686752], targetPitcherId:665152 },
  { canonicalGamePk:776223, expectedPitcherIds:[665152,686752], targetPitcherId:686752 },
  { canonicalGamePk:776188, expectedPitcherIds:[621111,676083], targetPitcherId:621111 },
  { canonicalGamePk:776188, expectedPitcherIds:[621111,676083], targetPitcherId:676083 },
  { canonicalGamePk:776171, expectedPitcherIds:[641793,682990], targetPitcherId:641793 },
  { canonicalGamePk:776171, expectedPitcherIds:[641793,682990], targetPitcherId:682990 },
]
for(const target of targets){
 try{
  const evidence=await auditHistoricalPa14V2Target(target)
  console.log('PA14_V2_SEPTEMBER_GATE_RESULT='+JSON.stringify({
   status:'COMPLETE',target:evidence.target,builderStatus:evidence.result.status,
   blockReasons:evidence.result.status==='BLOCKED'?evidence.result.reasons:[],
   replayMatch:evidence.replayMatch,historicalAuditEligible:evidence.historicalAuditEligible,
   repairCount:(evidence.audit?.officialTypeRepairs?.pitcher?.length??0)+(evidence.audit?.officialTypeRepairs?.opponent?.length??0),
   productionEligible:false,researchOnly:true,
   boundaries:{supabaseWrites:0,sportsbookCalls:0,modelTrainingAuthorized:false}
  }))
 }catch(error){
  console.log('PA14_V2_SEPTEMBER_GATE_RESULT='+JSON.stringify({
   status:'REJECTED',canonicalGamePk:target.canonicalGamePk,pitcherMlbamId:target.targetPitcherId,
   error:error instanceof Error?error.message:String(error),repairCount:0,
   productionEligible:false,researchOnly:true,boundaries:{supabaseWrites:0,sportsbookCalls:0,modelTrainingAuthorized:false}
  }))
 }
}
