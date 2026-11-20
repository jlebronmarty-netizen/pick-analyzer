// NCAAB immutable forward-only calibration scorer.
// All candidates must be frozen pregame; no earlier official pick is changed.
export const NCAAB_SHADOW_MIN_EVAL=30;
const ms=x=>{const v=Date.parse(String(x??''));return Number.isFinite(v)?v:null;};
const prob=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1;
const num=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,n=5)=>Number(x.toFixed(n));
const empty=()=>({n:0,wins:0,brier:0,logLoss:0,mae:0,bias:0});
const metrics=o=>({n:o.n,hits:o.wins,accuracy:o.n?round(o.wins/o.n):null,
 brier:o.n?round(o.brier/o.n):null,logLoss:o.n?round(o.logLoss/o.n):null,
 mae:o.n?round(o.mae/o.n,3):null,bias:o.n?round(o.bias/o.n,3):null});
export function evaluateNcaabFrozenCalibration({frozenRows,finalRows}){
 if(!Array.isArray(frozenRows)||!Array.isArray(finalRows))
  return {status:'UNAVAILABLE',reason:'MISSING_DATA'};
 const finalMap=new Map(),conflicts=new Set();
 for(const x of finalRows){
  if(typeof x?.event_id!=='string'||conflicts.has(x.event_id))continue;
  if(finalMap.has(x.event_id)){finalMap.delete(x.event_id);conflicts.add(x.event_id);}
  else finalMap.set(x.event_id,x);
 }
 const rowIds=new Set();
 const scores={baseline:empty(),unrestricted:empty(),sidePreserving:empty(),
  baselineMargin:empty(),correctedMargin:empty(),totalUnchanged:empty()};
 let pending=0,invalid=0,graded=0,shadows=0,missingOutcome=0;
 const invalidReasons={};
 const reason=why=>{invalid++;invalidReasons[why]=(invalidReasons[why]??0)+1;};
 const byDay=new Map();
 for(const row of frozenRows){
  const start=ms(row?.scheduled_at),original=ms(row?.original_created_at),
   freeze=ms(row?.frozen_at),base=row?.baseline,candidate=row?.candidate,
   evidence=row?.history_evidence;
  if(rowIds.has(row?.event_id)){reason('DUPLICATE_SHADOW_EVENT');continue;}
  rowIds.add(row?.event_id);
  if(row?.model_version!=='NCAAB_SIDE_PRESERVING_SHADOW_V1'||
   row?.official_pick!==false||row?.production_eligible!==false||
   !/^espn:\d{6,15}$/.test(String(row?.event_id??''))||
   original===null||freeze===null||start===null||
   original>freeze||freeze-original>10*60000||start-freeze<60*60000||
   row?.status!=='FROZEN_RESEARCH'||!prob(base?.home_win_probability)||
   !prob(candidate?.probability_home_unrestricted)||
   !prob(candidate?.probability_home_preserve_original_side)||
   !num(base?.projected_margin)||!num(base?.projected_total)||
   !num(candidate?.projected_margin_adjusted)||
   candidate?.projected_total_unchanged!==base?.projected_total||
   candidate?.predicted_winner_unchanged!==base?.predicted_winner||
   candidate?.model_promotion_allowed!==false||
   !(evidence?.priorGames>=100)||evidence?.totalAdjustmentApplied!==false||
   Math.abs(candidate.probability_home_preserve_original_side-.5)<1e-8||
   (base.home_win_probability>=.5)!==(candidate.probability_home_preserve_original_side>=.5)){
   reason('INVALID_FROZEN_PREMATCH_CONTRACT');continue;
  }
  shadows++;
  if(conflicts.has(row.event_id)){reason('CONTRADICTORY_FINALS');continue;}
  const final=finalMap.get(row.event_id);
  if(!final){missingOutcome++;pending++;continue;}
  const f=final.body??{},observed=ms(final.observed_at),tip=ms(f.scheduled_at);
  if(f.event_id!==row.event_id||f.status!=='FINAL'||tip!==start||
   observed===null||observed<=start||ms(f.captured_at)!==observed||
   f.home_id!==row.home_id||f.away_id!==row.away_id||
   !Number.isSafeInteger(f.home_score)||!Number.isSafeInteger(f.away_score)||
   f.home_score===f.away_score){
   reason('FINAL_IDENTITY_OR_TIME');continue;
  }
  graded++;const homeWon=f.home_score>f.away_score?1:0,
   actualMargin=f.home_score-f.away_score,actualTotal=f.home_score+f.away_score;
  for(const [name,p] of [
   ['baseline',base.home_win_probability],
   ['unrestricted',candidate.probability_home_unrestricted],
   ['sidePreserving',candidate.probability_home_preserve_original_side]
  ]){
   const s=scores[name];s.n++;s.wins+=Number((p>=.5)===Boolean(homeWon));
   s.brier+=(p-homeWon)**2;
   s.logLoss+=-(homeWon*Math.log(p)+(1-homeWon)*Math.log(1-p));
  }
  for(const [name,p,actual] of [
   ['baselineMargin',base.projected_margin,actualMargin],
   ['correctedMargin',candidate.projected_margin_adjusted,actualMargin],
   ['totalUnchanged',candidate.projected_total_unchanged,actualTotal]
  ]){
   const s=scores[name];s.n++;s.mae+=Math.abs(p-actual);s.bias+=p-actual;
  }
  const d=new Date(start).toISOString().slice(0,10);
  const prior=byDay.get(d)??{date:d,games:0,baseBrier:0,preserveBrier:0};
  prior.games++;prior.baseBrier+=(base.home_win_probability-homeWon)**2;
  prior.preserveBrier+=(candidate.probability_home_preserve_original_side-homeWon)**2;
  byDay.set(d,prior);
 }
 const measurements=Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,metrics(v)]));
 return {status:invalid?'REVIEW_INVALID_EVIDENCE':graded<NCAAB_SHADOW_MIN_EVAL?
  'PROSPECTIVE_SAMPLE_PENDING':'INDEPENDENT_HOLDOUT_REVIEW_REQUIRED',
  frozen:frozenRows.length,validFrozen:shadows,settled:graded,pending,invalid,
  missingOutcome,invalidReasons,
  minimumInitialHoldout:NCAAB_SHADOW_MIN_EVAL,
  remainingBeforeInitialReview:Math.max(0,NCAAB_SHADOW_MIN_EVAL-graded),
  metrics:measurements,
  candidateMinusOriginal:{
   brier:graded?round(measurements.sidePreserving.brier-measurements.baseline.brier):null,
   logLoss:graded?round(measurements.sidePreserving.logLoss-measurements.baseline.logLoss):null,
   marginMae:graded?round(measurements.correctedMargin.mae-measurements.baselineMargin.mae,3):null},
  days:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date))
   .map(x=>({date:x.date,games:x.games,
    modelBrier:round(x.baseBrier/x.games),sidePreservingBrier:round(x.preserveBrier/x.games)})),
  independentValidationPassed:false,modelPromotionAllowed:false,
  sportsbookOddsCertified:false,officialPicksChanged:false,
  warning:'Strict prospective shadow only; side-preserving candidate never changes official team selection. Calibration and exact Spread/Total bookmaker ROI remain unvalidated.'};
}
