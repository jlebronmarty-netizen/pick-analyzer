import profile from '@/data/ncaab-profile-2027.json' with {type:'json'};
import type {NcaabCheckpoint} from './ncaab-checkpoint';
export const NCAAB_MODEL='NCAAB_PRESEASON_V1';
export type Observation=NcaabCheckpoint['observations'][number];
export type LiveObservation=Omit<Observation,'settlement'|'review_required'> & {settlement:null|{home_score:number;away_score:number;outcome:'WIN'|'LOSS'|null;observed_at:string};review_required:boolean;review_reason?:string|null};
export type Final={event_id:string;home_id:string;away_id:string;scheduled_at:string;home_score:number;away_score:number;captured_at:string;status:string};
export type Schedule={event_id:string;home_id:string;away_id:string;home_name:string|null;away_name:string|null;scheduled_at:string;season_ending_year:number;phase:string;time_verified:boolean;neutral_site:boolean|null;status:string;captured_at:string};
// Convergent Taylor series for erf. The frozen model's conservative sigma keeps
// eligible team pairs inside this interval; fail closed outside numeric domain.
export function normalProbability(margin:number,sigma:number){
 const x=margin/(sigma*Math.SQRT2);if(Math.abs(x)>4)throw Error('NCAAB_NUMERIC_DOMAIN');
 let term=x,sum=x;for(let n=1;n<150;n++){term*=-x*x/n;const add=term/(2*n+1);sum+=add;if(Math.abs(add)<1e-17)break;}
 return Math.min(1-1e-6,Math.max(1e-6,.5*(1+2/Math.sqrt(Math.PI)*sum)));
}
export function predictNcaab(s:Schedule,now:string):LiveObservation{
 const r:LiveObservation={event_id:s.event_id,home_id:s.home_id,away_id:s.away_id,home_name:s.home_name,away_name:s.away_name,scheduled_at:s.scheduled_at,state:'ABSTAIN',reason:null,home_score:null,away_score:null,home_win_probability:null,away_win_probability:null,predicted_winner:null,projected_total:null,projected_margin:null,created_at:null,settlement:null,review_required:false};
 const abstain=(reason:string)=>({...r,reason});const tip=Date.parse(s.scheduled_at),at=Date.parse(now),capture=Date.parse(s.captured_at);
 if(!s.home_id||!s.away_id||s.home_id===s.away_id||s.event_id==='espn:401722203')return abstain('INVALID_IDENTITY');
 if(!Number.isFinite(tip)||s.season_ending_year!==new Date(tip).getUTCFullYear()+Number(new Date(tip).getUTCMonth()>=6))return abstain('SEASON_DATE_MISMATCH');
 if(s.phase!=='REGULAR')return abstain('UNSUPPORTED_PHASE');
 if(!s.time_verified)return abstain('UNVERIFIED_TIP');
 if(typeof s.neutral_site!=='boolean')return abstain('UNKNOWN_VENUE');
 if(s.status!=='SCHEDULED'||tip<=at)return abstain('NOT_PREGAME_SCHEDULE');
 if(!Number.isFinite(capture)||capture>at||at-capture>86400000)return abstain('STALE_OR_FUTURE_SCHEDULE');
 if(s.season_ending_year!==profile.season_ending_year)return abstain('PROFILE_SEASON_MISMATCH');
 if(profile.historical_mode||Date.parse(profile.anchor)>=Date.UTC(s.season_ending_year-1,10,1)||Date.parse(profile.latest_evidence_capture)>Date.parse(profile.anchor)||Date.parse(profile.created_at)>at||profile.training_seasons.some(y=>y>=s.season_ending_year))return abstain('PROFILE_NOT_ASOF_ELIGIBLE');
 const teams=profile.teams as Record<string,(typeof profile.teams)['1']>;const h=teams[s.home_id],a=teams[s.away_id];
 if(!h||!a)return abstain('MISSING_TEAM_HISTORY');
 if(Math.min(h.previous_season_games,a.previous_season_games)<10)return abstain('INSUFFICIENT_PREVIOUS_SEASON_HISTORY');
 const pace=(h.estimated_possessions+a.estimated_possessions)/2,site=s.neutral_site?0:1.5;
 const hs=pace*(profile.league_efficiency+h.offense_effect+a.defense_allowed_effect)/100+site,ass=pace*(profile.league_efficiency+a.offense_effect+h.defense_allowed_effect)/100-site;
 if(!Number.isFinite(hs)||!Number.isFinite(ass)||Math.min(hs,ass)<0)return abstain('INVALID_PROJECTION');
 const factor=1.25*Math.sqrt(1+20/h.effective_games+20/a.effective_games),prob=normalProbability(hs-ass,profile.sigma_margin*factor);
 return {...r,state:'FORECAST',home_score:hs,away_score:ass,home_win_probability:prob,away_win_probability:1-prob,predicted_winner:hs===ass?null:hs>ass?s.home_id:s.away_id,projected_total:hs+ass,projected_margin:hs-ass,created_at:now};
}
export function reconcileNcaab(f:LiveObservation,finals:Final[]):LiveObservation{
 if(!finals.length)return f;
 const normalized=finals.map(x=>{
  const same=x.home_id===f.home_id&&x.away_id===f.away_id,swapped=x.home_id===f.away_id&&x.away_id===f.home_id;
  const drift=Math.abs(Date.parse(x.scheduled_at)-Date.parse(f.scheduled_at));
  if((!same&&!swapped)||!Number.isFinite(drift)||drift>2*3600000||x.status!=='FINAL')return null;
  return {x,home_score:swapped?x.away_score:x.home_score,away_score:swapped?x.home_score:x.away_score};
 });
 if(normalized.some(x=>x===null))return {...f,review_required:true,review_reason:'CORRECTION_OR_IDENTITY_REVIEW',settlement:null};
 const valid=normalized as {x:Final;home_score:number;away_score:number}[];
 const signatures=new Set(valid.map(({home_score,away_score})=>JSON.stringify([home_score,away_score])));
 if(signatures.size>1)return {...f,review_required:true,review_reason:'CORRECTION_OR_IDENTITY_REVIEW',settlement:null};
 const {x,home_score,away_score}=valid[0];
 if(!Number.isInteger(home_score)||!Number.isInteger(away_score)||Math.min(home_score,away_score)<0||home_score===away_score||Date.parse(x.captured_at)<Date.parse(x.scheduled_at))return {...f,review_required:true,review_reason:'INVALID_FINAL',settlement:null};
 const winner=home_score>away_score?f.home_id:f.away_id;
 return {...f,review_required:false,review_reason:null,settlement:{home_score,away_score,outcome:f.predicted_winner===null?null:f.predicted_winner===winner?'WIN':'LOSS',observed_at:x.captured_at}};
}
export function ncaabMetrics(rows:LiveObservation[]){
 const fs=rows.filter(r=>r.state==='FORECAST'),settled=fs.filter(r=>r.settlement&&!r.review_required),wins=settled.filter(r=>r.settlement!.outcome==='WIN').length,losses=settled.filter(r=>r.settlement!.outcome==='LOSS').length;
 return {id:NCAAB_MODEL as 'NCAAB_PRESEASON_V1',forecasts:fs.length,abstentions:rows.length-fs.length,settled:settled.length,wins,losses,winnerDenominator:wins+losses,accuracy:wins+losses?wins/(wins+losses):null,review:fs.filter(r=>r.review_required).length};
}
