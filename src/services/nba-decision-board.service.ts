import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {buildNbaDecisionBoard,BOARD_VERSION} from '@/lib/nba/decision-board-core.mjs';
import {readOriginalContexts} from '@/lib/nba/decision-storage-original.mjs';
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
  const diffs=settled.map(r=>{
   const p=Number(r.feature_snapshot?.projectedLine),a=Number(r.settlement_details?.actual);
   return Number.isFinite(p)&&Number.isFinite(a)&&r.feature_snapshot?.projectedLine!=null&&r.settlement_details?.actual!=null?
     Math.abs(p-a):null;
  }).filter((n:any)=>n!==null) as number[];
  result[market]={settled:settled.length,pending:group.length-settled.length,wins,
   losses:decisions.length-wins,hitRate:decisions.length?Math.round(wins/decisions.length*1000)/10:null,
   projectionMae:diffs.length?Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length*100)/100:null,
   evaluatedProjections:diffs.length,modelVersion:'nba_prediction_engine_v1',
   validationStatus:decisions.length<100?'EXPLORATORY_SMALL_SAMPLE':'REQUIRES_INDEPENDENT_CALIBRATION'};
 }
 result.props={settled:null,hitRate:null,projectionMae:null,validationStatus:'SEE_DECISION_SHADOW_LEDGER'};
 result.periods={...result.props};
 return result;
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
  db.from('prediction_history').select('market,result,model_version,feature_snapshot,settlement_details,created_at,settled_at')
    .lte('created_at',asOf).eq('sport_key','basketball_nba').eq('prediction_origin','CURRENT_ERA_SHADOW')
    .order('created_at',{ascending:false}).limit(500).abortSignal(AbortSignal.timeout(8000)),
  db.from('nba_game_context_v2').select('provider_game_id,player_stats,player_stats_captured_at').lte('player_stats_captured_at',asOf)
    .not('player_stats','is',null).order('player_stats_captured_at',{ascending:false})
    .limit(28).abortSignal(AbortSignal.timeout(12000)),
  db.from('nba_pregame_context_v1').select('captured_at,game_ids,coverage,projected_lineups,injuries')
    .lte('captured_at',asOf).order('captured_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(8000)),
 ]);
 const schedule=check(slate,'NBA_DECISION_SCHEDULE_FAILED')[0]??null;
 const archive=check(archived,'NBA_DECISION_ARCHIVE_FAILED')[0]??null;
 const hoop=check(hoops,'NBA_DECISION_HOOPS_ARCHIVE_FAILED')[0]??null;
 const settled=check(settlementRows,'NBA_DECISION_ACCURACY_FAILED');
 const nameRows=check(contextResult,'NBA_DECISION_NAMES_FAILED');
 const games=(schedule?.payload?.data?.games??[]).filter((g:any)=>Number.isFinite(stamp(g?.datetime))&&prDate(new Date(g.datetime))===day);
 const gameIds=games.map((g:any)=>Number(g.id)).filter(Number.isSafeInteger);
 const historicalCapture=archive?.summary?.history_capture;
 const tail=tailDays(historicalCapture,day);
 const snapshots=await Promise.all(tail.map(async (date:string)=>{
   if(date===day)return schedule;
   const result=await db.from('nba_market_schedules_v1').select('source_received_at,payload,date_local')
     .eq('date_local',date).lte('source_received_at',asOf).lte('recorded_at',asOf)
     .order('source_received_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(8000));
   return check(result,'NBA_DECISION_CALENDAR_READ_FAILED')[0]??null;
 }));
 const calendar=archivedCalendar(historicalCapture,snapshots,asOf);
 // Current market selection is bounded to the game's latest archived quotes, not every historical snapshot.
 const recentMain=(await Promise.all(gameIds.map(async (id:number)=>{
   const r=await db.from('nba_market_quotes_v1')
     .select('provider_game_id,quote_id,market,side,line,american_odds,source_received_at,provider_updated_at,phase,period,contract,payload,snapshot_id')
     .eq('provider_game_id',id).in('market',['moneyline','spread','total'])
     .gte('source_received_at',threeHours).lte('source_received_at',asOf).lte('recorded_at',asOf)
     .order('source_received_at',{ascending:false}).order('quote_id').limit(1000).abortSignal(AbortSignal.timeout(10000));
   const quotes=check(r,'NBA_DECISION_MAIN_QUOTES_FAILED');
   if(quotes.length>=1000) throw Error('NBA_DECISION_MAIN_QUOTES_REVIEW_LIMIT');
   return quotes;
 }))).flat();
 const propHead=gameIds.length?await Promise.all(gameIds.map(async (id:number)=>{
  const r=await db.from('nba_market_quotes_v1')
    .select('snapshot_id,source_received_at').eq('provider_game_id',id).eq('market','props').lte('source_received_at',asOf).lte('recorded_at',asOf)
    .order('source_received_at',{ascending:false}).limit(1).maybeSingle();
  if(r.error)throw new Error('NBA_DECISION_PROPS_HEAD_FAILED');
  return {id,head:r.data};
 })):[];
 const ambiguousSnapshots:number[]=[];
 const propSnapshots=await Promise.all(propHead.filter(x=>x.head?.snapshot_id).map(async x=>{
   const metadata=await db.from('nba_market_snapshots_v1')
     .select('snapshot_id,provider_game_id,batches:payload->meta->>batch_count,phase')
     .eq('snapshot_id',x.head!.snapshot_id).eq('provider_game_id',x.id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
   if(metadata.error)throw Error('NBA_DECISION_PROP_METADATA_FAILED');
   if(!metadata.data || Number(metadata.data.batches??1)!==1 || metadata.data.phase!=='PREGAME'){
     ambiguousSnapshots.push(x.id);
     return [];
   }
   const r=await db.from('nba_market_quotes_v1')
    .select('provider_game_id,quote_id,player_id,market,statistic,period,side,contract,line,american_odds,source_received_at,provider_updated_at,phase,payload,snapshot_id')
    .eq('provider_game_id',x.id).eq('snapshot_id',x.head!.snapshot_id)
    .eq('market','props').lte('recorded_at',asOf).lte('source_received_at',asOf).in('side',['over','under']).order('quote_id').limit(1000).abortSignal(AbortSignal.timeout(12000));
   const data=check(r,'NBA_DECISION_PROPS_SNAPSHOT_FAILED');
   if(data.length>=1000)throw new Error('NBA_DECISION_PROP_SNAPSHOT_SCAN_LIMIT');
   return data;
 }));
 const propQuotes=propSnapshots.flat();
 const playerIds=[...new Set(propQuotes.map((x:any)=>Number(x.player_id)).filter(Number.isSafeInteger))];
 // The first history page is latest-game biased. Fetch all pages for players in the current slate.
 const seasons=[...new Set<number>(games.map((g:any)=>g.season).filter(Number.isSafeInteger))];
 const manifestResult=seasons.length?await db.from('nba_goat_season_archive_v1')
   .select('season,provider_game_id,response_sha256,source_captured_at,storage_bucket,storage_object_path,json_bytes,compressed_bytes,data_count')
   .eq('dataset_key','player_stats').in('season',seasons)
   .gte('game_date',new Date(now.getTime()-60*86400000).toISOString().slice(0,10)).lte('source_captured_at',asOf)
   .order('provider_game_id').limit(1000).abortSignal(AbortSignal.timeout(10000)):{data:[],error:null};
 const manifests=check(manifestResult,'NBA_DECISION_MANIFEST_READ_FAILED');
 if(manifests.length>=1000)throw new Error('NBA_DECISION_MANIFEST_REVIEW_LIMIT');
 const completeHistory:any[]=[];
 if(playerIds.length)for(let start=0;start<6000;start+=1000){
  const r=await db.from('nba_goat_player_game_research_v1')
    .select('season,provider_game_id,player_id,team_id,opponent_team_id,game_datetime,source_captured_at,source_sha256,materialized_at,minutes_played,pts,reb,ast,fg3m')
    .in('player_id',playerIds).in('season',seasons).lte('materialized_at',asOf).lte('source_captured_at',asOf)
    .gte('game_datetime',new Date(now.getTime()-60*86400000).toISOString()).lt('game_datetime',asOf)
    .order('game_datetime',{ascending:false}).order('provider_game_id',{ascending:false}).order('player_id')
    .range(start,start+999).abortSignal(AbortSignal.timeout(10000));
  const data=check(r,'NBA_DECISION_PLAYER_PAGINATION_FAILED');
  completeHistory.push(...data);
  if(data.length<1000)break;
  if(start===5000)throw new Error('NBA_DECISION_HISTORY_REVIEW_LIMIT');
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
 const receipts=needed.size?check(await db.from('nba_game_context_v2').select('provider_game_id,player_stats_captured_at')
   .gte('player_stats_captured_at',new Date(now.getTime()-61*86400000).toISOString())
   .lte('player_stats_captured_at',asOf).order('player_stats_captured_at',{ascending:false}).limit(1000)
   .abortSignal(AbortSignal.timeout(8000)),'NBA_DECISION_BOX_RECEIPTS_FAILED'):[];
 if(receipts.length>=1000)throw new Error('NBA_DECISION_BOX_RECEIPT_REVIEW_LIMIT');
 const contexts=[...nameRows];
 const loaded=new Set(nameRows.map((r:any)=>r.provider_game_id));
 const moreIds=[...new Set<number>(receipts.map((r:any)=>Number(r.provider_game_id)).filter((id:number)=>needed.has(id)&&!loaded.has(id)))];
 for(let start=0;start<moreIds.length;start+=16){
   const archivedBoxes=await db.from('nba_game_context_v2').select('provider_game_id,player_stats_captured_at,player_stats')
     .in('provider_game_id',moreIds.slice(start,start+16)).lte('player_stats_captured_at',asOf)
     .not('player_stats','is',null).limit(100).abortSignal(AbortSignal.timeout(8000));
   const boxes=check(archivedBoxes,'NBA_DECISION_BOX_READ_FAILED');
   if(boxes.length>=100)throw new Error('NBA_DECISION_BOX_REVIEW_LIMIT');
   contexts.push(...boxes);
 }
 const storageOriginals=await readOriginalContexts(manifests,contexts,needed,async (m:any)=>{
   const r=await db.storage.from(m.storage_bucket).download(m.storage_object_path);
   return r.error||!r.data?null:Buffer.from(await r.data.arrayBuffer());
 },Number(process.env.NBA_DECISION_ARCHIVE_READ_BYTES??0));
 contexts.push(...storageOriginals);
 const result=buildNbaDecisionBoard({
   scheduleGames:games,calendar,manifests,contexts,pregame:check(pregameResult,'NBA_DECISION_AVAILABILITY_FAILED')[0]??null,goatMainQuotes:recentMain,
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
   quarantinedPropGameIds:ambiguousSnapshots,propsGameSnapshots:propSnapshots.length-ambiguousSnapshots.length,playerHistoryRows:completeHistory.length,
   playerNameCoverage:Object.keys(names).length,mainQuotesRead:recentMain.length,
   reportVersion:BOARD_VERSION,noProviderCalls:true,noWrites:true
 }};
}
