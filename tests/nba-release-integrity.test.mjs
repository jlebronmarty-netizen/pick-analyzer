import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readMarketBatches} from '../src/lib/nba/decision-market-snapshot.mjs';
import {marketQuality} from '../src/lib/nba/decision-integrity.mjs';
import {concordantPlayerFinal,pendingOvertimeDispute,latestArchivedFinal} from '../src/lib/nba/decision-learning-core.mjs';
import {boardResponse} from '../src/lib/nba/decision-board-response.mjs';
import {gameMetrics} from '../src/lib/data-quality/game-metrics.mjs';
import {matchHoopsCapture} from '../src/lib/nba/decision-board-core.mjs';

import {auditWindow} from '../src/lib/data-quality/window.mjs';
import {indexEvidence,teamWindow} from '../src/lib/nba/decision-integrity.mjs';
import {reconciledPeriods} from '../src/lib/nba/decision-archived-final-core.mjs';
import {inputs,target} from './fixtures/nba-shead-inputs.mjs';

const at='2026-11-20T23:35:00Z',received='2026-11-20T23:30:00Z';
const game={id:21718150,season:2026,datetime:'2026-11-21T00:30:00Z',status_state:'scheduled',
  home_team:{id:28,full_name:'Toronto Raptors'},visitor_team:{id:9,full_name:'Detroit Pistons'}};
const hash=n=>n.toString(16).padStart(64,'0');
function receipt(quotes,extra={}){
  return {provider_game_id:game.id,game,phase:'PREGAME',payload_phase:'PREGAME',snapshot_id:hash(42),
    payload_snapshot_id:hash(42),provider:'BALLDONTLIE',book:'FanDuel',namespace:'balldontlie',
    status:'DATA_RETRIEVED',source_received_at:received,payload_received_at:received,recorded_at:at,
    quotes,quote_count:quotes.length,payload_count:quotes.length,...extra};
}
const main={game_id:game.id,provider:'BALLDONTLIE',sportsbook:'FanDuel',market:'spread',period:'FULL_GAME_INCLUDING_OT',
  quote_id:hash(1),side:'home',line:-1.5,american_odds:-110,provider_updated_at:received,
  contract:'SIGNED_HANDICAP',overtime_rule:'INCLUDES_OVERTIME'};
const e={asOf:at,games:[{game}],pregame:null},history=[{status:'VALIDATED',included:[{teamId:28}]}];
test('a main quote inherits a proven envelope receipt, not an optional lineup; a true clock discrepancy blocks it',()=>{
 const {quotes,reason}=readMarketBatches([receipt([main])],game,'main',at);
 assert.equal(reason,null);const quality=marketQuality(quotes[0],game,e,history);
 assert.equal(quality.status,'VALIDATED');assert.deepEqual(quality.warnings,['TEAM_AVAILABILITY_UNCONFIRMED']);
 assert.ok(quality.expiresAt);assert.equal(quality.regionalExecutionVerified,false);
 const later={...main,source_received_at:'2026-11-20T23:34Z'};
 assert.equal(readMarketBatches([receipt([later])],game,'main',at).quotes.length,0);
 assert.equal(readMarketBatches([receipt([main],{recorded_at:'2026-11-21T01:00Z'})],game,'main',at).quotes.length,0);
 assert.equal(readMarketBatches([receipt([main],{phase:'IN_PLAY'})],game,'main',at).quotes.length,0);
});
test('an empty latest prop menu is definitive; multiple batches retain valid rows past 1000 and quarantine gaps',()=>{
 const proto={...main,player_id:4,market:'props',statistic:'assists',line:4.5,side:'over',contract:'STRICT_GREATER_THAN'};
 const props=Array.from({length:1100},(_,i)=>({...proto,quote_id:hash(i+5)}));
 const meta={capture_id:'capture',response_hash:hash(9),complete:true,batch_count:2,normalized_count:props.length};
 const rows=[receipt(props.slice(0,1000),{...meta,batch_index:0}),receipt(props.slice(1000),{...meta,batch_index:1,snapshot_id:hash(43),payload_snapshot_id:hash(43)})];
 assert.equal(readMarketBatches(rows,game,'props',at).quotes.length,1100);
 assert.deepEqual(readMarketBatches([receipt([],{...meta,normalized_count:0,batch_count:1,batch_index:0})],game,'props',at),{quotes:[],reason:null});
 for(const bad of [[rows[0]],[rows[0],rows[0]],[rows[0],{...rows[1],capture_id:'other'}],
   [rows[0],{...rows[1],quotes:[...rows[1].quotes.slice(1),props[0]]}]]){
   assert.deepEqual(readMarketBatches(bad,game,'props',at).quotes,[]);
 }
});
test('explicit available reserve is research-eligible; missing, conflicting or wrong-team availability remains blocked',()=>{
 const q={...main,market:'props',player_id:7,statistic:'assists',side:'over',contract:'STRICT_GREATER_THAN',line:4.5};
 const price=readMarketBatches([receipt([q])],game,'main',at);assert.equal(price.quotes.length,0);
 const prop={...q,phase:'PREGAME',provider_game_id:game.id,source_received_at:received,envelopeReceivedAt:received,payload:q};
 const p={captured_at:received,game_ids:[game.id],coverage:{injuriesComplete:true,projectedLineupsComplete:false},
   projected_lineups:{data:[]},injuries:{data:[{player:{id:7,team_id:28},status:'Available'}]}};
 const state=()=>marketQuality(prop,game,{...e,pregame:[{game_ids:[888]},p]},history);
 assert.equal(state().status,'VALIDATED');assert.ok(state().warnings.includes('AVAILABLE_STARTING_ROLE_UNCONFIRMED'));
 p.injuries.data[0].status='Questionable';assert.notEqual(state().status,'VALIDATED');
 p.injuries.data[0].status='Available';p.injuries.data[0].player.team_id=9;assert.notEqual(state().status,'VALIDATED');
 p.injuries.data=[];assert.notEqual(state().status,'VALIDATED');
});
test('SHADOW quarantines material OT uncertainty and reconciles only required player components',()=>{
 const g={period:5,home_ot1:13,visitor_ot1:10};
 assert.equal(pendingOvertimeDispute({period:'q2'},g),false);
 assert.equal(pendingOvertimeDispute({period:'h2'},g),true);
 assert.equal(pendingOvertimeDispute({period:'ft',evidence:{quality:{overtimeRule:'INCLUDES_OVERTIME'}}},g),false);
 assert.equal(concordantPlayerFinal('rebounds',null,{reb:null}),null);
 assert.deepEqual(concordantPlayerFinal('points',null,{pts:20,reb:null}),{pts:20,reb:null});
});
test('an ambiguous Hoops association invalidates both target games',()=>{
 const g={...game,id:19};
 const h={home_team:'Toronto Raptors',away_team:'Detroit Pistons',start_timezone_verified:true,start_time:game.datetime,provider_game_id:'h'};
 const result=matchHoopsCapture([game,g],{games:[h]});
 assert.equal(result.mapped.size,0);assert.equal(result.unmatched.length,2);
});
test('ten related wins and one separate loss give each game one vote',()=>{
 const rows=[...Array.from({length:10},()=>({gameId:1,result:'win',error:3})),{gameId:2,result:'loss',error:9}];
 assert.deepEqual(gameMetrics(rows),{uniqueGames:2,decisionGames:2,errorGames:2,hitRate:50,mae:6});
});
test('large authenticated JSON streams round trip, including unicode and gzip negotiation',async()=>{
 const obj={rows:Array(35000).fill('Dončić 🏀 '.repeat(14))};
 for(const encoding of ['gzip','gzip;q=0, br','']){
  const reply=boardResponse(obj,encoding),bytes=Buffer.from(await reply.arrayBuffer());
  assert.equal(reply.headers.get('cache-control'),'private, no-store');
  assert.equal(reply.headers.get('content-encoding'),encoding==='gzip'?'gzip':null);
  assert.deepEqual(JSON.parse((encoding==='gzip'?gunzipSync(bytes):bytes).toString('utf8')),obj);
 }
});


test('duplicate crossing the tenth position is not an accepted ten-game window',()=>{
 const events=Array.from({length:11},(_,i)=>({id:Math.min(i,9)}));
 const result=auditWindow(events,()=>({include:{}}),at);
 assert.equal(result.status,'DUPLICATE_DATA');assert.equal(result.included.length,9);
});
test('team-scoped disagreements and days older than a complete L10 do not block unrelated windows',()=>{
 const x=inputs(),e=indexEvidence(x);
 const ids=new Set(e.games.map(x=>x.game.id));
 e.calendarIssues=['CALENDAR_DISAGREEMENT_555','INVALID_CALENDAR_2025-01-01'];
 e.calendarScope={'CALENDAR_DISAGREEMENT_555':[7,10]};
 assert.equal(teamWindow(e,target,28,ids).status,'VALIDATED');
 e.calendarScope.CALENDAR_DISAGREEMENT_555=[28,7];
 assert.equal(teamWindow(e,target,28,ids).status,'SOURCE_UNAVAILABLE');
});
test('wrong side or period cannot promote a full-game quote; a played OT needs two reconciled scores',()=>{
 const raw={...main,period:'q1',side:'over'};
 const quote=readMarketBatches([receipt([raw])],game,'main',at).quotes[0];
 assert.equal(marketQuality(quote,game,e,history).status,'CONTRACT_UNVERIFIED');
 const g={home_q1:25,home_q2:25,home_q3:25,home_q4:25,visitor_q1:25,visitor_q2:25,visitor_q3:25,visitor_q4:25,
   home_team_score:105,visitor_team_score:100,period:5,home_ot1:5,visitor_ot1:0};
 assert.equal(reconciledPeriods(g).ao,0);
 assert.equal(reconciledPeriods({...g,visitor_ot1:null}),null);
 assert.equal(reconciledPeriods({...g,period:4}),null);
 assert.equal(reconciledPeriods({...g,home_q4:24,home_team_score:104}),null);
});

test('a newer withdrawn final cannot silently reuse an older receipt',()=>{
 const meta={snapshot_id:hash(1),contract_version:'NBA_MARKET_DATA_V1',provider:'BALLDONTLIE',sportsbook:'FanDuel',
   id_namespace:'balldontlie',date_local:'2026-11-20',status:'SCHEDULE_RETRIEVED',source_received_at:received};
 const raw={id:87,date:'2026-11-20',datetime:'2026-11-20T19:00:00Z',status_state:'final',
   season:2026,home_team:{id:7,abbreviation:'DAL'},visitor_team:{id:10,abbreviation:'GSW'}};
 const receipt={source_received_at:received,snapshot_id:meta.snapshot_id,payload:{meta,data:{games:[raw]}}};
 assert.equal(latestArchivedFinal([receipt],87,meta.date_local,at)?.game.id,87);
 const newer={source_received_at:at,snapshot_id:hash(2),payload:{meta:{...meta,snapshot_id:hash(2),source_received_at:at},data:{games:[]}}};
 assert.equal(latestArchivedFinal([newer,receipt],87,meta.date_local,at),null);
 assert.equal(latestArchivedFinal([receipt,receipt],87,meta.date_local,at),null);
});
