import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNbaDecisionBoard,buildPlayerProjection,matchHoopsCapture,projectedPeriod} from '../src/lib/nba/decision-board-core.mjs';

const TODAY='2026-11-19',START='2026-11-20T01:00:00Z',ASOF='2026-11-19T19:00:00Z';
const g={id:123,date:TODAY,datetime:START,status_state:'scheduled',
 home_team:{id:10,full_name:'Memphis Grizzlies'},visitor_team:{id:2,full_name:'Golden State Warriors'}};
function history(){
 const arr=[];for(let n=1;n<=8;n++){const d='2026-11-'+String(n).padStart(2,'0');
  arr.push({game:{id:1000+n,date:d,datetime:d+'T21:00:00Z',status_state:'final',
   home_team:{id:10},visitor_team:{id:2},home_q1:30,home_q2:26,home_q3:29,home_q4:25,
   visitor_q1:26,visitor_q2:25,visitor_q3:23,visitor_q4:27,
   home_team_score:110,visitor_team_score:101}});
 }
 return arr;
}
const prices=[
 {provider_game_id:123,quote_id:'ml',market:'moneyline',side:'home',line:null,american_odds:-200,source_received_at:ASOF},
 {provider_game_id:123,quote_id:'sp',market:'spread',side:'home',line:-6.5,american_odds:-110,source_received_at:ASOF},
 {provider_game_id:123,quote_id:'total',market:'total',side:'under',line:222.5,american_odds:-106,source_received_at:ASOF}
];
const q={provider_game_id:123,quote_id:'prop',player_id:40,market:'props',statistic:'rebounds',period:'FULL_GAME_LABEL_OT_UNVERIFIED',side:'over',line:7.5,contract:'STRICT_GREATER_THAN',american_odds:-110,source_received_at:ASOF};
function playerRows(){return Array.from({length:8},(_,i)=>({provider_game_id:1001+i,player_id:40,team_id:10,game_datetime:'2026-11-'+String(i+1).padStart(2,'0')+'T21:00:00Z',source_captured_at:'2026-11-15T00:00:00Z',minutes_played:30,pts:13,reb:9,ast:4,fg3m:2}));}
const hoop={normalized:{captured_at:ASOF,games:[{provider_game_id:'hoop001',home_team:'Memphis Grizzlies',away_team:'Golden State Warriors',start_time:'2026-11-20T01:10:00Z',start_timezone_verified:true}],
 quotes:[{provider_game_id:'hoop001',quote_id:'h1total',market:'total',period:'h1',side:'over',line:106.5,american_odds_approx:-110,source_received_at:ASOF},
 {provider_game_id:'hoop001',quote_id:'q1home',market:'spread',period:'q1',side:'home',line:-2.5,american_odds_approx:-110,source_received_at:ASOF}]}};
test('all six tabs have rows, prices and never claim calibration',()=>{
 const report=buildNbaDecisionBoard({scheduleGames:[g],historyFinals:history(),goatMainQuotes:prices,
  goatPropQuotes:[q],playerHistory:playerRows(),playerNames:{40:'Verified Player'},hoopsCapture:hoop,asOf:ASOF});
 assert.equal(report.summary.games,1);
 assert.equal(report.summary.matchedHoopsGames,1);
 assert.equal(report.rows.ml.length,1);
 assert.equal(report.rows.spread.length,1);
 assert.equal(report.rows.total.length,1);
 assert.equal(report.rows.props.length,1);
 assert.equal(report.rows.periods.length,2);
 const prop=report.rows.props[0];
 assert.equal(prop.playerName,'Verified Player');assert.equal(prop.l5,9);assert.equal(prop.hit10,8);
 for(const a of Object.values(report.rows))for(const row of a){
  assert.equal(row.probability,null);assert.equal(row.expectedValue,null);
  assert.notEqual(row.classification,'PICK');assert.equal(row.regionVerified,false);
 }
 assert.equal(report.summary.providerCalls,0);
 assert.equal(report.summary.dbWrites,0);
});
test('past scores only: change or add future finals and current projections remain identical',()=>{
 const h=history();
 const before=buildNbaDecisionBoard({scheduleGames:[g],historyFinals:h,goatMainQuotes:prices,asOf:ASOF})
   .rows.total[0].projection;
 const future={...h[0].game,id:9000,date:'2026-11-21',datetime:'2026-11-22T01:00:00Z',
  home_q1:40,home_team_score:120};
 const after=buildNbaDecisionBoard({scheduleGames:[g],historyFinals:[...h,{game:future}],
  goatMainQuotes:prices,asOf:ASOF}).rows.total[0].projection;
 assert.equal(before,after);
 assert.notEqual(before,null);
});
test('HoopsAPI provider IDs require exact teams and start within 30m and unique crosswalk',()=>{
 const source={normalized:{games:[{provider_game_id:'x',home_team:'Memphis Grizzlies',away_team:'Golden State Warriors',
  start_time:'2026-11-20T01:10:00Z',start_timezone_verified:true}]}};
 assert.equal(matchHoopsCapture([g],source.normalized).mapped.size,1);
 assert.equal(matchHoopsCapture([g],{games:[{...source.normalized.games[0],away_team:'Los Angeles Lakers'}]}).mapped.size,0);
 assert.equal(matchHoopsCapture([g],{games:[{...source.normalized.games[0],start_time:'2026-11-20T04:00:00Z'}]}).mapped.size,0);
 const amb={games:[source.normalized.games[0],{...source.normalized.games[0],provider_game_id:'y'}]};
 assert.equal(matchHoopsCapture([g],amb).mapped.size,0);
});
test('player projection requires exact Over/Under contract and prior captured history',()=>{
 const actual=buildPlayerProjection(q,playerRows(),Date.parse(START),Date.parse(ASOF));
 assert.equal(actual.ready,true);assert.equal(actual.l5,9);assert.equal(actual.hit5,5);assert.equal(actual.hit10,8);
 assert.equal(buildPlayerProjection({...q,period:'Q1'},playerRows(),Date.parse(START),Date.parse(ASOF)).reason,'UNSUPPORTED_PROP_CONTRACT');
 assert.equal(buildPlayerProjection({...q,contract:'PROVIDER_MILESTONE_UNVERIFIED'},playerRows(),Date.parse(START),Date.parse(ASOF)).ready,false);
 assert.equal(buildPlayerProjection(q,playerRows().map(x=>({...x,source_captured_at:'2026-11-22T00:00:00Z'})),Date.parse(START),Date.parse(ASOF)).ready,false);
});
test('empty schedules and insufficient history fail to no-data without fabricated picks',()=>{
 const no=buildNbaDecisionBoard({scheduleGames:[],historyFinals:[],goatMainQuotes:prices,asOf:ASOF});
 assert.equal(no.summary.games,0);assert.equal(no.top25.length,0);
 const insufficient=buildNbaDecisionBoard({scheduleGames:[g],historyFinals:history().slice(0,4),
  goatMainQuotes:prices,asOf:ASOF});
 assert.equal(insufficient.rows.total[0].projection,null);
 assert.equal(insufficient.top25.length,0);
});
