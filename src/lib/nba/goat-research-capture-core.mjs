import {createHash} from 'node:crypto';
import {localDay,validateArchive} from '../nba-archive-core.mjs';

export const NBA_RESEARCH_CAPTURE_VERSION='NBA_GOAT_RESEARCH_CAPTURE_V1';
export const hashResearch=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const FULL_GAME=new Set(['assists','blocks','double_double','points','points_assists','points_rebounds','points_rebounds_assists','rebounds','rebounds_assists','steals','threes','triple_double']);
const TIMED=new Map([
 ['assists_1q',['assists','Q1']],['points_1q',['points','Q1']],['rebounds_1q',['rebounds','Q1']],
 ['assists_first3min',['assists','FIRST_3_MINUTES']],['points_first3min',['points','FIRST_3_MINUTES']],['rebounds_first3min',['rebounds','FIRST_3_MINUTES']],
]);
const stamp=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const number=x=>!['number','string'].includes(typeof x)||typeof x==='string'&&!x.trim()?null:Number.isFinite(Number(x))?Number(x):null;
const price=x=>{const n=number(x);return Number.isInteger(n)&&Math.abs(n)>=100?n:null;};
export function propScope(type){
 if(TIMED.has(type)){const [statistic,period]=TIMED.get(type);return {statistic,period,scope_verified:true};}
 if(FULL_GAME.has(type))return {statistic:type,period:'FULL_GAME_LABEL_OT_UNVERIFIED',scope_verified:true};
 return {statistic:String(type??'UNKNOWN'),period:'PROVIDER_PERIOD_UNVERIFIED',scope_verified:false};
}
export function researchGamePhase(game,receivedAt){
 if(game?.postponed||/final|cancel|postpon/i.test(`${game?.status} ${game?.status_state}`))return 'NOT_OPEN_FOR_PREGAME';
 if(Number(game?.period)>0||game?.status_state==='in_progress')return 'IN_PLAY';
 if(!stamp(game?.datetime)||Date.parse(game.datetime)<=Date.parse(receivedAt))return 'START_STATE_UNCERTAIN';
 return 'PREGAME';
}

// Keep every provider row in the raw envelope, including unsupported contracts.
// A milestone is never converted to an Over or given a synthetic Under price.
export function buildResearchPropEnvelopes({game,payload,receivedAt,requestUrl,runId}){
 if(!Array.isArray(payload?.data)||!stamp(receivedAt))throw Error('RESEARCH_PROPS_RESPONSE_INVALID');
 if(payload.data.length>10000)throw Error('RESEARCH_PROPS_RESPONSE_BOUND');
 const quotes=[],rejected=[],counts={},seen=new Set();
 for(const row of payload.data){
  const reject=reason=>rejected.push({provider_record_id:row?.id??null,reason});
  if(Number(row?.game_id)!==game.id){reject('GAME_IDENTITY_MISMATCH');continue;}
  if(String(row?.vendor??'').toLowerCase()!=='fanduel'){reject('OTHER_VENDOR');continue;}
  const playerId=number(row?.player_id),line=number(row?.line_value),type=row?.prop_type;
  if(!Number.isSafeInteger(playerId)||playerId<=0||line===null||line<0||typeof type!=='string'||!type){reject('PLAYER_LINE_OR_STAT_UNVERIFIED');continue;}
  if(!stamp(row?.updated_at)){reject('PROVIDER_TIMESTAMP_UNVERIFIED');continue;}
  if(Date.parse(row.updated_at)>Date.parse(receivedAt)){reject('FUTURE_PROVIDER_TIMESTAMP');continue;}
  const scope=propScope(type),m=row?.market;
  const choices=m?.type==='over_under'
   ? [['over',m.over_odds,'STRICT_GREATER_THAN'],['under',m.under_odds,'STRICT_LESS_THAN']]
   : m?.type==='milestone'?[['yes',m.odds,'PROVIDER_MILESTONE_UNVERIFIED']]:[];
  if(!choices.length){reject('PROVIDER_CONTRACT_UNSUPPORTED');continue;}
  for(const [side,rawPrice,contract] of choices){
   const odds=price(rawPrice);if(odds===null){reject('PRICE_UNAVAILABLE_'+side);continue;}
   const quoteId=hashResearch({version:NBA_RESEARCH_CAPTURE_VERSION,providerRecord:row,side,contract,statistic:scope.statistic,period:scope.period,line,odds});
   if(seen.has(quoteId))continue;seen.add(quoteId);
   const age=(Date.parse(receivedAt)-Date.parse(row.updated_at))/1000;
   quotes.push({quote_id:quoteId,game_id:game.id,player_id:playerId,player_name:null,provider:'BALLDONTLIE',sportsbook:'FanDuel',market:'props',...scope,side,line,american_odds:odds,contract,
    provider_updated_at:row.updated_at,provider_record_id:row.id??null,provider_prop_type:type,provider_market_type:m.type,source_received_at:receivedAt,
    age_seconds:Math.round(age),freshness:age<0?'FUTURE_TIMESTAMP':age<=180?'RECENT':age<=300?'AGING':'STALE',
    model_probability:null,expected_value:null,recommendation:null,execution_available:false,regional_price_verified:false,
    player_identity_status:'PROVIDER_ID_ONLY',player_team_in_event:null,player_available:null,player_current_team_id:null,
    overtime_rule:'NOT_VERIFIED',sportsbook_settlement:false,projection_origin:'NONE',capture_version:NBA_RESEARCH_CAPTURE_VERSION});
   counts[type]=(counts[type]??0)+1;
  }
 }
 const responseHash=hashResearch(payload),captureId=hashResearch({runId,gameId:game.id,receivedAt,responseHash}),size=2000,batches=Math.max(1,Math.ceil(quotes.length/size));
 return Array.from({length:batches},(_,index)=>{
  const selection=quotes.slice(index*size,(index+1)*size);
  const envelope={meta:{contract_version:'NBA_MARKET_DATA_V1',provider:'BALLDONTLIE',sportsbook:'FanDuel',id_namespace:'balldontlie',source_received_at:receivedAt,
   snapshot_id:hashResearch({captureId,index}),quote_count:selection.length,status:rejected.length?'PARTIAL_PROVIDER_COVERAGE':'DATA_RETRIEVED',capture_version:NBA_RESEARCH_CAPTURE_VERSION,capture_id:captureId,run_id:runId,batch_index:index,batch_count:batches,
   source_url:requestUrl,response_sha256:responseHash,raw_provider_response:index===0?payload:null,
   coverage:{requested_prop_type:null,provider_records:payload.data.length,normalized_quotes:quotes.length,by_provider_prop_type:counts,rejected_records:rejected,complete_response:payload?.meta?.next_cursor==null,
    full_fanduel_catalog_verified:false,not_documented_by_endpoint:['GAME_QUARTER_ODDS','GAME_HALF_ODDS','TEAM_TOTAL_ODDS'],projection_origin:'NONE'}},
   data:{game,phase:researchGamePhase(game,receivedAt),quotes:selection}};
  return validateArchive(envelope,new Date(receivedAt));
 });
}

// Cursor APIs only. Player props explicitly has no pagination in provider docs.
export async function collectCursorPages(fetchPage,{maxPages=6,onPage=async(_page,_index)=>{}}={}){
 const pages=[],data=[],seen=new Set();let cursor=null;
 for(let page=0;page<maxPages;page++){
  const payload=await fetchPage(cursor);
  if(!Array.isArray(payload?.data))throw Error('RESEARCH_PAGE_INVALID');
  pages.push(payload);data.push(...payload.data);await onPage(payload,page);
  const next=payload?.meta?.next_cursor;
  if(next===null||next===undefined)return {data,pages,complete:true,next_cursor:null};
  if((typeof next!=='number'&&typeof next!=='string')||!/^\d+$/.test(String(next))||seen.has(String(next)))throw Error('RESEARCH_CURSOR_INVALID_OR_REPEATED');
  seen.add(String(next));cursor=next;
 }
 return {data,pages,complete:false,next_cursor:cursor};
}

export function historyDateRange(startDate,endDate,now=new Date()){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const today=localDay(now),end=endDate??new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),start=startDate??new Date(Date.parse(end+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);
 if(!valid(start)||!valid(end)||start>end||end>=today||(Date.parse(end)-Date.parse(start))/86400000>44)throw Error('RESEARCH_HISTORY_RANGE_INVALID');
 return {startDate:start,endDate:end};
}

export function finalPlayerStatsComplete(data,game){
 if(!Array.isArray(data)||data.length<10||game?.status_state!=='final')return false;
 const targets=new Map([[game?.home_team?.id,number(game?.home_team_score)],[game?.visitor_team?.id,number(game?.visitor_team_score)]]);
 if(targets.size!==2||[...targets.values()].some(n=>!Number.isSafeInteger(n)||n<0))return false;
 const sums=new Map([...targets.keys()].map(id=>[id,0])),players=new Set();
 for(const row of data){
  const playerId=row?.player?.id,teamId=row?.team?.id;
  if(!Number.isSafeInteger(playerId)||players.has(playerId)||row?.game?.id!==game.id||row?.game?.status_state!=='final'||!targets.has(teamId))return false;
  players.add(playerId);
  const isDnp=/^0+(?::0+)?$/.test(String(row?.min??'').trim());
  for(const stat of ['pts','reb','ast','fg3m','stl','blk','turnover']){const n=number(row?.[stat]);if((n===null&&!isDnp)||(n!==null&&(!Number.isSafeInteger(n)||n<0)))return false;}
  sums.set(teamId,sums.get(teamId)+(number(row.pts)??0));
 }
 return [...targets.entries()].every(([id,score])=>sums.get(id)===score);
}

export function normalizeHistoryGamePages({pages,receivedAt,requestUrl,runId,startDate,endDate}){
 const seen=new Map();
 for(const page of pages)for(const game of page.data){
  if(!Number.isSafeInteger(game?.id)||!stamp(game?.datetime))throw Error('RESEARCH_HISTORY_GAME_INVALID');
  // The provider's date filter is not Puerto Rico's calendar day. A late game
  // can start after midnight AST; retain both dates instead of dropping it.
  const providerDate=String(game?.date??'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(providerDate)||providerDate<startDate||providerDate>endDate)throw Error('RESEARCH_HISTORY_DATE_MISMATCH');
  const prior=seen.get(game.id);if(prior){if(hashResearch(prior)!==hashResearch(game))throw Error('RESEARCH_HISTORY_DUPLICATE_CONFLICT');continue;}
  seen.set(game.id,game);
 }
 return {capture_version:NBA_RESEARCH_CAPTURE_VERSION,run_id:runId,received_at:receivedAt,source_url:requestUrl,provider_date_range:{startDate,endDate},
  source_scope:'NBA_GAME_HISTORY_NOT_SPORTSBOOK_ODDS',response_sha256s:pages.map(hashResearch),raw_provider_responses:pages,
  games:[...seen.values()].map(game=>({provider_game_id:game.id,provider_date:String(game.date).slice(0,10),date_local_pr:localDay(new Date(game.datetime)),game}))};
}
