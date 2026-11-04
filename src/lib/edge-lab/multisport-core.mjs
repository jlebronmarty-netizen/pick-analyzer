import {createHash} from 'node:crypto';
import {tableTennisProjection,playerKey,mlbMean,mlbMoneyline} from './engines.mjs';
export const COHORT_MULTI='EDGE_LAB_LIVE_20261104';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const iso=x=>{const t=Date.parse(x);if(!Number.isFinite(t))throw Error('INVALID_TIMESTAMP');return new Date(t).toISOString();};
const integer=x=>x!==''&&x!==null&&x!==undefined&&Number.isInteger(Number(x))&&Number(x)>=0?Number(x):null;
const name=x=>typeof x==='string'&&x.trim()?x.trim():null;
export function normalizeTtFinal(r,receivedAt){
 if(String(r.sport??'').toLowerCase().replace(/[-\s]+/g,'_')!=='table_tennis'||String(r.league??'').toLowerCase().trim()!=='tt elite series')return {ok:false,reason:'OUT_OF_SCOPE'};
 if(r.settlement?.final===false||r.settlement?.inPlay===true)return {ok:false,reason:'EXPLICIT_NOT_FINAL'};
 const sourceId=r.eventId??r.id,a=name(r.home),b=name(r.away);if(sourceId==null||!a||!b||playerKey(a)===playerKey(b))return {ok:false,reason:'INVALID_IDENTITY'};
 let scheduledAt;try{scheduledAt=iso(r.startTime);}catch{return {ok:false,reason:'INVALID_TIME'};}
 if(Date.parse(scheduledAt)>=Date.parse(receivedAt))return {ok:false,reason:'FUTURE_FINAL'};
 const arrays=[r.statistics?.sets,r.periodScores].find(x=>Array.isArray(x?.home)&&x.home.length&&x.home.length===x.away?.length);
 if(!arrays||arrays.home.length<3||arrays.home.length>5)return {ok:false,reason:'MISSING_SETS'};
 let setsA=0,setsB=0,totalPoints=0;const scores=[];
 for(let i=0;i<arrays.home.length;i++){
  const pa=integer(arrays.home[i]),pb=integer(arrays.away[i]);if(pa===null||pb===null||setsA===3||setsB===3)return {ok:false,reason:'INVALID_SET_SEQUENCE'};
  const hi=Math.max(pa,pb),lo=Math.min(pa,pb);if(hi<11||hi-lo<2||(hi!==11&&hi-lo!==2))return {ok:false,reason:'INCOMPLETE_SET'};
  if(pa>pb)setsA++;else setsB++;totalPoints+=pa+pb;scores.push([pa,pb]);
 }
 if(Math.max(setsA,setsB)!==3||integer(r.score?.home)!==setsA||integer(r.score?.away)!==setsB)return {ok:false,reason:'SCORE_CONFLICT'};
 const content={source:'pulsescore:tipsport',sourceMatchId:String(sourceId),scheduledAt,playerA:a,playerB:b,setsA,setsB,totalPoints,setPoints:scores};
 return {ok:true,row:{...content,capturedAt:iso(receivedAt),contentDigest:digest(content)}};
}
export function normalizeTtResults(body,receivedAt){
 if(!Array.isArray(body?.results))throw Error('TT_RESULTS_SCHEMA_CHANGED');
 const rows=[],rejected={};for(const r of body.results){const n=normalizeTtFinal(r,receivedAt);if(n.ok)rows.push(n.row);else rejected[n.reason]=(rejected[n.reason]??0)+1;}
 return {rows,rejected,received:body.results.length,hasNextPage:body.pagination?.hasNextPage===true,paginationVerified:typeof body.pagination?.hasNextPage==='boolean'};
}
export function canonicalTtHistory(rows){
 const grouped=new Map();for(const r of rows){const key=r.source+':'+r.sourceMatchId;const values=grouped.get(key)??new Map();const d=r.contentDigest??digest([r.scheduledAt,r.playerA,r.playerB,r.setsA,r.setsB,r.totalPoints]);const old=values.get(d);if(!old||Date.parse(r.capturedAt)<Date.parse(old.capturedAt))values.set(d,r);grouped.set(key,values);}
 const finals=[],conflicts=[];for(const [id,versions] of grouped){if(versions.size>1)conflicts.push(id);else finals.push([...versions.values()][0]);}return {finals,conflicts};
}
function ttLines(e){
 const lines=[];for(const m of e.markets??[]){if(m.period!=='FULL_TIME'||m.suspended===true||!['OVER_UNDER','TOTAL_POINTS','TOTAL'].includes(m.canonicalMarket??m.type)||typeof m.line!=='number'||!Number.isFinite(m.line)||m.line<=0)continue;lines.push(m.line);}
 const unique=[...new Set(lines)].sort((a,b)=>a-b);return {line:unique.length===1?unique[0]:null,offeredLines:unique};
}
export function ttForecasts(body,finals,asOf,sourceId){
 const events=Array.isArray(body?.events)?body.events:Array.isArray(body?.results)?body.results:null;if(!events)throw Error('TT_PREMATCH_SCHEMA_CHANGED');
 const rows=[],skipped=[],seen=new Set();for(const e of events){
  const eventId=e.eventId??e.id,a=name(e.home),b=name(e.away);let at;try{at=iso(e.startTime);}catch{skipped.push({reason:'INVALID_TIME'});continue;}
  if(eventId==null||!a||!b||playerKey(a)===playerKey(b)){skipped.push({reason:'INVALID_IDENTITY'});continue;}
  if(seen.has(String(eventId)))throw Error('DUPLICATE_PREMATCH_ID');seen.add(String(eventId));
  if(Date.parse(at)<=Date.parse(asOf)+120000||e.inPlay===true||e.isLive===true||e.live===true||/LIVE|IN.?PLAY|FINAL|ENDED|CANCEL|POSTPON/i.test(String(e.gameStatus??'')))continue;
  if(e.league&&String(e.league).toLowerCase().trim()!=='tt elite series')continue;
  const input={playerA:a,playerB:b,scheduledAt:at,asOf};const p=tableTennisProjection(finals,input),line=ttLines(e);
  const base={cohort:COHORT_MULTI,sport:'TT',event_id:'netbet:'+String(eventId),competition:'TT Elite Series',phase:'BEST_OF_FIVE',period:'FULL_MATCH',scheduled_at:at,emitted_at:asOf,participant_a:a,participant_b:b,source_id:sourceId,payload:{input,projection:p,source_event_id:String(eventId),offered_total_lines:line.offeredLines,odds:null,sportsbook_settlement:false,scope:'STATISTICAL_RESEARCH',history_restarted:true}};
  for(const market of ['MONEYLINE','TOTAL_POINTS','SETS_ODD_EVEN']){
   let status='ABSTAIN',selection=null,probability=null,projection=null,threshold=null,reason=p.reason??'INSUFFICIENT_PLAYER_HISTORY';
   if(p.status==='FORECAST'){
    reason='MODEL_ONLY';status='FORECAST';
    if(market==='MONEYLINE'){probability=Math.max(p.probabilityA,p.probabilityB);selection=p.probabilityA>p.probabilityB?'A':'B';if(Math.abs(p.probabilityA-.5)<1e-12){status='ABSTAIN';reason='TIED_PROBABILITY';}}
    if(market==='SETS_ODD_EVEN'){probability=Math.max(p.probabilityOdd,1-p.probabilityOdd);selection=p.probabilityOdd>.5?'ODD':'EVEN';if(Math.abs(p.probabilityOdd-.5)<1e-12){status='ABSTAIN';reason='TIED_PROBABILITY';}}
    if(market==='TOTAL_POINTS'){projection=p.projectedTotal;threshold=line.line;if(threshold===null){status='PROJECTION';reason='NO_SINGLE_VERIFIED_TOTAL_LINE';}else if(Math.abs(projection-threshold)<1e-12){status='ABSTAIN';reason='PROJECTION_EQUALS_LINE';}else selection=projection>threshold?'OVER':'UNDER';}
   }
   if(status==='ABSTAIN'){selection=null;probability=null;}
   const version=market==='MONEYLINE'?'TT_ML_V1_PICK_PORT_1':market==='TOTAL_POINTS'?'TT_TOTAL_V1_PICK_PORT_1':'TT_SETS_OE_V1_PICK_PORT_1';
   rows.push({...base,id:digest([COHORT_MULTI,'TT',base.event_id,market,version]),market,model_version:version,status,selection,probability,projection,line:threshold,reason});
  }
 }
 return {rows,skipped,source_events:events.length,hasNextPage:body.pagination?.hasNextPage===true};
}
export function ttOutcome(f,finals){
 const ak=playerKey(f.participant_a),bk=playerKey(f.participant_b);
 const matches=finals.filter(r=>Math.abs(Date.parse(r.scheduledAt)-Date.parse(f.scheduled_at))<=300000&&((playerKey(r.playerA)===ak&&playerKey(r.playerB)===bk)||(playerKey(r.playerA)===bk&&playerKey(r.playerB)===ak)));
 if(!matches.length)return {status:'PENDING'};if(matches.length!==1)return {status:'DISPUTE',reason:'AMBIGUOUS_CROSS_BOOK_EVENT'};
 const r=matches[0];if(Date.parse(r.capturedAt)<=Date.parse(f.emitted_at))return {status:'DISPUTE',reason:'FINAL_ALREADY_KNOWN_AT_EMISSION'};
 let actual,won;if(f.market==='MONEYLINE'){const same=playerKey(r.playerA)===ak;actual=(r.setsA>r.setsB)===same?'A':'B';won=f.selection===actual;}
 else if(f.market==='SETS_ODD_EVEN'){actual=(r.setsA+r.setsB)%2?'ODD':'EVEN';won=f.selection===actual;}
 else if(f.market==='TOTAL_POINTS'){actual=r.totalPoints;if(f.status==='PROJECTION')return {status:'NUMERIC',actual,absolute_error:Math.abs(f.projection-actual),final:r};if(!Number.isFinite(f.line))return {status:'NOT_VERIFIABLE',reason:'NO_EXACT_LINE'};if(actual===f.line)return {status:'PUSH',actual,absolute_error:Math.abs(f.projection-actual),final:r};won=f.selection===(actual>f.line?'OVER':'UNDER');}
 else return {status:'NOT_VERIFIABLE',reason:'UNKNOWN_MARKET'};
 return {status:won?'W':'L',actual:typeof actual==='number'?actual:null,actual_label:actual,absolute_error:Number.isFinite(f.projection)&&typeof actual==='number'?Math.abs(f.projection-actual):null,final:r};
}
export function parseMlbSchedule(body){
 if(!Array.isArray(body?.dates))throw Error('MLB_SCHEDULE_SCHEMA_CHANGED');const games=body.dates.flatMap(d=>d.games??[]);if(body.totalGames!==undefined&&body.totalGames!==games.length)throw Error('MLB_SCHEDULE_COUNT_MISMATCH');
 const seen=new Set();return games.map(g=>{const h=g.teams?.home,a=g.teams?.away;if(!Number.isInteger(g.gamePk)||!h?.team?.id||!a?.team?.id||h.team.id===a.team.id||seen.has(g.gamePk))throw Error('MLB_INVALID_IDENTITY');seen.add(g.gamePk);return {id:String(g.gamePk),scheduled_at:iso(g.gameDate),gameType:g.gameType,home:{id:String(h.team.id),name:h.team.name,score:integer(h.score)},away:{id:String(a.team.id),name:a.team.name,score:integer(a.score)},state:g.status?.abstractGameState,code:g.status?.codedGameState,timeValid:g.status?.startTimeTBD===false};});
}
export function mlbForecasts(games,history,asOf,sourceId){
 const rows=[],skipped=[];for(const g of games){if(g.state!=='Preview'||!g.timeValid||Date.parse(g.scheduled_at)<=Date.parse(asOf)+600000)continue;if(g.gameType!=='R'){skipped.push({id:g.id,reason:'UNVALIDATED_PHASE',phase:g.gameType});continue;}
 const previous=history.filter(x=>x.gameType==='R'&&x.code==='F'&&x.scheduled_at.slice(0,10)<asOf.slice(0,10)&&x.home.score!==null&&x.away.score!==null);
 const stats=id=>{const own=previous.filter(x=>x.home.id===id||x.away.id===id);return {games:own.length,for:own.reduce((s,x)=>s+(x.home.id===id?x.home.score:x.away.score),0)/own.length,against:own.reduce((s,x)=>s+(x.home.id===id?x.away.score:x.home.score),0)/own.length};};
 const h=stats(g.home.id),a=stats(g.away.id);let p=null,homeMean=null,awayMean=null;if(h.games>=20&&a.games>=20){homeMean=mlbMean({teamPriorRpg:h.for,opponentPriorRa:a.against,teamPriorGames:h.games,opponentPriorGames:a.games});awayMean=mlbMean({teamPriorRpg:a.for,opponentPriorRa:h.against,teamPriorGames:a.games,opponentPriorGames:h.games});p=mlbMoneyline(homeMean,awayMean);}
 const base={cohort:COHORT_MULTI,sport:'MLB',event_id:'mlb:'+g.id,competition:'MLB',phase:'REGULAR_SEASON',period:'FULL_GAME_INCLUDING_EXTRAS',scheduled_at:g.scheduled_at,emitted_at:asOf,participant_a:g.home.name,participant_b:g.away.name,source_id:sourceId,payload:{event:g,input:{home:h,away:a},projection:{homeMean,awayMean,moneyline:p},odds:null,original_edge_gates_not_bypassed:true,research_only:true,sportsbook_settlement:false}};
 const definitions=[['MONEYLINE','PE_ML_V1_PICK_PORT_1'],['HOME_TEAM_RUNS','PE_TEAM_RUN_V1_PICK_PORT_1'],['AWAY_TEAM_RUNS','PE_TEAM_RUN_V1_PICK_PORT_1']];
 for(const [market,model_version] of definitions){const ml=market==='MONEYLINE';rows.push({...base,id:digest([COHORT_MULTI,'MLB',base.event_id,market,model_version]),model_version,market,status:!p?'ABSTAIN':ml?'FORECAST':'PROJECTION',reason:p?'RESEARCH_MODEL_ONLY':'INSUFFICIENT_PRIOR_REGULAR_GAMES',selection:p&&ml?(p.home>=p.away?'HOME':'AWAY'):null,probability:p&&ml?Math.max(p.home,p.away):null,projection:!p?null:ml?homeMean-awayMean:market==='HOME_TEAM_RUNS'?homeMean:awayMean,line:null});}
 }
 return {rows,skipped};
}
export function mlbOutcome(f,g){
 if(!g)return {status:'PENDING'};const original=f.payload.event;if(g.id!==original.id||g.home.id!==original.home.id||g.away.id!==original.away.id||g.gameType!=='R'||g.scheduled_at!==original.scheduled_at)return {status:'DISPUTE',reason:'EVENT_CONTRACT_CHANGED'};
 if(g.code!=='F')return {status:'PENDING'};if(g.home.score===null||g.away.score===null||g.home.score===g.away.score)return {status:'NOT_VERIFIABLE',reason:'NON_DECISIVE_FINAL'};
 if(f.market==='MONEYLINE')return {status:f.selection===(g.home.score>g.away.score?'HOME':'AWAY')?'W':'L',final:g};
 const actual=f.market==='HOME_TEAM_RUNS'?g.home.score:g.away.score;return {status:'NUMERIC',actual,absolute_error:Math.abs(f.projection-actual),final:g};
}
export function multiMetrics(rows){
 const groups=new Map();for(const r of rows){const key=[r.sport,r.market,r.model_version,r.phase].join('|');const g=groups.get(key)??{sport:r.sport,market:r.market,model_version:r.model_version,phase:r.phase,wins:0,losses:0,push:0,pending:0,abstentions:0,disputes:0,not_verifiable:0,numeric:0,absolute_error_sum:0,absolute_error_count:0};const s=r.outcome?.status;
 if(r.status==='ABSTAIN')g.abstentions++;else if(!s)g.pending++;else if(s==='W')g.wins++;else if(s==='L')g.losses++;else if(s==='PUSH')g.push++;else if(s==='DISPUTE')g.disputes++;else if(s==='NOT_VERIFIABLE')g.not_verifiable++;else if(s==='NUMERIC')g.numeric++;
 if(r.status!=='ABSTAIN'&&Number.isFinite(r.outcome?.absolute_error)){g.absolute_error_sum+=r.outcome.absolute_error;g.absolute_error_count++;}groups.set(key,g);}
 return [...groups.values()].map(g=>({...g,evaluable:g.wins+g.losses,accuracy:g.wins+g.losses?g.wins/(g.wins+g.losses):null,mae:g.absolute_error_count?g.absolute_error_sum/g.absolute_error_count:null}));
}
