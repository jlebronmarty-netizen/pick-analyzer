import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {archiveEnvelope,archiveEnabled} from '@/services/nba-shared-storage.service';
import {localDay} from '@/lib/nba-archive-core.mjs';
import {mergeNbaScheduleGames} from '@/lib/nba/goat-schedule-core.mjs';
import {NBA_RESEARCH_CAPTURE_VERSION,buildResearchPropEnvelopes,normalizeHistoryGamePages,collectCursorPages,historyDateRange,hashResearch,finalPlayerStatsComplete} from '@/lib/nba/goat-research-capture-core.mjs';

type Mode='props'|'history'|'stats';
type Options={mode?:Mode;startDate?:string;endDate?:string;gameIds?:number[]};
const SPORT='basketball_nba',MAX_REQUESTS=16,MAX_RESPONSE_BYTES=8*1024*1024;
const rows=(r:any)=>{if(r.error)throw Error('NBA_RESEARCH_STORAGE_READ_FAILED');return r.data??[];};

export async function getNbaResearchCaptureStatus(){
 const q=await db.from('nba_market_sync_runs_v1').select('run_id,slot,started_at,completed_at,status,summary').like('slot','research:%').order('started_at',{ascending:false}).limit(6);
 return {version:NBA_RESEARCH_CAPTURE_VERSION,runs:rows(q).map((r:any)=>({...r,summary:{...r.summary,history_capture:undefined,player_stats_capture:undefined,unarchived_prop_response:undefined}})),provider_calls:0,projections_created:0};
}

// Direct GOAT capture reuses the existing immutable NBA archive and run ledger.
// It never writes prediction_history, model weights, or legacy priced predictions.
export async function captureNbaResearchData(options:Options={}){
 if(!archiveEnabled())return {status:'DISABLED',provider_calls:0,projections_created:0};
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)return {status:'KEY_UNAVAILABLE',provider_calls:0,projections_created:0};
 const mode=options.mode??'props';if(!['props','history','stats'].includes(mode))throw Error('RESEARCH_MODE_INVALID');
 if(mode==='props'&&(options.startDate!==undefined||options.endDate!==undefined))throw Error('RESEARCH_DATES_ONLY_SUPPORTED_FOR_HISTORY_OR_STATS');
 const now=new Date(),day=localDay(now),started=now.toISOString(),deadline=now.getTime()+110000;
 const range=mode==='props'?null:historyDateRange(options.startDate,options.endDate,now);
 const requestedIds=options.gameIds;
 if(requestedIds&&(!Array.isArray(requestedIds)||requestedIds.length>16||requestedIds.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(requestedIds).size!==requestedIds.length))throw Error('RESEARCH_GAME_IDS_INVALID');
 if(requestedIds&&mode!=='stats')throw Error('RESEARCH_GAME_IDS_ONLY_SUPPORTED_FOR_STATS');
 const scope=mode==='props'?day:hashResearch({range,requestedIds:requestedIds??null}).slice(0,16);
 const slot=`research:${mode}:${scope}:${Math.floor(now.getTime()/1800000)}`;
 const summary:any={version:NBA_RESEARCH_CAPTURE_VERSION,mode,day,range,provider_calls:0,request_cap:MAX_REQUESTS,requests:[],snapshots:0,quotes:0,stats_games:0,history_games:0,games:[],errors:[],projections_created:0,full_fanduel_catalog_verified:false};
 const claim=await db.from('nba_market_sync_runs_v1').insert({slot,started_at:started,status:'running',summary}).select('run_id').single();
 if(claim.error){if(claim.error.code==='23505')return {status:'ALREADY_CLAIMED',provider_calls:0,projections_created:0};throw Error('NBA_RESEARCH_RUN_CLAIM_FAILED');}
 const runId=claim.data.run_id;
 const checkpoint=async()=>{const r=await db.from('nba_market_sync_runs_v1').update({summary}).eq('run_id',runId);if(r.error)throw Error('NBA_RESEARCH_LEDGER_WRITE_FAILED');};
 const fetchJson=async(url:URL)=>{
  if(summary.provider_calls>=MAX_REQUESTS||Date.now()>deadline-1000)throw Error('NBA_RESEARCH_REQUEST_BUDGET_EXHAUSTED');
  const receipt:any={url:url.toString(),reserved_at:new Date().toISOString(),status:'RESERVED'};
  summary.provider_calls++;summary.requests.push(receipt);await checkpoint();
  const r=await fetch(url,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(Math.min(15000,deadline-Date.now()))});
  receipt.http_status=r.status;
  if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json')){receipt.status='FAILED';throw Error('NBA_RESEARCH_PROVIDER_HTTP_'+r.status);}
  if(Number(r.headers.get('content-length')??0)>MAX_RESPONSE_BYTES)throw Error('NBA_RESEARCH_RESPONSE_BOUND');
  const raw=await r.text();if(Buffer.byteLength(raw)>MAX_RESPONSE_BYTES)throw Error('NBA_RESEARCH_RESPONSE_BOUND');
  const payload=JSON.parse(raw);if(!Array.isArray(payload?.data))throw Error('NBA_RESEARCH_PROVIDER_SCHEMA');
  receipt.status='RECEIVED';receipt.received_at=new Date().toISOString();receipt.response_sha256=hashResearch(raw);receipt.records=payload.data.length;
  return payload;
 };
 try{
  if(mode==='props'){
   const schedules=rows(await db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').eq('date_local',day).order('source_received_at',{ascending:false}).limit(3));
   const games=[...mergeNbaScheduleGames(schedules).values()].filter((x:any)=>Number.isFinite(Date.parse(x.game?.datetime??''))&&Date.parse(x.game.datetime)>Date.now()&&x.game?.status_state==='scheduled'&&Date.now()-Date.parse(x.sourceReceivedAt)<=3600000).map((x:any)=>x.game);
   if(games.length>16)throw Error('NBA_RESEARCH_SLATE_BOUND');
   if(!games.length)summary.errors.push('NO_FRESH_UPCOMING_SCHEDULE');
   for(const game of games){
    const url=new URL('https://api.balldontlie.io/nba/v2/odds/player_props');url.searchParams.set('game_id',String(game.id));url.searchParams.append('vendors[]','fanduel');
    const payload=await fetchJson(url),receivedAt=new Date().toISOString();
    summary.unarchived_prop_response={provider_game_id:game.id,received_at:receivedAt,payload};
    const envelopes=buildResearchPropEnvelopes({game,payload,receivedAt,requestUrl:url.toString(),runId});
    for(const envelope of envelopes){const saved:any=await archiveEnvelope(envelope);summary.snapshots+=saved.snapshots;summary.quotes+=saved.quotes;}
    delete summary.unarchived_prop_response;
    const coverage=envelopes[0].meta.coverage;
    summary.games.push({provider_game_id:game.id,captured_at:receivedAt,...coverage,rejected_records:coverage.rejected_records.map((r:any)=>r.reason)});
    if(!coverage.complete_response||coverage.rejected_records.length)summary.errors.push('PARTIAL_PROP_CONTRACT_COVERAGE_'+game.id);
    await checkpoint();
   }
  }else if(mode==='history'&&range){
   const url=new URL('https://api.balldontlie.io/v1/games');url.searchParams.set('start_date',range.startDate);url.searchParams.set('end_date',range.endDate);url.searchParams.set('per_page','100');url.searchParams.append('seasons[]',String(now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1));
   summary.history_capture={source_url:url.toString(),provider_date_range:range,raw_provider_responses:[],complete:false};
   const result=await collectCursorPages(async(cursor:any)=>{const u=new URL(url);if(cursor!==null)u.searchParams.set('cursor',String(cursor));return fetchJson(u);},{maxPages:6,onPage:async(page:any)=>{summary.history_capture.raw_provider_responses.push(page);await checkpoint();}});
   if(!result.complete)throw Error('NBA_RESEARCH_HISTORY_PAGE_LIMIT');
   summary.history_capture=normalizeHistoryGamePages({pages:result.pages,receivedAt:new Date().toISOString(),requestUrl:url.toString(),runId,...range});
   summary.history_capture.complete=true;
   summary.history_games=summary.history_capture.games.length;
  }else if(mode==='stats'&&range){
   const days=[];for(let t=Date.parse(range.startDate+'T12:00:00Z');t<=Date.parse(range.endDate+'T12:00:00Z');t+=86400000)days.push(new Date(t).toISOString().slice(0,10));
   const schedules=[];for(const d of days)schedules.push(...rows(await db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').eq('date_local',d).order('source_received_at',{ascending:false}).limit(1)));
   const archivedHistory=rows(await db.from('nba_market_sync_runs_v1').select('summary').like('slot','research:history:%').eq('status','completed').order('started_at',{ascending:false}).limit(1));
   const history=archivedHistory[0]?.summary?.history_capture;
   const merged=mergeNbaScheduleGames([...schedules,...(history?[{source_received_at:history.received_at,payload:{data:{games:history.games.map((x:any)=>x.game)}}}]:[])]);
   const finals=[...merged.values()].map((x:any)=>x.game).filter((g:any)=>g.status_state==='final'&&String(g.date).slice(0,10)>=range.startDate&&String(g.date).slice(0,10)<=range.endDate&&(!requestedIds||requestedIds.includes(g.id)));
   if(requestedIds&&requestedIds.some(id=>!finals.some((g:any)=>g.id===id)))throw Error('NBA_RESEARCH_FINAL_ID_UNVERIFIED');
   const ids=finals.map((g:any)=>g.id),existing=ids.length?rows(await db.from('nba_game_context_v2').select('game_id,provider_game_id,player_stats').in('provider_game_id',ids)):[];
   const complete=new Set(existing.filter((c:any)=>finalPlayerStatsComplete(c.player_stats?.data,finals.find((g:any)=>g.id===Number(c.provider_game_id)))).map((c:any)=>Number(c.provider_game_id)));
   const materialized:any[]=[];
   if(ids.length)for(let offset=0;offset<10000;offset+=1000){
    const page=rows(await db.from('nba_goat_player_game_research_v1').select('provider_game_id,team_id,pts,minutes_played').in('provider_game_id',ids).order('provider_game_id').order('player_id').range(offset,offset+999));materialized.push(...page);
    if(page.length<1000)break;if(offset===9000)throw Error('NBA_RESEARCH_STORED_STATS_SCAN_BOUND');
   }
   const materializedComplete=(g:any)=>{const list=materialized.filter((r:any)=>r.provider_game_id===g.id);return list.length>=10&&[g.home_team.id,g.visitor_team.id].every((id:number)=>{const team=list.filter((r:any)=>r.team_id===id);return team.length>=5&&team.every((r:any)=>r.pts===null?Number(r.minutes_played)===0:Number.isSafeInteger(Number(r.pts))&&Number(r.pts)>=0)&&team.reduce((sum:number,r:any)=>sum+Number(r.pts??0),0)===(id===g.home_team.id?g.home_team_score:g.visitor_team_score);});};
   const allMissing=finals.filter((g:any)=>!complete.has(g.id)&&!materializedComplete(g)),missing=allMissing.slice(0,16);
   summary.games=missing.map((g:any)=>({provider_game_id:g.id}));summary.already_available=finals.length-allMissing.length;summary.remaining_after_batch=allMissing.length-missing.length;
   if(summary.remaining_after_batch)summary.errors.push('MORE_STATS_GAMES_REQUIRE_NEXT_BOUNDED_CAPTURE');
   if(missing.length){
    const url=new URL('https://api.balldontlie.io/v1/stats');for(const game of missing)url.searchParams.append('game_ids[]',String(game.id));url.searchParams.set('per_page','100');
    summary.player_stats_capture={source_url:url.toString(),raw_provider_responses:[],pagination_complete:false};
    const result=await collectCursorPages(async(cursor:any)=>{const u=new URL(url);if(cursor!==null)u.searchParams.set('cursor',String(cursor));return fetchJson(u);},{maxPages:8,onPage:async(page:any)=>{summary.player_stats_capture.raw_provider_responses.push(page);await checkpoint();}});
    if(!result.complete)throw Error('NBA_RESEARCH_STATS_PAGE_LIMIT');
    summary.player_stats_capture.pagination_complete=true;summary.player_stats_capture.received_at=new Date().toISOString();
    for(const game of missing){
     const data=result.data.filter((s:any)=>Number(s?.game?.id)===game.id);
     if(!finalPlayerStatsComplete(data,game))throw Error('NBA_RESEARCH_STATS_FINAL_TRUTH_UNVERIFIED');
     const prior=existing.find((c:any)=>Number(c.provider_game_id)===game.id);if(prior?.player_stats){summary.errors.push('EXISTING_PARTIAL_STATS_PRESERVED_'+game.id);continue;}
     const at=new Date().toISOString(),values={player_stats:{data,meta:{capture_version:NBA_RESEARCH_CAPTURE_VERSION,run_id:runId,source_url:url.toString(),response_sha256s:result.pages.map(hashResearch),complete:true}},player_stats_captured_at:at,updated_at:at};
     const w=prior?await db.from('nba_game_context_v2').update(values).eq('game_id',prior.game_id).is('player_stats',null).select('game_id'):await db.from('nba_game_context_v2').insert({game_id:'bdl_nba_'+game.id,provider_game_id:game.id,provider:'balldontlie',source_version:NBA_RESEARCH_CAPTURE_VERSION,...values}).select('game_id');
     if(w.error&&w.error.code!=='23505')throw Error('NBA_RESEARCH_STATS_WRITE_FAILED');summary.stats_games+=w.data?.length??0;
    }
   }
  }
 }catch(e){summary.errors.push(e instanceof Error?e.message:'NBA_RESEARCH_CAPTURE_FAILED');}
 const status=summary.errors.length?(summary.snapshots||summary.stats_games||summary.history_games?'partial':'failed'):'completed';
 const saved=await db.from('nba_market_sync_runs_v1').update({status,completed_at:new Date().toISOString(),summary}).eq('run_id',runId);
 if(saved.error)throw Error('NBA_RESEARCH_FINAL_LEDGER_WRITE_FAILED');
 return {status,run_id:runId,...summary,history_capture:undefined,player_stats_capture:undefined,unarchived_prop_response:undefined};
}
