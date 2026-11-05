import {createHash} from 'node:crypto';
export const NCAAF_MODEL='NCAAF_PPG_V1_PICK_PORT_1';
export const NCAAF_COHORT='NCAAF_PPG_PICK_20261105';
export const NCAAF_ORIGINAL_BLOB='990f94223d3044cca261754e2d46de3258d7cd6d';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const instant=value=>{if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('INVALID_TIME');return Date.parse(value);};
// Same clipped Normal(margin/17) as Python PPG. Compensated erf series;
// |z|>=4.8 already lies beyond the original 1e-6 probability clipping threshold.
export function ppgProbability(margin){
 if(!Number.isFinite(margin))throw Error('INVALID_MARGIN');const z=margin/17;
 if(z>=4.8)return 1-1e-6;if(z<=-4.8)return 1e-6;
 const x=z/Math.SQRT2;let term=x,sum=x,correction=0;
 for(let n=1;n<200;n++){term*=-x*x/n;const add=term/(2*n+1),adjusted=add-correction,next=sum+adjusted;correction=(next-sum)-adjusted;sum=next;if(n>x*x+4&&Math.abs(add)<1e-17)break;}
 return Math.max(1e-6,Math.min(1-1e-6,.5+sum/Math.sqrt(Math.PI)));
}
export function forecastNcaafPpg(game,history,cutoff){
 const p={model:NCAAF_MODEL,event_id:game.event_id,season:game.season,home_id:game.home_id,away_id:game.away_id,home_name:game.home_name,away_name:game.away_name,scheduled_at:game.scheduled_at,state:'ABSTAIN',reason:null,home_score:null,away_score:null,home_win_probability:null,away_win_probability:null,predicted_winner:null,projected_margin:null,projected_total:null,intervals_95:null,history_event_ids:{},history_capture_ids:{},confidence:'UNAVAILABLE',missing_features:['verified_starting_QB','injuries','pregame_weather','travel_coordinates'],opponent_adjusted:false,model_validated:false};
 const stop=reason=>({...p,reason});let tip,captured,at;
 if(game.sport!=='NCAAF'||!game.home_id||!game.away_id||game.home_id===game.away_id)return stop('INVALID_FOOTBALL_IDENTITY');
 try{tip=instant(game.scheduled_at);captured=instant(game.captured_at);at=typeof cutoff==='string'?instant(cutoff):cutoff.getTime();if(!Number.isFinite(at))throw Error();}catch{return stop('INVALID_TIME');}
 const dt=new Date(tip);if(game.season!==dt.getUTCFullYear()-(dt.getUTCMonth()<6?1:0))return stop('FOOTBALL_SEASON_MISMATCH');
 if(game.time_verified!==true)return stop('UNVERIFIED_KICKOFF');if(typeof game.neutral_site!=='boolean')return stop('UNKNOWN_NEUTRAL_SITE');
 if(!game.home_FBS_membership||!game.away_FBS_membership)return stop('FBS_MEMBERSHIP_MISSING_OR_CONFLICTING');
 if(game.status!=='SCHEDULED'||tip<=at)return stop('NOT_STRICTLY_PREGAME');if(captured>at)return stop('FUTURE_SOURCE_CAPTURE');
 for(const side of ['home','away']){let time;try{time=instant(game[side+'_membership_captured_at']);}catch{return stop('MISSING_MEMBERSHIP_TIMING');}if(time>at)return stop('FUTURE_MEMBERSHIP_EVIDENCE');}
 if(at-captured>86400000)return stop('STALE_SCHEDULE');if(tip-at>7*86400000)return stop('OUTSIDE_SEVEN_DAY_HORIZON');
 const profiles=[];
 for(const side of ['home','away']){
  const seen=new Map();
  for(const g of history){if(g.season!==game.season||g.event_id===game.event_id||g.outcome_validation!=='PASS'||g.status!=='FINAL'||![g.home_id,g.away_id].includes(game[side+'_id']))continue;
   let gt,gc;try{gt=instant(g.scheduled_at);gc=instant(g.captured_at);}catch{return stop('INVALID_HISTORY_TIME');}if(gt>=tip||gt>=at||gc>at)continue;seen.set(g.event_id,g);
  }
  const prior=[...seen.values()].sort((a,b)=>instant(a.scheduled_at)-instant(b.scheduled_at)||a.event_id.localeCompare(b.event_id)).slice(-6);
  if(prior.length<3)return stop('THREE_PRIOR_CURRENT_SEASON_FINALS_REQUIRED');
  if(prior.some(g=>g.home_score===g.away_score||!['home_score','away_score'].every(k=>Number.isInteger(g[k])&&g[k]>=0)))return stop('INCONSISTENT_PRIOR_FINAL');
  let scored=0,allowed=0;for(const g of prior){const home=g.home_id===game[side+'_id'];scored+=home?g.home_score:g.away_score;allowed+=home?g.away_score:g.home_score;}
  profiles.push([scored/prior.length,allowed/prior.length]);p.history_event_ids[side]=prior.map(g=>g.event_id);p.history_capture_ids[side]=prior.map(g=>g.capture_id);p[side+'_rest_days_observed']=(tip-instant(prior.at(-1).scheduled_at))/86400000;
 }
 const h=game.neutral_site?0:1.25,home=Math.max(0,(profiles[0][0]+profiles[1][1])/2+h),away=Math.max(0,(profiles[1][0]+profiles[0][1])/2-h),margin=home-away,prob=ppgProbability(margin),z=1.959963984540054;
 return {...p,state:'FORECAST',home_score:home,away_score:away,home_win_probability:prob,away_win_probability:1-prob,predicted_winner:margin>0?game.home_id:margin<0?game.away_id:null,projected_margin:margin,projected_total:home+away,confidence:'LOW_UNCALIBRATED_FOOTBALL_BASELINE',intervals_95:Object.fromEntries([['home_score',home,14],['away_score',away,14],['margin',margin,17],['total',home+away,24]].map(([key,v,s])=>[key,[key==='margin'?v-z*s:Math.max(0,v-z*s),v+z*s]])),uncertainty_calibrated:false,source_capture_id:game.capture_id,warnings:['Original football assumptions: home advantage2.5 and margin sigma17 are not calibrated coefficients','PPG is not opponent/conference adjusted','QB/weather/availability unknown; no healthy-player inference'],input_contract:'ESPN_CURRENT_FBS_TEAM_SCHEDULES_20261105',original_model:'NCAAF_PPG_V1',original_blob:NCAAF_ORIGINAL_BLOB};
}
export function ncaafForecastRows(games,history,cutoff,sourceId){
 const rows=[],skipped=[];const at=Date.parse(cutoff);
 for(const game of games){if(game.status!=='SCHEDULED'||Date.parse(game.scheduled_at)<=at+600000||Date.parse(game.scheduled_at)>at+7*86400000)continue;
  const p=forecastNcaafPpg(game,history,cutoff);
  const base={cohort:NCAAF_COHORT,sport:'NCAAF',event_id:game.event_id,competition:'NCAAF FBS',phase:'REGULAR_SEASON',period:'FULL_GAME_INCLUDING_OVERTIME',scheduled_at:game.scheduled_at,emitted_at:cutoff,participant_a:game.home_name,participant_b:game.away_name,source_id:sourceId,model_version:NCAAF_MODEL,line:null,payload:{input:game,projection:p,odds:null,scope:'STATISTICAL_RESEARCH',sportsbook_settlement:false,original_model:NCAAF_ORIGINAL_BLOB,confidence:p.confidence}};
  for(const market of ['MONEYLINE','POINT_MARGIN','TOTAL_POINTS']){
   const eligible=p.state==='FORECAST',ml=market==='MONEYLINE',tie=ml&&eligible&&!p.predicted_winner;
   rows.push({...base,id:hash([NCAAF_COHORT,game.event_id,market,NCAAF_MODEL]),market,status:!eligible||tie?'ABSTAIN':ml?'FORECAST':'PROJECTION',selection:eligible&&ml&&!tie?(p.predicted_winner===game.home_id?'HOME':'AWAY'):null,probability:eligible&&ml&&!tie?Math.max(p.home_win_probability,p.away_win_probability):null,projection:eligible?(market==='TOTAL_POINTS'?p.projected_total:p.projected_margin):null,reason:!eligible?p.reason:tie?'TIED_PROBABILITY':'RESEARCH_MODEL_ONLY'});
  }
  if(p.state==='ABSTAIN')skipped.push({event_id:game.event_id,reason:p.reason});
 }
 return {rows,skipped};
}
export function ncaafOutcome(f,g){
 if(!g)return {status:'PENDING'};const original=f.payload.input;
 if(g.event_id!==f.event_id||g.home_id!==original.home_id||g.away_id!==original.away_id||g.season!==original.season||Date.parse(g.scheduled_at)!==Date.parse(f.scheduled_at)||g.neutral_site!==original.neutral_site)return {status:'DISPUTE',reason:'EVENT_CONTRACT_CHANGED'};
 if(g.status!=='FINAL')return {status:'PENDING'};
 if(g.outcome_validation!=='PASS'||!Number.isInteger(g.home_score)||!Number.isInteger(g.away_score)||g.home_score===g.away_score)return {status:'NOT_VERIFIABLE',reason:'FINAL_NOT_VERIFIED'};
 if(Date.parse(g.captured_at)<=Date.parse(f.emitted_at))return {status:'DISPUTE',reason:'FINAL_KNOWN_AT_EMISSION'};
 const p=f.payload.projection,errors={home:Math.abs(p.home_score-g.home_score),away:Math.abs(p.away_score-g.away_score),margin:Math.abs(p.projected_margin-(g.home_score-g.away_score)),total:Math.abs(p.projected_total-(g.home_score+g.away_score))};
 if(f.market==='MONEYLINE')return {status:f.selection===(g.home_score>g.away_score?'HOME':'AWAY')?'W':'L',final:g,numeric_errors:errors};
 const actual=f.market==='POINT_MARGIN'?g.home_score-g.away_score:f.market==='TOTAL_POINTS'?g.home_score+g.away_score:null;
 return actual===null?{status:'NOT_VERIFIABLE',reason:'UNKNOWN_MARKET'}:{status:'NUMERIC',actual,absolute_error:Math.abs(f.projection-actual),final:g,numeric_errors:errors};
}
