#!/usr/bin/env node
const EXPECTED_BRANCH='research/pa14-v2-repaired-yield-sample2-20260917'
if(process.env.VERCEL!=='1'||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==EXPECTED_BRANCH){
 console.log(JSON.stringify({status:'PA14_V2_REPAIRED_SAMPLE2_SKIPPED'})); process.exit(0)
}
const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')
const targets=[
  { canonicalGamePk: 778179, expectedPitcherIds: [594902, 656557], targetPitcherId: 594902 },
  { canonicalGamePk: 778179, expectedPitcherIds: [594902, 656557], targetPitcherId: 656557 },
  { canonicalGamePk: 778147, expectedPitcherIds: [680885, 694297], targetPitcherId: 680885 },
  { canonicalGamePk: 778147, expectedPitcherIds: [680885, 694297], targetPitcherId: 694297 },
  { canonicalGamePk: 778155, expectedPitcherIds: [665152, 669373], targetPitcherId: 665152 },
  { canonicalGamePk: 778155, expectedPitcherIds: [665152, 669373], targetPitcherId: 669373 },
  { canonicalGamePk: 778126, expectedPitcherIds: [601713, 657277], targetPitcherId: 601713 },
  { canonicalGamePk: 778126, expectedPitcherIds: [601713, 657277], targetPitcherId: 657277 },
  { canonicalGamePk: 778128, expectedPitcherIds: [547179, 671737], targetPitcherId: 547179 },
  { canonicalGamePk: 778128, expectedPitcherIds: [547179, 671737], targetPitcherId: 671737 },
  { canonicalGamePk: 778135, expectedPitcherIds: [571760, 684007], targetPitcherId: 571760 },
  { canonicalGamePk: 778135, expectedPitcherIds: [571760, 684007], targetPitcherId: 684007 },
  { canonicalGamePk: 778031, expectedPitcherIds: [669713, 694477], targetPitcherId: 669713 },
  { canonicalGamePk: 778031, expectedPitcherIds: [669713, 694477], targetPitcherId: 694477 },
  { canonicalGamePk: 778046, expectedPitcherIds: [594902, 695418], targetPitcherId: 594902 },
  { canonicalGamePk: 778046, expectedPitcherIds: [594902, 695418], targetPitcherId: 695418 },
  { canonicalGamePk: 777872, expectedPitcherIds: [607067, 686563], targetPitcherId: 607067 },
  { canonicalGamePk: 777872, expectedPitcherIds: [607067, 686563], targetPitcherId: 686563 },
  { canonicalGamePk: 777815, expectedPitcherIds: [678394, 700249], targetPitcherId: 678394 },
  { canonicalGamePk: 777815, expectedPitcherIds: [678394, 700249], targetPitcherId: 700249 },
  { canonicalGamePk: 777736, expectedPitcherIds: [642547, 678394], targetPitcherId: 642547 },
  { canonicalGamePk: 777736, expectedPitcherIds: [642547, 678394], targetPitcherId: 678394 },
  { canonicalGamePk: 777718, expectedPitcherIds: [607536, 656849], targetPitcherId: 607536 },
  { canonicalGamePk: 777718, expectedPitcherIds: [607536, 656849], targetPitcherId: 656849 },
  { canonicalGamePk: 777646, expectedPitcherIds: [669358, 677958], targetPitcherId: 669358 },
  { canonicalGamePk: 777646, expectedPitcherIds: [669358, 677958], targetPitcherId: 677958 },
  { canonicalGamePk: 777625, expectedPitcherIds: [641793, 665795], targetPitcherId: 641793 },
  { canonicalGamePk: 777625, expectedPitcherIds: [641793, 665795], targetPitcherId: 665795 },
  { canonicalGamePk: 777626, expectedPitcherIds: [669373, 676962], targetPitcherId: 669373 },
  { canonicalGamePk: 777626, expectedPitcherIds: [669373, 676962], targetPitcherId: 676962 },
  { canonicalGamePk: 777535, expectedPitcherIds: [608566, 693821], targetPitcherId: 608566 },
  { canonicalGamePk: 777535, expectedPitcherIds: [608566, 693821], targetPitcherId: 693821 },
  { canonicalGamePk: 777499, expectedPitcherIds: [554430, 621244], targetPitcherId: 554430 },
  { canonicalGamePk: 777499, expectedPitcherIds: [554430, 621244], targetPitcherId: 621244 },
  { canonicalGamePk: 777417, expectedPitcherIds: [678394, 694738], targetPitcherId: 678394 },
  { canonicalGamePk: 777417, expectedPitcherIds: [678394, 694738], targetPitcherId: 694738 },
  { canonicalGamePk: 777273, expectedPitcherIds: [601713, 690953], targetPitcherId: 601713 },
  { canonicalGamePk: 777273, expectedPitcherIds: [601713, 690953], targetPitcherId: 690953 },
  { canonicalGamePk: 777289, expectedPitcherIds: [605280, 642547], targetPitcherId: 605280 },
  { canonicalGamePk: 777289, expectedPitcherIds: [605280, 642547], targetPitcherId: 642547 },
  { canonicalGamePk: 777104, expectedPitcherIds: [622663, 671106], targetPitcherId: 622663 },
  { canonicalGamePk: 777104, expectedPitcherIds: [622663, 671106], targetPitcherId: 671106 },
  { canonicalGamePk: 777064, expectedPitcherIds: [663623, 663903], targetPitcherId: 663623 },
  { canonicalGamePk: 777064, expectedPitcherIds: [663623, 663903], targetPitcherId: 663903 },
  { canonicalGamePk: 776991, expectedPitcherIds: [682052, 686613], targetPitcherId: 682052 },
  { canonicalGamePk: 776991, expectedPitcherIds: [682052, 686613], targetPitcherId: 686613 },
  { canonicalGamePk: 776937, expectedPitcherIds: [669022, 687473], targetPitcherId: 669022 },
  { canonicalGamePk: 776937, expectedPitcherIds: [669022, 687473], targetPitcherId: 687473 },
  { canonicalGamePk: 776865, expectedPitcherIds: [622663, 669022], targetPitcherId: 622663 },
  { canonicalGamePk: 776865, expectedPitcherIds: [622663, 669022], targetPitcherId: 669022 },
  { canonicalGamePk: 776820, expectedPitcherIds: [601713, 621111], targetPitcherId: 601713 },
  { canonicalGamePk: 776820, expectedPitcherIds: [601713, 621111], targetPitcherId: 621111 },
  { canonicalGamePk: 776745, expectedPitcherIds: [665795, 676440], targetPitcherId: 665795 },
  { canonicalGamePk: 776745, expectedPitcherIds: [665795, 676440], targetPitcherId: 676440 },
  { canonicalGamePk: 776678, expectedPitcherIds: [656849, 663623], targetPitcherId: 656849 },
  { canonicalGamePk: 776678, expectedPitcherIds: [656849, 663623], targetPitcherId: 663623 },
  { canonicalGamePk: 776687, expectedPitcherIds: [681343, 693821], targetPitcherId: 681343 },
  { canonicalGamePk: 776687, expectedPitcherIds: [681343, 693821], targetPitcherId: 693821 },
  { canonicalGamePk: 776652, expectedPitcherIds: [579328, 607259], targetPitcherId: 579328 },
  { canonicalGamePk: 776652, expectedPitcherIds: [579328, 607259], targetPitcherId: 607259 },
  { canonicalGamePk: 776496, expectedPitcherIds: [477132, 669387], targetPitcherId: 477132 },
  { canonicalGamePk: 776496, expectedPitcherIds: [477132, 669387], targetPitcherId: 669387 },
  { canonicalGamePk: 776472, expectedPitcherIds: [669920, 701542], targetPitcherId: 669920 },
  { canonicalGamePk: 776472, expectedPitcherIds: [669920, 701542], targetPitcherId: 701542 },
  { canonicalGamePk: 776450, expectedPitcherIds: [656849, 671096], targetPitcherId: 656849 },
  { canonicalGamePk: 776450, expectedPitcherIds: [656849, 671096], targetPitcherId: 671096 },
  { canonicalGamePk: 776381, expectedPitcherIds: [519242, 592791], targetPitcherId: 519242 },
  { canonicalGamePk: 776381, expectedPitcherIds: [519242, 592791], targetPitcherId: 592791 },
  { canonicalGamePk: 776320, expectedPitcherIds: [676917, 681347], targetPitcherId: 676917 },
  { canonicalGamePk: 776320, expectedPitcherIds: [676917, 681347], targetPitcherId: 681347 },
  { canonicalGamePk: 776287, expectedPitcherIds: [571510, 670912], targetPitcherId: 571510 },
  { canonicalGamePk: 776287, expectedPitcherIds: [571510, 670912], targetPitcherId: 670912 },
]
for(const target of targets){
 try{
  const evidence=await auditHistoricalPa14V2Target(target)
  console.log('PA14_V2_REPAIRED_SAMPLE2_RESULT='+JSON.stringify({
   status:'COMPLETE',target:evidence.target,builderStatus:evidence.result.status,
   blockReasons:evidence.result.status==='BLOCKED'?evidence.result.reasons:[],
   replayMatch:evidence.replayMatch,historicalAuditEligible:evidence.historicalAuditEligible,
   repairCount:(evidence.audit?.officialTypeRepairs?.pitcher?.length??0)+(evidence.audit?.officialTypeRepairs?.opponent?.length??0),
   productionEligible:false,researchOnly:true,
   boundaries:{supabaseWrites:0,sportsbookCalls:0,modelTrainingAuthorized:false}
  }))
 }catch(error){
  console.log('PA14_V2_REPAIRED_SAMPLE2_RESULT='+JSON.stringify({
   status:'REJECTED',canonicalGamePk:target.canonicalGamePk,pitcherMlbamId:target.targetPitcherId,
   error:error instanceof Error?error.message:String(error),repairCount:0,productionEligible:false,researchOnly:true,
   boundaries:{supabaseWrites:0,sportsbookCalls:0,modelTrainingAuthorized:false}
  }))
 }
}
