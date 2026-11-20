// NCAAB purely prospective calibration, separate from frozen official forecasts.
// No sportsbook prices, recommendations, provider calls or model promotion.
// Bias is calculated only from exact-ID verified games whose result receipt
// was already observed before the ORIGINAL prediction was emitted.
import {createHash} from 'node:crypto';
export const NCAAB_CALIBRATION_VERSION='NCAAB_SIDE_PRESERVING_SHADOW_V1';
export const NCAAB_MIN_PRIOR=100;
export const NCAAB_SHRINK_PRIOR=100;
const ms=x=>{const n=Date.parse(String(x??''));return Number.isFinite(n)?n:null;};
const num=x=>typeof x==='number'&&Number.isFinite(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const prob=x=>num(x)&&x>0&&x<1;
const ident=x=>typeof x==='string'&&/^\d{1,12}$/.test(x);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=(x,d=6)=>Number(x.toFixed(d));
const block=reason=>({status:'NOT_READY',reason,official_pick:false,model_promoted:false});
const clamp=x=>Math.min(.99,Math.max(.01,x));
export function ncaabVerifiedHistoricalResult(p,o){
 const b=p?.body,v=o?.body,issued=ms(p?.created_at),tip=ms(p?.scheduled_at),
  observed=ms(o?.observed_at),finalTip=ms(v?.scheduled_at);
 if(!b||!v||p.event_id!==o.event_id||b.event_id!==p.event_id||v.event_id!==p.event_id||
  !/^espn:\d{6,15}$/.test(String(p.event_id??''))||
  b.model!=='NCAAB_PRESEASON_V1'||b.state!=='FORECAST'||v.status!=='FINAL'||
  !ident(b.home_id)||!ident(b.away_id)||b.home_id===b.away_id||
  b.home_id!==v.home_id||b.away_id!==v.away_id||
  issued===null||tip===null||observed===null||finalTip!==tip||
  issued>=tip||observed<=tip||ms(b.created_at)!==issued||
  ms(b.scheduled_at)!==tip||ms(v.captured_at)!==observed||
  !int(v.home_score)||!int(v.away_score)||v.home_score===v.away_score||
  !prob(b.home_win_probability)||!prob(b.away_win_probability)||
  Math.abs(b.home_win_probability+b.away_win_probability-1)>1e-5||
  !num(b.projected_margin)||!num(b.projected_total)||
  !num(b.home_score)||!num(b.away_score)||
  Math.abs(b.home_score-b.away_score-b.projected_margin)>1e-6||
  Math.abs(b.home_score+b.away_score-b.projected_total)>1e-6)
  return block('RESULT_SOURCE_IDENTITY_OR_TIMING');
 return {status:'VERIFIED_PAST_FINAL',event_id:p.event_id,
  scheduled_at:p.scheduled_at,predicted_at:p.created_at,
  result_observed_at:o.observed_at,home_id:b.home_id,away_id:b.away_id,
  original_home_probability:b.home_win_probability,
  projected_margin:b.projected_margin,projected_total:b.projected_total,
  actual_home_won:v.home_score>v.away_score?1:0,
  actual_margin:v.home_score-v.away_score,
  actual_total:v.home_score+v.away_score};
}
export function planNcaabCalibrationShadow({prediction,decisionAt,history,
 minimumPrior=NCAAB_MIN_PRIOR,shrinkPrior=NCAAB_SHRINK_PRIOR}){
 const b=prediction?.body,issued=ms(prediction?.created_at),
  now=ms(decisionAt),tip=ms(prediction?.scheduled_at);
 if(!b||b.state!=='FORECAST'||b.model!=='NCAAB_PRESEASON_V1'||
  !/^espn:\d{6,15}$/.test(String(prediction?.event_id??''))||
  b.event_id!==prediction.event_id||ms(b.scheduled_at)!==tip||
  ms(b.created_at)!==issued||issued===null||now===null||tip===null||
  issued>now||now-issued>10*60000||tip-now<60*60000||
  !ident(b.home_id)||!ident(b.away_id)||b.home_id===b.away_id||
  !prob(b.home_win_probability)||!prob(b.away_win_probability)||
  Math.abs(b.home_win_probability+b.away_win_probability-1)>1e-5||
  !num(b.projected_margin)||!num(b.projected_total)||
  typeof b.profile_sha256!=='string'||!/^[0-9a-f]{64}$/.test(b.profile_sha256)||
  !Array.isArray(history)||!Number.isSafeInteger(minimumPrior)||minimumPrior<100||
  !Number.isSafeInteger(shrinkPrior)||shrinkPrior<100)
  return block('FORECAST_IDENTITY_OR_ASOF_GATE');
 const eligible=history.filter(x=>x?.status==='VERIFIED_PAST_FINAL'&&
  x.event_id!==prediction.event_id&&
  ms(x.result_observed_at)!==null&&ms(x.result_observed_at)<issued&&
  ms(x.scheduled_at)<issued&&
  prob(x.original_home_probability)&&
  [x.projected_margin,x.projected_total,x.actual_margin,x.actual_total].every(num)&&
  [0,1].includes(x.actual_home_won))
  .sort((a,b)=>a.result_observed_at.localeCompare(b.result_observed_at)||
   a.event_id.localeCompare(b.event_id));
 const distinct=new Map(),conflicts=new Set();
 for(const x of eligible){
  if(conflicts.has(x.event_id))continue;
  if(distinct.has(x.event_id)){distinct.delete(x.event_id);conflicts.add(x.event_id);}
  else distinct.set(x.event_id,x);
 }
 const prior=[...distinct.values()];
 if(prior.length<minimumPrior)return block('INSUFFICIENT_EARLIER_SETTLED_GAMES');
 const n=prior.length,shrink=n/(n+shrinkPrior);
 const residual=prior.reduce((v,x)=>v+x.actual_home_won-x.original_home_probability,0)/n;
 const marginBias=prior.reduce((v,x)=>v+x.projected_margin-x.actual_margin,0)/n;
 const totalBias=prior.reduce((v,x)=>v+x.projected_total-x.actual_total,0)/n;
 const original=b.home_win_probability,adjusted=clamp(original+residual*shrink);
 // Side-preserving candidate evaluates probability quality without changing
 // any original winner selection. Side changes remain isolated research only.
 const preserved=original>=.5?Math.max(.50001,adjusted):Math.min(.49999,adjusted);
 const candidate={probability_home_unrestricted:round(adjusted),
  probability_home_preserve_original_side:round(preserved),
  probability_away_preserve_original_side:round(1-preserved),
  projected_margin_adjusted:round(b.projected_margin-marginBias*shrink,4),
  projected_total_unchanged:b.projected_total,
  predicted_winner_unchanged:b.predicted_winner,
  model_promotion_allowed:false,bookmaker_value_estimated:null,
  frozen_formula:'ROLLING_RESIDUAL_SHRINK_100_SIDE_PRESERVING_V1'};
 const evidence={priorGames:n,shrinkPrior,shrinkWeight:round(shrink),
  rawHistoricalHomeResidual:round(residual),appliedHomeAdjustment:round(residual*shrink),
  rawHistoricalMarginBias:round(marginBias),appliedMarginCorrection:round(marginBias*shrink),
  historicalTotalBias:round(totalBias),totalAdjustmentApplied:false,
  historicalSourceDigest:sha(prior.map(x=>[x.event_id,x.result_observed_at,
   x.original_home_probability,x.actual_home_won,x.actual_margin,x.actual_total]))};
 return {status:'FROZEN_RESEARCH_CANDIDATE',record:{
  id:NCAAB_CALIBRATION_VERSION+':'+prediction.event_id,
  event_id:prediction.event_id,model_version:NCAAB_CALIBRATION_VERSION,
  original_prediction_id:prediction.id,profile_sha256:b.profile_sha256,
  scheduled_at:prediction.scheduled_at,original_created_at:prediction.created_at,
  frozen_at:new Date(now).toISOString(),home_id:b.home_id,away_id:b.away_id,
  source_hash:sha([evidence.historicalSourceDigest,b.profile_sha256,
   prediction.id,prediction.created_at,now]),
  baseline:{home_win_probability:original,
   away_win_probability:b.away_win_probability,
   predicted_winner:b.predicted_winner,projected_margin:b.projected_margin,
   projected_total:b.projected_total},
  candidate,history_evidence:evidence,
  status:'FROZEN_RESEARCH',official_pick:false,production_eligible:false
 }};
}
