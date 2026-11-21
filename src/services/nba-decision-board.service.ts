import 'server-only';
import {gameMetrics} from '@/lib/data-quality/game-metrics.mjs';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {buildNbaDecisionBoard,BOARD_VERSION} from '@/lib/nba/decision-board-core.mjs';
import {readOriginalContexts} from '@/lib/nba/decision-storage-original.mjs';
import {readMarketBatches} from '@/lib/nba/decision-market-snapshot.mjs';
import {archivedCalendar,tailDays} from '@/lib/nba/decision-calendar.mjs';
const stamp=(v:unknown)=>Date.parse(String(v??''));
const prDate=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const check=(r:any,name:string)=>{if(r.error)throw new Error(name);return r.data??[];};
function accuracy(rows:any[],asOf:string){
 const result:any={};
 for(const market of ['moneyline','spread','total']){
  const group=rows.filter(r=>r.market===market&&r.model_version==='nba_prediction_engine_v1');
  const settled=group.filter(r=>stamp(r.settled_at)<=stamp(asOf)&&['win','loss','push'].includes(r.result));
  const decisions=settled.filter(r=>r.result!=='push');
  const wins=decisions.filter(r=>r.result==='win').length;
  const measured=gameMetrics(settled.map(r=>{
   const p=r.feature_snapshot?.projectedLine,a=r.settlement_details?.actual;
   const error=p==null||a==null?null:Math.abs(Number(p)-Number(a));
   return {gameId:r.game_id,result:r.result,error};
  }));
  result[market]={settled:settled.length,pending:group.length-settled.length,wins,
   losses:decisions.length-wins,hitRate:measured.hitRate,uniqueGames:measured.uniqueGames,
   projectionMae:measured.mae,evaluatedProjections:measured.errorGames,modelVersion:'nba_prediction_engine_v1',
   validationStatus:measured.decisionGames<100?'EXPLORATORY_SMALL_SAMPLE':'REQUIRES_INDEPENDENT_CALIBRATION'};
 }
 result.props={settled:null,hitRate:null,projectionMae:null,validationStatus:'SEE_DECISION_SHADOW_LEDGER'};
 result.periods={...result.props};
 return result;
}
async function marketReceipt(game:any,lane:'main'|'props',asOf:string,since:string){
 const query=(fields:string)=>{
   const q=db.from('nba_market_snapshots_v1').select(fields).eq('provider_game_id',game.id)
     .gte('source_received_at',since).lte('source_received_at',asOf).lte('recorded_at',asOf);
   return lane==='props'?q.eq('payload->meta->>capture_version','NBA_GOAT_RESEARCH_CAPTURE_V1'):
     q.is('payload->meta->>capture_version',null);
 };
 const head=await query('source_received_at').order('source_received_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
 if(head.error)throw Error('NBA_DECISION_MARKET_HEAD_FAILED');
 if(!head.data)return {id:game.id,lane,quotes:[],reason:'SOURCE_UNAVAILABLE'};
 const fields=['provider_game_id,snapshot_id,source_received_at,recorded_at,phase,quote_count',
   'game:payload->data->game,quotes:payload->data->quotes,payload_phase:payload->data->>phase',
   'payload_snapshot_id:payload->meta->>snapshot_id,payload_received_at:payload->meta->>source_received_at',
   'namespace:payload->meta->>id_namespace,provider:payload->meta->>provider,book:payload->meta->>sportsbook',
   'status:payload->meta->>status,payload_count:payload->meta->quote_count,capture_id:payload->meta->>capture_id',
   'response_hash:payload->meta->>response_sha256,batch_index:payload->meta->batch_index,batch_count:payload->meta->batch_count',
   'complete:payload->meta->coverage->complete_response,normalized_count:payload->meta->coverage->normalized_quotes'].join(',');
 const at=(head.data as any).source_received_at;
 const result=await query(fields).eq('source_received_at',at).order('snapshot_id').limit(33).abortSignal(AbortSignal.timeout(10000));
 return {id:game.id,lane,...readMarketBatches(check(result,'NBA_DECISION_MARKET_CAPTURE_FAILED'),game,lane,asOf)};
}
export async function readNbaDecisionBoard({now=new Date()}={}){
 const asOf=now.toISOString(),day=prDate(now),threeHours=new Date(now.getTime()-3*3600000).toISOString();
 const [slate,archived,hoops,settlementRows,contextResult,pregameResult]=await Promise.all([
  db.from('nba_market_schedules_v1').select('source_received_at,payload,date_local').eq('date_local',day).lte('recorded_at',asOf).lte('source_received_at',asOf)
    .order('source_received_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(10000)),
  db.from('nba_market_sync_runs_v1').select('run_id,started_at,summary').like('slot','research:history:%')
    .eq('status','completed').lte('completed_at',asOf).order('started_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(12000)),
  db.from('nba_hoopsapi_captures_v1').select('capture_id,source_received_at,normalized').lte('archived_at',asOf).lte('source_received_at',asOf).order('source_received_at',{ascending:false})
    .limit(1).abortSignal(AbortSignal.timeout(8000)),
  db.from('prediction_history').select('game_id,market,result,model_version,feature_snapshot,settlement_details,created_at,settled_at')
    .lte('created_at',asOf).eq('sport_key','basketball_nba').eq('prediction_origin','CURRENT_ERA_SHADOW')
    .order('created_at',{ascending:false}).limit(500).abortSignal(AbortSignal.timeout(8000)),
  db.from('nba_game_context_v2').select('provider_game_id,player_stats,player_stats_captured_at').lte('player_stats_captured_at',asOf)
    .not('player_stats','is',null).order('player_stats_captured_at',{ascending:false})
    .limit(28).abortSignal(AbortSignal.timeout(12000)),
  db.from('nba_pregame_context_v1').select('captured_at,game_ids,coverage,projected_lineups,injuries')
    .gte('captured_at',threeHours).lte('captured_at',asOf).order('captured_at',{ascending:false}).limit(96).abortSignal(AbortSignal.timeout(8000)),
 ]);
 const readIssues:string[]=[];
 const optional=(r:any,code:string)=>{
   if(r.error){readIssues.push(code);return [];}
   return r.data??[];
 };
 const schedule=check(slate,'NBA_DECISION_SCHEDULE_FAILED')[0]??null;
 const archive=optional(archived,'NBA_DECISION_ARCHIVE_FAILED')[0]??null;
 const hoop=optional(hoops,'NBA_DECISION_HOOPS_ARCHIVE_FAILED')[0]??null;
 const settled=optional(settlementRows,'NBA_DECISION_ACCURACY_FAILED');
 const nameRows=optional(contextResult,'NBA_DECISION_NAMES_FAILED');
 const games=(schedule?.payload?.data?.games??[]).filter((g:any)=>Number.isFinite(stamp(g?.datetime))&&prDate(new Date(g.datetime))===day);
 const historicalCapture=archive?.summary?.history_capture;
 const tail=tailDays(historicalCapture,day);
 const snapshots=await Promise.all(tail.map(async (date:string)=>{
   if(date===day)return schedule;
   const result=await db.from('nba_market_schedules_v1').select('source_received_at,payload,date_local')
     .eq('date_local',date).lte('source_received_at',asOf).lte('recorded_at',asOf)
     .order('source_received_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(8000));
   return optional(result,'NBA_DECISION_CALENDAR_READ_FAILED')[0]??null;
 }));
 const calendar=archivedCalendar(historicalCapture,snapshots,asOf);
 const captures=await Promise.all(games.flatMap((game:any)=>(['main','props'] as const).map(async lane=>{
   try{return await marketReceipt(game,lane,asOf,threeHours);}
   catch{return {id:game.id,lane,quotes:[],reason:'SOURCE_UNAVAILABLE'};}
 })));
 const recentMain=captures.filter(c=>c.lane==='main').flatMap(c=>c.quotes);
 const propSnapshots=captures.filter(c=>c.lane==='props');
 const propQuotes=propSnapshots.flatMap(c=>c.quotes);
 const ambiguousSnapshots=propSnapshots.filter(c=>c.reason).map(c=>c.id);
 const playerIds=[...new Set(propQuotes.map((x:any)=>Number(x.player_id)).filter(Number.isSafeInteger))];
 // The first history page is latest-game biased. Fetch all pages for players in the current slate.
 const seasons=[...new Set<number>(games.map((g:any)=>g.season).filter(Number.isSafeInteger))];
 const manifestResult=seasons.length?await db.from('nba_goat_season_archive_v1')
   .select('season,provider_game_id,response_sha256,source_captured_at,storage_bucket,storage_object_path,json_bytes,compressed_bytes,data_count')
   .eq('dataset_key','player_stats').in('season',seasons)
   .gte('game_date',new Date(now.getTime()-60*86400000).toISOString().slice(0,10)).lte('source_captured_at',asOf)
   .order('provider_game_id').limit(1000).abortSignal(AbortSignal.timeout(10000)):{data:[],error:null};
 let manifests=optional(manifestResult,'NBA_DECISION_MANIFEST_READ_FAILED');
 if(manifests.length>=1000){manifests=[];readIssues.push('NBA_DECISION_MANIFEST_REVIEW_LIMIT');}
 const completeHistory:any[]=[];
 for(let i=0;i<playerIds.length;i+=24){
  // Pages are disjoint by player. A failed group cannot substitute a partial history.
  const group=playerIds.slice(i,i+24),groupRows:any[]=[];
  for(let start=0;;start+=1000){
   const r=await db.from('nba_goat_player_game_research_v1')
     .select('season,provider_game_id,player_id,team_id,opponent_team_id,game_datetime,source_captured_at,source_sha256,materialized_at,minutes_played,pts,reb,ast,fg3m')
     .in('player_id',group).in('season',seasons).lte('materialized_at',asOf).lte('source_captured_at',asOf)
     .gte('game_datetime',new Date(now.getTime()-60*86400000).toISOString()).lt('game_datetime',asOf)
     .order('game_datetime',{ascending:false}).order('provider_game_id',{ascending:false}).order('player_id')
     .range(start,start+999).abortSignal(AbortSignal.timeout(10000));
   if(r.error){readIssues.push('NBA_DECISION_PLAYER_PAGINATION_FAILED');break;}
   const page=r.data??[];groupRows.push(...page);
   if(page.length<1000){completeHistory.push(...groupRows);break;}
  }
 }
 // Names are resolved only from trusted GOAT game-boxscore player identities. No speculative aliases.
 const names:Record<string,string>={};
 for(const row of nameRows){
   if(!row.player_stats_captured_at||stamp(row.player_stats_captured_at)>now.getTime())continue;
   for(const stat of row.player_stats?.data??[]){
    const player=stat?.player;
    const id=Number(player?.id);
    if(Number.isSafeInteger(id)&&player?.first_name&&player?.last_name)
      names[String(id)]??=String(player.first_name)+' '+String(player.last_name);
   }
 }
 // Discover all operational originals in scope using small metadata rows. A
 // newer operational revision takes precedence over the first season archive.
 const needed=new Set<number>(completeHistory.map(r=>r.provider_game_id));
 const receiptQuery=needed.size?await db.from('nba_game_context_v2').select('provider_game_id,player_stats_captured_at')
   .gte('player_stats_captured_at',new Date(now.getTime()-61*86400000).toISOString())
   .lte('player_stats_captured_at',asOf).order('player_stats_captured_at',{ascending:false}).limit(1000)
   .abortSignal(AbortSignal.timeout(8000)):{data:[],error:null};
 const receipts=optional(receiptQuery,'NBA_DECISION_BOX_RECEIPTS_FAILED');
 const incompleteIndex=Boolean(receiptQuery.error)||receipts.length>=1000;
 if(incompleteIndex)readIssues.push('NBA_DECISION_BOX_RECEIPT_REVIEW_LIMIT');
 const contexts=[...nameRows];
 const loaded=new Set(nameRows.map((r:any)=>r.provider_game_id));
 const moreIds=[...new Set<number>(receipts.map((r:any)=>Number(r.provider_game_id)).filter((id:number)=>needed.has(id)&&!loaded.has(id)))];
 for(let start=0;start<moreIds.length;start+=16){
   const archivedBoxes=await db.from('nba_game_context_v2').select('provider_game_id,player_stats_captured_at,player_stats')
     .in('provider_game_id',moreIds.slice(start,start+16)).lte('player_stats_captured_at',asOf)
     .not('player_stats','is',null).limit(100).abortSignal(AbortSignal.timeout(8000));
   if(archivedBoxes.error||(archivedBoxes.data?.length??0)>=100){
     readIssues.push('NBA_DECISION_BOX_READ_FAILED');
     // Record unavailable operational revisions so a first season archive cannot supersede them.
     contexts.push(...moreIds.slice(start,start+16).map(id=>({provider_game_id:id,player_stats_captured_at:asOf,player_stats:null})));
     continue;
   }
   const boxes=archivedBoxes.data??[];
   contexts.push(...boxes);
 }
 if(incompleteIndex)contexts.push(...[...needed].map(id=>({provider_game_id:id,player_stats_captured_at:asOf,player_stats:null})));
 const storageOriginals=await readOriginalContexts(manifests,contexts,needed,async (m:any)=>{
   const r=await db.storage.from(m.storage_bucket).download(m.storage_object_path);
   return r.error||!r.data?null:Buffer.from(await r.data.arrayBuffer());
 },Number(process.env.NBA_DECISION_ARCHIVE_READ_BYTES??0));
 contexts.push(...storageOriginals);
 const available=optional(pregameResult,'NBA_DECISION_AVAILABILITY_FAILED');
 for(const p of available)for(const lineup of p.projected_lineups?.data??[]){
  for(const entry of lineup.lineup??[]){
   const player=entry.player;
   if(Number.isSafeInteger(player?.id)&&player.first_name&&player.last_name)
    names[String(player.id)]??=player.first_name+' '+player.last_name;
  }
 }
 const result=buildNbaDecisionBoard({
   scheduleGames:games,calendar,manifests,contexts,pregame:available,goatMainQuotes:recentMain,
   goatPropQuotes:propQuotes,playerHistory:completeHistory,playerNames:names,
   hoopsCapture:hoop,asOf
 });
 if(Object.keys(result.summary.qualityCounts).some(k=>k!=='VALIDATED'))
   console.info('NBA_DECISION_DATA_QUALITY',{day,counts:result.summary.qualityCounts,calendarIssues:calendar.issues});
 return {...result,accuracy:accuracy(settled,asOf),evidence:{
   scheduleCapturedAt:schedule?.source_received_at??null,
   historyCaptureAt:archive?.started_at??null,
   historyRunId:archive?.run_id??null,
   hoopsCapturedAt:hoop?.source_received_at??null,hoopsCaptureId:hoop?.capture_id??null,
   readIssues:[...new Set(readIssues)],marketCaptureIssues:captures.filter(c=>c.reason).map(c=>({game:c.id,lane:c.lane,reason:c.reason})),quarantinedPropGameIds:ambiguousSnapshots,propsGameSnapshots:propSnapshots.length-ambiguousSnapshots.length,playerHistoryRows:completeHistory.length,
   playerNameCoverage:Object.keys(names).length,mainQuotesRead:recentMain.length,
   reportVersion:BOARD_VERSION,noProviderCalls:true,noWrites:true
 }};
}
