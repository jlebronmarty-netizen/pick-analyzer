import 'server-only';
import {loadNcaafSchedules,sourceHash} from '../lib/edge-lab/ncaaf-sources.mjs';
import {ncaafForecastRows,ncaafOutcome,NCAAF_MODEL,NCAAF_COHORT} from '../lib/edge-lab/ncaaf-ppg.mjs';
const T={sources:'edge_lab_multi_sources_v1',forecasts:'edge_lab_multi_forecasts_v1',outcomes:'edge_lab_multi_outcomes_v1'};
function checked(r){if(r.error)throw Error('NCAAF_DATABASE_'+(/^[A-Z0-9]+$/.test(r.error.code??'')?r.error.code:'FAILED'));return r.data;}
async function read(db,table,sport){const rows=[];for(let offset=0;offset<20000;offset+=500){let q=db.from(table).select('*').order('id').range(offset,offset+499);if(sport)q=q.eq('sport',sport);const page=checked(await q);rows.push(...page);if(page.length<500)return rows;}throw Error('NCAAF_LEDGER_LIMIT_REACHED');}
async function insert(db,table,rows,conflict='id'){let count=0;for(let i=0;i<rows.length;i+=100)count+=checked(await db.from(table).upsert(rows.slice(i,i+100),{onConflict:conflict,ignoreDuplicates:true}).select('id')).length;return count;}
export async function collectNcaaf(db,summary){
 summary.collector_version='NCAAF_FBS_SCHEDULE_PPG_V1';summary.cohort=NCAAF_COHORT;summary.model=NCAAF_MODEL;summary.phase='REGULAR_SEASON';summary.scope='PPG research only; not sportsbook recommendations';summary.ridge_status='FROZEN_WEEKLY_PROFILE_UNAVAILABLE_NO_REFIT';
 const existing=(await read(db,T.forecasts,'NCAAF')).filter(r=>r.cohort===NCAAF_COHORT),outcomes=await read(db,T.outcomes),done=new Set(outcomes.map(r=>r.forecast_id));
 const data=await loadNcaafSchedules();summary.provider_attempts=data.requests;summary.provider_billing='FREE_PUBLIC_SOURCE_NO_SUBSCRIPTION';summary.coverage=data.coverage;summary.source_errors=data.errors;summary.identity_conflicts=data.conflicts;summary.season=data.season;
 if(data.errors.length)summary.warnings.push('SOME_FBS_TEAM_SCHEDULES_UNAVAILABLE');if(data.conflicts.length)summary.warnings.push('CONFLICTED_EVENTS_EXCLUDED');
 const asOf=new Date().toISOString(),sourceId=sourceHash(data);
 // Compact normalized inputs plus original source digests/receipt times, not a claim of raw backup.
 await insert(db,T.sources,[{id:sourceId,sport:'NCAAF',source:'ESPN current-season FBS team schedules',captured_at:asOf,payload:data}]);
 const batch=ncaafForecastRows(data.events,data.events,asOf,sourceId);
 summary.forecasts_inserted=await insert(db,T.forecasts,batch.rows);summary.forecasts_reused=batch.rows.length-summary.forecasts_inserted;summary.status_counts=Object.fromEntries(['FORECAST','PROJECTION','ABSTAIN'].map(s=>[s,batch.rows.filter(r=>r.status===s).length]));summary.skipped=batch.skipped;summary.unique_games=new Set(batch.rows.map(r=>r.event_id)).size;
 const byId=new Map(data.events.map(e=>[e.event_id,e]));
 for(const f of existing){if(f.status==='ABSTAIN'||done.has(f.id)||Date.parse(f.scheduled_at)>Date.parse(asOf))continue;
  const result=ncaafOutcome(f,byId.get(f.event_id));if(result.status==='PENDING'){summary.pending_without_final=(summary.pending_without_final??0)+1;continue;}
  summary.outcomes_inserted+=await insert(db,T.outcomes,[{id:f.id,forecast_id:f.id,status:result.status,checked_at:asOf,actual:result.actual??null,absolute_error:result.absolute_error??null,payload:{...result,source_id:sourceId,statistical_only:true,sportsbook_settlement:false}}],'forecast_id');
 }
 summary.operational_state=batch.rows.length?'PPG_COLLECTED':'NO_ELIGIBLE_SCHEDULED_GAMES';summary.model_validated=false;summary.opponent_adjusted=false;
 return data.coverage.complete?'SUCCESS':'PARTIAL';
}
