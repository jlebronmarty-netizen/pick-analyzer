import test from 'node:test';
import assert from 'node:assert/strict';
import {planNbaShadowFreeze,balanceFrozenForecasts,NBA_SHADOW_FREEZE_MAX_PER_RUN,settleNbaShadowForecast,summarizeShadowLearning}
  from '../src/lib/nba/decision-learning-core.mjs';
import {checkNbaDecisionCronRequest} from '../src/lib/nba/decision-cron-auth.mjs';

const captureTime='2026-11-19T19:15:00Z',asOf='2026-11-19T19:25:00Z';
const tip='2026-11-20T01:00:00Z',date='2026-11-19';
const main={dataQuality:{status:'VALIDATED',issues:[]},gameId:21718143,matchup:'Golden State Warriors @ Memphis Grizzlies',market:'total',period:'ft',
 selection:'Over',line:220.5,odds:-110,projection:225.6,advantage:5.1,
 quoteId:'valid-quote-total-0001',capturedAt:captureTime,quoteFreshness:'RECENT',
 source:'GOAT',sample:8,l5:226,l10:221};
const prop={...main,market:'props',label:'Player A · rebounds OVER',line:7.5,projection:9.1,advantage:1.6,
 playerId:99,playerName:'Player A',statistic:'rebounds',quoteId:'valid-quote-prop-0001',l5:9,l10:9.2};
const ml={...main,market:'moneyline',selection:'Memphis Grizzlies',line:null,projection:6.5,
 advantage:null,quoteId:'valid-quote-ml-0001'};
const board={version:'NBA_DECISION_BOARD_SHADOW_V1',day:date,asOf,
 games:[{id:21718143,home:'Memphis Grizzlies',away:'Golden State Warriors',startsAt:tip}],
 rows:{ml:[ml],spread:[],total:[main],props:[prop],periods:[]}};
const final={
 id:21718143,date,datetime:tip,status_state:'final',
 home_q1:27,home_q2:33,home_q3:27,home_q4:31,
 visitor_q1:24,visitor_q2:29,visitor_q3:22,visitor_q4:26,
 home_team_score:118,visitor_team_score:101
};
test('freezes research candidates only before game with exact quote evidence and deterministic dedupe',()=>{
 const first=planNbaShadowFreeze(board,asOf);
 assert.equal(first.status,'SHADOW_PREVIEW_FREEZE_PLAN');
 assert.equal(first.rows.length,3);
 assert.deepEqual(first,planNbaShadowFreeze(board,asOf));
 assert.equal(new Set(first.rows.map(x=>x.forecast_id)).size,3);
 assert.equal(first.rows.every(x=>x.projection!==null&&x.evidence.regional_price_verified===false),true);
 assert.equal(first.provider_calls,0);assert.equal(first.official_model_writes,0);
 assert.equal(planNbaShadowFreeze(board,'2026-11-20T00:51:00Z').rows.length,0);
});
test('invalid, stale, misleading, market-unsupported data fails closed',()=>{
 const changed={...board,rows:{ml:[],spread:[],total:[
  {...main,quoteFreshness:'STALE_OR_FUTURE'},
  {...main,projection:null},
  {...main,advantage:-5},
  {...main,quoteId:null},
  {...main,odds:1},
 ],props:[],periods:[]}};
 const res=planNbaShadowFreeze(changed,asOf);
 assert.equal(res.rows.length,0);
});
test('verified final scores settle full-game totals, spread, ML and Q1, H2+OT deterministically',()=>{
 const basic=planNbaShadowFreeze(board,asOf).rows;
 const total=basic.find(x=>x.market==='total'),mlrow=basic.find(x=>x.market==='moneyline');
 const scored=settleNbaShadowForecast(total,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'});
 assert.equal(scored.actual,219);
 assert.equal(scored.statistical_result,'loss');
 assert.equal(scored.absolute_error,6.6);
 assert.equal(settleNbaShadowForecast(mlrow,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'}).statistical_result,'win');
 const q1={...total,period:'q1',line:50,projection:56,side:'over'};
 assert.equal(settleNbaShadowForecast(q1,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'}).actual,51);
 const extra={...final,home_ot1:8,visitor_ot1:6,home_team_score:126,visitor_team_score:107};
 const h2={...total,period:'h2',line:103.5,projection:110,side:'over'};
 assert.equal(settleNbaShadowForecast(h2,{game:extra,sourceReceivedAt:'2026-11-20T05:00:00Z'}).actual,120);
 const spread={...total,market:'spread',side:'home',line:-16.5,projection:17};
 assert.equal(settleNbaShadowForecast(spread,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'}).statistical_result,'win');
});
test('player stats must be exact id + game and captured after start',()=>{
 const p=planNbaShadowFreeze(board,asOf).rows.find(x=>x.market==='props');
 assert.equal(settleNbaShadowForecast(p,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'}),null);
 assert.equal(settleNbaShadowForecast(p,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z',
  playerStat:{player_id:99,provider_game_id:21718143,minutes_played:1,reb:8},
  playerStatReceivedAt:'2026-11-20T06:00:00Z'}).statistical_result,'win');
 assert.equal(settleNbaShadowForecast(p,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z',
  playerStat:{player_id:200,provider_game_id:21718143,minutes_played:1,reb:8},
  playerStatReceivedAt:'2026-11-20T06:00:00Z'}),null);
 assert.equal(settleNbaShadowForecast(p,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z',
  playerStat:{player_id:99,provider_game_id:21718143,minutes_played:1,reb:8},
  playerStatReceivedAt:'2026-11-19T18:00:00Z'}),null);
});
test('compact zero boxscores require positive playing time for either side',()=>{
 const prop=planNbaShadowFreeze(board,asOf).rows.find(row=>row.market==='props');
 for(const side of ['under','over']){
  const settle=minutes=>settleNbaShadowForecast({...prop,side},{
   game:final,sourceReceivedAt:'2026-11-20T05:00:00Z',
   playerStat:{player_id:99,provider_game_id:21718143,minutes_played:minutes,reb:0},
   playerStatReceivedAt:'2026-11-20T06:00:00Z'});
  for(const minutes of [0,null,undefined,-1,false,'0',NaN,Infinity])assert.equal(settle(minutes),null);
  assert.equal(settle(0.017).statistical_result,side==='under'?'win':'loss');
 }
});
test('accuracy summaries expose independent game count, no auto promotion and sample guard',()=>{
 const frozen=planNbaShadowFreeze(board,asOf).rows;
 const settled=frozen.filter(f=>f.market!=='props').map(f=>settleNbaShadowForecast(f,{game:final,sourceReceivedAt:'2026-11-20T05:00:00Z'}));
 const report=summarizeShadowLearning(frozen,settled);
 assert.equal(report.length,2);
 for(const r of report) {
  assert.equal(r.uniqueGames,1);assert.equal(r.automaticPromotion,false);
  assert.equal(r.hitRate,null);assert.equal(r.status,'INSUFFICIENT_INDEPENDENT_GAMES');
 }
});

test('Cron Authorization and time windows fail closed without invoking services',()=>{
 const args={secret:'valid-cron-secret',authorization:'Bearer valid-cron-secret',
  environment:'production',enabled:'true',search:'',mode:'freeze'};
 assert.equal(checkNbaDecisionCronRequest({...args,authorization:null,now:'2026-11-19T23:35:00Z'}).http,401);
 assert.equal(checkNbaDecisionCronRequest({...args,environment:'preview',now:'2026-11-19T23:35:00Z'}).status,'PRODUCTION_ONLY');
 assert.equal(checkNbaDecisionCronRequest({...args,enabled:'false',now:'2026-11-19T23:35:00Z'}).status,'SHADOW_DISABLED');
 assert.equal(checkNbaDecisionCronRequest({...args,now:'2026-11-19T23:35:00Z',search:'?x=1'}).status,'NO_PARAMETERS_ALLOWED');
 assert.equal(checkNbaDecisionCronRequest({...args,now:'2026-11-19T23:35:00Z'}).status,'RUN_ALLOWED');
 assert.equal(checkNbaDecisionCronRequest({...args,mode:'settle',now:'2026-11-19T12:15:00Z'}).status,'RUN_ALLOWED');
 assert.equal(checkNbaDecisionCronRequest({...args,now:'2026-11-19T20:15:00Z'}).status,'OUTSIDE_SCHEDULE_WINDOW');
});

test('immutable challenger hypotheses exist only where comparable targets are available',()=>{
 const frozen=planNbaShadowFreeze(board,asOf);
 assert.equal(frozen.eligible_before_cap,3);
 assert.equal(frozen.cap,240);
 const p=frozen.rows.find(x=>x.market==='props');
 assert.deepEqual(p.evidence.challenger_projections,[
  {id:'NBA_PROP_BALANCED_50_50_V1',projection:9.1},
  {id:'NBA_PROP_STABLE_35_65_V1',projection:9.13}
 ]);
 const t=frozen.rows.find(x=>x.market==='total');
 assert.equal(t.evidence.challenger_projections.length,2);
 assert.equal(t.evidence.challenger_projections[0].id,'NBA_TOTAL_TREND_PLUS10_V1');
 assert.equal(frozen.rows.find(x=>x.market==='moneyline').evidence.challenger_projections.length,0);
 assert.ok(t.evidence.challenger_projections.every(x=>Number.isFinite(x.projection)));
});
test('fair freeze sampler caps 240 entries and balances 6 games, market groups and stat categories',()=>{
 const rows=[];
 for(let game=0;game<6;game++){
  for(let i=0;i<250;i++){
   const market=i%4===0?'total':'props';
   rows.push({forecast_id:String(game).padStart(2,'0')+'-'+String(i).padStart(4,'0'),
    game_id:12345+game,market,period:market==='total'?'q'+(i%4+1):'ft',
    statistic:market==='props'?['points','rebounds','assists','threes'][i%4]:null,
    historical_n:10-i%5,evidence:{estimated_gap:(i%13)/4}});
  }
 }
 const sample=balanceFrozenForecasts(rows);
 assert.equal(NBA_SHADOW_FREEZE_MAX_PER_RUN,240);
 assert.equal(sample.length,240);
 assert.equal(new Set(sample.map(x=>x.forecast_id)).size,240);
 for(let game=0;game<6;game++)assert.equal(sample.filter(x=>x.game_id===12345+game).length,40);
 assert.ok(sample.some(x=>x.market==='props'));
 assert.ok(sample.some(x=>x.market==='total'));
 assert.deepEqual(sample,balanceFrozenForecasts(rows));
 assert.throws(()=>balanceFrozenForecasts(rows,500),/INVALID_FREEZE_CAP/);
});
