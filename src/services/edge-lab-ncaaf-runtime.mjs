import 'server-only';
import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';
import {collectNcaaf} from './edge-lab-ncaaf.service.mjs';
import {NCAAF_COHORT,NCAAF_MODEL} from '../lib/edge-lab/ncaaf-ppg.mjs';import {multiMetrics} from '../lib/edge-lab/multisport.mjs';
function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||new URL(url).hostname!=='ynuocvexviorgdjrfthw.supabase.co'||!key)throw Error('DESTINATION_NOT_CONFIGURED');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function check(r){if(r.error)throw Error('NCAAF_DATABASE_ERROR');return r.data;}
export async function runNcaafModule(){
 if(process.env.VERCEL_ENV!=='production')throw Error('PRODUCTION_ONLY');const db=client(),id=randomUUID();
 if(!check(await db.rpc('edge_lab_multi_claim_v1',{p_sport:'NCAAF',p_run:id})))return {sport:'NCAAF',status:'NOT_DUE_OR_LOCKED'};
 const summary={sport:'NCAAF',cohort:NCAAF_COHORT,provider_attempts:0,forecasts_inserted:0,forecasts_reused:0,outcomes_inserted:0,warnings:[],errors:[],nhl_touched:false,official_picks_written:false};let status='FAILED';
 try{status=await collectNcaaf(db,summary);}catch(e){summary.errors.push(/^[A-Z0-9_]+$/.test(e.message)?e.message:'NCAAF_OPERATION_FAILED');}
 finally{try{check(await db.from('edge_lab_multi_runs_v1').update({status,summary,finished_at:new Date().toISOString()}).eq('id',id));}finally{check(await db.from('edge_lab_multi_locks_v1').update({lease_until:new Date().toISOString()}).eq('sport','NCAAF').eq('run_id',id));}}
 return {status,...summary};
}
async function all(db,table){const out=[];for(let offset=0;offset<20000;offset+=500){let q=db.from(table).select('*').order('id').range(offset,offset+499);if(table==='edge_lab_multi_forecasts_v1')q=q.eq('sport','NCAAF').eq('cohort',NCAAF_COHORT);const page=check(await q);out.push(...page);if(page.length<500)return out;}throw Error('NCAAF_READ_LIMIT');}
export async function readNcaaf(){
 const db=client(),forecasts=await all(db,'edge_lab_multi_forecasts_v1'),outcomes=await all(db,'edge_lab_multi_outcomes_v1'),index=new Map(outcomes.map(r=>[r.forecast_id,r]));
 const rows=forecasts.map(r=>({...r,outcome:index.get(r.id)??null})).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.market.localeCompare(b.market));
 const runs=check(await db.from('edge_lab_multi_runs_v1').select('*').eq('sport','NCAAF').order('started_at',{ascending:false}).limit(10)),lock=check(await db.from('edge_lab_multi_locks_v1').select('sport,next_due').eq('sport','NCAAF').single());
 const day=r=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(r.emitted_at)),days=[...new Set(rows.map(day))];
 return {sport:'NCAAF',cohort:NCAAF_COHORT,model:NCAAF_MODEL,phase:'REGULAR_SEASON',status:runs[0]?.status??'NOT_RUN',checked_at:new Date().toISOString(),rows,runs,next_due:lock.next_due,metrics:multiMetrics(rows),daily:days.flatMap(date=>multiMetrics(rows.filter(r=>day(r)===date)).map(m=>({date,...m}))),model_validated:false,confidence:'LOW_UNCALIBRATED_FOOTBALL_BASELINE',ridge_status:'FROZEN_WEEKLY_PROFILE_UNAVAILABLE_NO_REFIT',provider_calls_on_screen_refresh:0,nhl:'EXCLUDED_OTHER_CHAT'};
}
