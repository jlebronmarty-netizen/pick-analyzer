import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {buildNbaDecisionBoard,BOARD_VERSION} from '@/lib/nba/decision-board-core.mjs';
const stamp=v=>Date.parse(String(v??''));
const prDate=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const check=(r:any,name:string)=>{if(r.error)throw new Error(name);return r.data??[];};
function accuracy(rows:any[]){
 const result:any={};
 for(const market of ['moneyline','spread','total']){
  const group=rows.filter(r=>r.market===market&&r.model_version==='nba_prediction_engine_v1');
  const settled=group.filter(r=>['win','loss','push'].includes(r.result));
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
 result.props={settled:0,hitRate:null,projectionMae:null,validationStatus:'NO_FROZEN_PROSPECTIVE_PROP_LEDGER'};
 result.periods={settled:0,hitRate:null,projectionMae:null,validationStatus:'NO_FROZEN_PROSPECTIVE_PERIOD_LEDGER'};
 return result;
}
export async function readNbaDecisionBoard({now=new Date()}={}){
 const asOf=now.toISOString(),day=prDate(now),threeHours=new Date(now.getTime()-3*3600000).toISOString();
 const [slate,archived,hoops,historyRows,settlementRows,contexts]=await Promise.all([
  db.from('nba_market_schedules_v1').select('source_received_at,payload,date_local').eq('date_local',day)
    .order('source_received_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(10000)),
  db.from('nba_market_sync_runs_v1').select('run_id,started_at,summary').like('slot','research:history:%')
    .eq('status','completed').order('started_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(12000)),
  db.from('nba_hoopsapi_captures_v1').select('capture_id,source_received_at,normalized').order('source_received_at',{ascending:false})
    .limit(1).abortSignal(AbortSignal.timeout(8000)),
  db.from('nba_goat_player_game_research_v1').select('provider_game_id,player_id,team_id,game_datetime,source_captured_at,minutes_played,pts,reb,ast,fg3m')
    .gte('game_datetime',new Date(now.getTime()-42*86400000).toISOString()).lt('game_datetime',asOf)
    .order('game_datetime',{ascending:false}).limit(1000).abortSignal(AbortSignal.timeout(12000)),
  db.from('prediction_history').select('market,result,model_version,feature_snapshot,settlement_details,created_at')
    .eq('sport_key','basketball_nba').eq('prediction_origin','CURRENT_ERA_SHADOW')
    .order('created_at',{ascending:false}).limit(500).abortSignal(AbortSignal.timeout(8000)),
  db.from('nba_game_context_v2').select('player_stats,player_stats_captured_at')
    .not('player_stats','is',null).order('player_stats_captured_at',{ascending:false})
    .limit(28).abortSignal(AbortSignal.timeout(12000)),
 ]);
 const schedule=check(slate,'NBA_DECISION_SCHEDULE_FAILED')[0]??null;
 const archive=check(archived,'NBA_DECISION_ARCHIVE_FAILED')[0]??null;
 const hoop=check(hoops,'NBA_DECISION_HOOPS_ARCHIVE_FAILED')[0]??null;
 const playerHistory=check(historyRows,'NBA_DECISION_PLAYER_HISTORY_FAILED');
 const settled=check(settlementRows,'NBA_DECISION_ACCURACY_FAILED');
 const nameRows=check(contexts,'NBA_DECISION_NAMES_FAILED');
 const games=(schedule?.payload?.data?.games??[]).filter((g:any)=>g?.date===day);
 const gameIds=games.map((g:any)=>Number(g.id)).filter(Number.isSafeInteger);
 if(!archive?.summary?.history_capture?.complete)throw new Error('NBA_DECISION_COMPLETE_ARCHIVE_NOT_FOUND');
 // Current market selection is bounded to the game's latest archived quotes, not every historical snapshot.
 const recentMain=gameIds.length?check(await db.from('nba_market_quotes_v1')
   .select('provider_game_id,quote_id,market,side,line,american_odds,source_received_at,snapshot_id')
   .in('provider_game_id',gameIds).in('market',['moneyline','spread','total'])
   .gte('source_received_at',threeHours)
   .order('source_received_at',{ascending:false}).limit(300).abortSignal(AbortSignal.timeout(12000)),
   'NBA_DECISION_MAIN_QUOTES_FAILED'):[];
 const propHead=gameIds.length?await Promise.all(gameIds.map(async (id:number)=>{
  const r=await db.from('nba_market_quotes_v1')
    .select('snapshot_id,source_received_at').eq('provider_game_id',id).eq('market','props')
    .order('source_received_at',{ascending:false}).limit(1).maybeSingle();
  if(r.error)throw new Error('NBA_DECISION_PROPS_HEAD_FAILED');
  return {id,head:r.data};
 })):[];
 const propSnapshots=await Promise.all(propHead.filter(x=>x.head?.snapshot_id).map(async x=>{
   const r=await db.from('nba_market_quotes_v1')
    .select('provider_game_id,quote_id,player_id,market,statistic,period,side,contract,line,american_odds,source_received_at,snapshot_id')
    .eq('provider_game_id',x.id).eq('snapshot_id',x.head!.snapshot_id)
    .in('side',['over','under']).order('quote_id').limit(1000).abortSignal(AbortSignal.timeout(12000));
   const data=check(r,'NBA_DECISION_PROPS_SNAPSHOT_FAILED');
   if(data.length>=1000)throw new Error('NBA_DECISION_PROP_SNAPSHOT_SCAN_LIMIT');
   return data;
 }));
 const propQuotes=propSnapshots.flat();
 const playerIds=[...new Set(propQuotes.map((x:any)=>Number(x.player_id)).filter(Number.isSafeInteger))];
 // The first history page is latest-game biased. Fetch all pages for players in the current slate.
 const completeHistory:any[]=[];
 if(playerIds.length)for(let start=0;start<6000;start+=1000){
  const r=await db.from('nba_goat_player_game_research_v1')
    .select('provider_game_id,player_id,team_id,game_datetime,source_captured_at,minutes_played,pts,reb,ast,fg3m')
    .in('player_id',playerIds).lt('game_datetime',asOf)
    .order('game_datetime',{ascending:false}).order('provider_game_id',{ascending:false})
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
      names[String(id)]=String(player.first_name)+' '+String(player.last_name);
   }
 }
 const result=buildNbaDecisionBoard({
   scheduleGames:games,historyFinals:archive.summary.history_capture.games,goatMainQuotes:recentMain,
   goatPropQuotes:propQuotes,playerHistory:completeHistory,playerNames:names,
   hoopsCapture:hoop,asOf
 });
 return {...result,accuracy:accuracy(settled),evidence:{
   scheduleCapturedAt:schedule?.source_received_at??null,
   historyCaptureAt:archive?.started_at??null,
   historyRunId:archive?.run_id??null,
   hoopsCapturedAt:hoop?.source_received_at??null,hoopsCaptureId:hoop?.capture_id??null,
   propsGameSnapshots:propSnapshots.length,playerHistoryRows:completeHistory.length,
   playerNameCoverage:Object.keys(names).length,mainQuotesRead:recentMain.length,
   reportVersion:BOARD_VERSION,noProviderCalls:true,noWrites:true
 }};
}
