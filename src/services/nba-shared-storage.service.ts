import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateArchive, localDay, normalizeEvent, normalizeOdds, syncPlan } from '@/lib/nba-archive-core.mjs'
import type { AdapterResult, MultiSportQuery, NormalizedEvent, NormalizedOddsSnapshot } from '@/types/multi-sport'
const SOURCE='https://nba-odds-on-demand-preview.vercel.app'
export function archiveEnabled(){return process.env.VERCEL_ENV==='production' && process.env.NBA_SHARED_FEED_ENABLED==='true'}
export async function archiveEnvelope(payload: unknown){
 const p=validateArchive(payload)
 if(Array.isArray(p.data.games)){
  const {data,error}=await supabaseAdmin.from('nba_market_schedules_v1').upsert({snapshot_id:p.meta.snapshot_id,date_local:p.meta.date_local,source_received_at:p.meta.source_received_at,payload:p},{onConflict:'snapshot_id',ignoreDuplicates:true}).select('snapshot_id')
  if(error)throw new Error('SCHEDULE_ARCHIVE_WRITE_FAILED')
  return {status:data?.length?'ARCHIVED':'ALREADY_ARCHIVED',snapshots:data?.length??0,quotes:0,legacy_rows:0}
 }
 const {data,error}=await supabaseAdmin.rpc('archive_nba_market_envelope_v1',{p})
 if(error)throw new Error('QUOTE_ARCHIVE_WRITE_FAILED')
 return data as {status:string,snapshots:number,quotes:number,legacy_rows:number,event_id:string}
}
async function sourceRead(params:URLSearchParams,token:string,deadline:number){
 if(!token)throw new Error('SERVICE_IDENTITY_UNAVAILABLE')
 const remaining=deadline-Date.now();if(remaining<500)throw new Error('ARCHIVE_DEADLINE')
 const u=new URL('/api/consumer',SOURCE);u.search=params.toString()
 const r=await fetch(u,{headers:{Accept:'application/json','x-vercel-trusted-oidc-idp-token':token},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(Math.min(12000,remaining))})
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw new Error(r.status===429?'FEED_RATE_LIMITED':'FEED_UNAVAILABLE')
 return validateArchive(await r.json())
}
export async function archiveStatus(){
 const [snap,quote,run,schedule]=await Promise.all([
  supabaseAdmin.from('nba_market_snapshots_v1').select('snapshot_id,source_received_at,recorded_at,provider_game_id',{count:'exact'}).order('recorded_at',{ascending:false}).limit(1),
  supabaseAdmin.from('nba_market_quotes_v1').select('quote_id',{count:'exact',head:true}),
  supabaseAdmin.from('nba_market_sync_runs_v1').select('run_id,started_at,completed_at,status,summary').order('started_at',{ascending:false}).limit(1),
  supabaseAdmin.from('nba_market_schedules_v1').select('date_local,source_received_at').order('source_received_at',{ascending:false}).limit(1)])
 if(snap.error||quote.error||run.error||schedule.error)throw new Error('ARCHIVE_STATUS_UNAVAILABLE')
 return {module:'NBA_SHARED_ARCHIVE_V1',durable:true,snapshots:snap.count,quotes:quote.count,last_snapshot:snap.data?.[0]??null,last_run:run.data?.[0]??null,last_schedule:schedule.data?.[0]??null,models_written:false,settlement_performed:false,checked_at:new Date().toISOString()}
}
export async function runSharedNbaArchive(token:string,mode:'cron'|'manual'='cron',day=localDay()){
 if(!archiveEnabled())return {status:'DISABLED',success:false}
 const started=new Date().toISOString(),deadline=Date.now()+45000
 const slot=mode==='cron'?`cron:${Math.floor(Date.now()/1800000)}`:`manual:${Math.floor(Date.now()/60000)}`
 const claim=await supabaseAdmin.from('nba_market_sync_runs_v1').insert({slot,started_at:started,status:'running'}).select('run_id').single()
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',success:true};throw new Error('ARCHIVE_RUN_CLAIM_FAILED')}
 const runId=claim.data.run_id
 const summary={module:'NBA_SHARED_ARCHIVE_V1',snapshots:0,quotes:0,legacy_rows:0,gateway_requests:0,planned:0,completed:0,eligible:0,schedule_days:[] as string[],errors:[] as string[],models_written:false,settlement_performed:false}
 try{
  const previousDay=localDay(new Date(Date.parse(day+'T12:00:00Z')-86400000))
  for(const scheduleDay of [previousDay,day]){
   summary.gateway_requests++
   const schedule=await sourceRead(new URLSearchParams({action:'games',date:scheduleDay}),token,deadline)
   await archiveEnvelope(schedule)
   summary.schedule_days.push(scheduleDay)
  }
  summary.gateway_requests++
  const s=await sourceRead(new URLSearchParams({action:'games',date:day}),token,deadline)
  await archiveEnvelope(s)
  const plan=syncPlan(s.data.games);summary.eligible=plan.eligible
  const tasks=[...plan.main.map((g:{id:number})=>({action:'quote',game_id:String(g.id),group:'main'})),...plan.props.map((g:{game_id:number,prop_type:string})=>({action:'quote',game_id:String(g.game_id),group:'props',prop_type:g.prop_type}))]
  summary.planned=tasks.length
  if(plan.not_selected)summary.errors.push('COVERAGE_LIMIT_REACHED')
  let index=0
  const work=async()=>{while(index<tasks.length&&Date.now()<deadline-500){const task=tasks[index++];try{summary.gateway_requests++;const p=await sourceRead(new URLSearchParams(Object.entries(task).filter(([,v])=>v!==undefined) as [string,string][]),token,deadline);const a=await archiveEnvelope(p);summary.snapshots+=a.snapshots;summary.quotes+=a.quotes;summary.legacy_rows+=a.legacy_rows;summary.completed++;if(p.meta.status!=='DATA_RETRIEVED')summary.errors.push('PARTIAL_OR_STALE_PROVIDER_COVERAGE')}catch(e){summary.errors.push(e instanceof Error?e.message:'ARCHIVE_TASK_FAILED')}}}
  await Promise.all([work(),work()])
  if(summary.completed<summary.planned&&!summary.errors.length)summary.errors.push('ARCHIVE_DEADLINE')
 }catch(e){summary.errors.push(e instanceof Error?e.message:'ARCHIVE_RUN_FAILED')}
 const status=summary.errors.length?(summary.completed?'partial':'failed'):'completed',completed=new Date().toISOString()
 const saved=await supabaseAdmin.from('nba_market_sync_runs_v1').update({status,completed_at:completed,summary}).eq('run_id',runId)
 if(saved.error)throw new Error('ARCHIVE_RUN_LOG_FAILED')
 const tracked=await supabaseAdmin.from('sports_sync_jobs').insert({job_type:'nba_shared_feed_archive',sport_key:'basketball_nba',league_key:'nba',provider:'balldontlie',started_at:started,completed_at:completed,status,records_fetched:summary.completed,records_inserted:summary.quotes,records_updated:0,records_skipped:0,error_count:summary.errors.length,metadata:summary})
 if(tracked.error)summary.errors.push('LEGACY_JOB_LOG_FAILED')
 return {...summary,run_id:runId,status,success:status==='completed'&&!tracked.error,started_at:started,completed_at:completed}
}
export async function runLegacySharedSync(jobType:'games'|'odds',options:{mode?:string,dateFrom?:string,dateTo?:string}={}){
 const started=Date.now(),h=await headers()
 if(options.dateFrom&&options.dateFrom!==localDay()||options.dateTo&&options.dateTo!==localDay()||['historical','full'].includes(options.mode??''))throw new Error('HISTORICAL_REFRESH_NOT_SUPPORTED_BY_LIVE_FEED')
 const r=await runSharedNbaArchive(h.get('x-vercel-oidc-token')??'','manual')
 return {success:r.success,jobType,sportKey:'basketball_nba',leagueKey:'nba',provider:'balldontlie',mode:options.mode??'incremental',startedAt:new Date(started).toISOString(),completedAt:new Date().toISOString(),durationMs:Date.now()-started,details:r}
}
export async function storedNbaEvents(query:MultiSportQuery):Promise<AdapterResult<NormalizedEvent[]>>{
 const day=query.dateFrom??localDay()
 if(query.dateTo&&query.dateTo!==day)return {success:false,source:'balldontlie',data:[],latencyMs:0,warnings:['MULTI_DAY_ARCHIVE_QUERY_NOT_SUPPORTED']}
 const {data,error}=await supabaseAdmin.from('nba_market_schedules_v1').select('payload,source_received_at').eq('date_local',day).order('source_received_at',{ascending:false}).limit(1)
 if(error||!data?.length)return {success:false,source:'balldontlie',data:[],latencyMs:0,warnings:['SCHEDULE_ARCHIVE_NOT_POPULATED'],error:'No archived schedule; not a no-games day.'}
 const p=validateArchive(data[0].payload),ids=p.data.games.map((g:{id:number})=>g.id)
 if(!ids.length)return {success:true,source:'balldontlie',data:[],latencyMs:0,warnings:['MARKET_DATA_ONLY_NOT_MODEL_VALIDATION']}
 const links=await supabaseAdmin.from('nba_market_event_links_v1').select('provider_game_id,internal_event_id').in('provider_game_id',ids)
 if(links.error)return {success:false,source:'balldontlie',data:[],latencyMs:0,warnings:['EVENT_MAPPING_UNAVAILABLE']}
 const map=new Map((links.data??[]).map(x=>[x.provider_game_id,x.internal_event_id]))
 let events:NormalizedEvent[]=p.data.games.map((g:{id:number})=>normalizeEvent(g,map.get(g.id)) as NormalizedEvent)
 if(query.status)events=events.filter(x=>x.status===query.status)
 if(query.search)events=events.filter(x=>x.displayName.toLowerCase().includes(query.search!.toLowerCase()))
 const start=(query.page-1)*query.limit
 return {success:true,source:'balldontlie',data:events.slice(start,start+query.limit),latencyMs:0,warnings:['MARKET_DATA_ONLY_NOT_MODEL_VALIDATION',...(Date.now()-Date.parse(data[0].source_received_at)>40*60000?['SCHEDULE_ARCHIVE_STALE']:[])]}
}
export async function storedNbaOdds(query:MultiSportQuery):Promise<AdapterResult<NormalizedOddsSnapshot[]>>{
 const day=query.dateFrom??localDay()
 const {data,error}=await supabaseAdmin.from('nba_market_snapshots_v1').select('payload,internal_event_id,provider_game_id,source_received_at').eq('date_local',day).gte('source_received_at',new Date(Date.now()-3600000).toISOString()).order('source_received_at',{ascending:false}).limit(250)
 if(error)return {success:false,source:'balldontlie',data:[],latencyMs:0,warnings:['ODDS_ARCHIVE_UNAVAILABLE']}
 const seen=new Set<number>();const result:NormalizedOddsSnapshot[]=[]
 for(const row of data??[]){if(seen.has(row.provider_game_id))continue;const p=validateArchive(row.payload);if(!p.data.quotes.some((q:{market:string})=>q.market!=='props'))continue;seen.add(row.provider_game_id);result.push(...normalizeOdds(p,row.internal_event_id) as NormalizedOddsSnapshot[])}
 const start=(query.page-1)*query.limit
 return {success:true,source:'balldontlie',data:result.slice(start,start+query.limit),latencyMs:0,warnings:['MARKET_DATA_ONLY_NOT_MODEL_VALIDATION',...(!result.length?['NO_FRESH_ARCHIVED_MAIN_PRICES']:[])]}
}
