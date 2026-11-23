import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectNhlExactCircaAsOf,nhlExactMarketProxy,gradeNhlExactCircaCohort}
 from '../src/lib/nhl-exact-circa-market-research.mjs';

const id='nhl:2026020350',start='2026-11-20T01:00:00Z',at='2026-11-19T22:03:00Z';
const frozen={
 id:'NHL_SCORES_POISSON_SHADOW_V1:'+id,event_id:id,scheduled_at:start,
 frozen_at:'2026-11-19T22:05:00Z',source_completed_at:'2026-11-19T22:02:10Z',
 home_team_id:5,away_team_id:19,home_team:'Pittsburgh Penguins',
 away_team:'St. Louis Blues',projection:{homeGoals:3.1,awayGoals:2.8},
 official_pick:false,production_eligible:false
};
function quote(market='total',opts={}){
 const q=market==='total'?{
  market:'total',book:'CIRCA',sourceUpdatedAt:null,readyForOfficialPicks:false,
  fullGameContractCertified:false,
  over:{side:'Over',line:6,price:-110},under:{side:'Under',line:6,price:-110}
 }:{
  market:'spread',book:'CIRCA',sourceUpdatedAt:null,readyForOfficialPicks:false,
  fullGameContractCertified:false,
  home:{name:frozen.home_team,line:-1.5,price:175},
  away:{name:frozen.away_team,line:1.5,price:-205}
 };
 return {eventId:id,market,book:'CIRCA',home:frozen.home_team,away:frozen.away_team,
  homeId:5,awayId:19,scheduledAt:start,capturedAt:at,sourceId:'source-1',
  marketRulesCertified:false,officialPick:false,quote:{...q,...opts.quote},
  ...Object.fromEntries(Object.entries(opts).filter(([k])=>k!=='quote'))};
}
const result=(h,a)=>({event_id:id,observed_at:'2026-11-20T04:00:00Z',
 body:{eventId:id,scheduledAt:start,homeId:5,awayId:19,homeScore:h,awayScore:a}});
test('valid Circa two-sided exact lines produce point/cover and push probabilities, never EV',()=>{
 const spread=selectNhlExactCircaAsOf({frozen,observations:[quote('spread')],market:'spread'});
 const total=selectNhlExactCircaAsOf({frozen,observations:[quote('total')],market:'total'});
 assert.equal(spread.status,'VALID_CIRCA_RESEARCH_QUOTE');
 assert.equal(total.status,'VALID_CIRCA_RESEARCH_QUOTE');
 assert.equal(spread.line,-1.5);assert.equal(total.line,6);
 assert.equal(spread.noVigFirst>0,true);
 const a=nhlExactMarketProxy({frozen,quote:spread});
 const b=nhlExactMarketProxy({frozen,quote:total});
 assert.equal(a.status,'UNVALIDATED_EXACT_LINE_PROXY');
 assert.equal(b.status,'UNVALIDATED_EXACT_LINE_PROXY');
 assert.equal(a.modelPushProbability,0);
 assert.ok(b.modelPushProbability>0);
 assert.ok(b.modelFirstConditional>0 && b.modelFirstConditional<1);
 assert.equal(b.expectedValue,null);
 assert.equal(b.marketRulesCertified,false);
 assert.equal(b.OTSOModelCertified,false);
});
test('integer total 6 push is NOT scored as a win or loss',()=>{
 const g=gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[quote('spread'),quote('total')],finalRows:[result(4,2)]});
 assert.equal(g.settledDistinctGames,1);
 assert.equal(g.markets.spread.pricedEvents,1);
 assert.equal(g.markets.spread.graded,1);
 assert.equal(g.markets.spread.modelHits>=0,true);
 assert.equal(g.markets.total.pricedEvents,1);
 assert.equal(g.markets.total.pushes,1);
 assert.equal(g.markets.total.graded,0);
 assert.equal(g.markets.total.modelBrier,null);
 assert.equal(g.noBookmakerROIClaim,true);
});
test('total 6 and spread -1.5 are both scored using exact frozen home/away final',()=>{
 const g=gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[quote('spread'),quote('total')],finalRows:[result(4,3)]});
 assert.equal(g.markets.total.graded,1);
 assert.equal(g.markets.spread.graded,1);
 assert.equal(g.markets.total.pushes,0);
 for(const m of ['spread','total']){
  assert.ok(g.markets[m].modelBrier>=0 && g.markets[m].modelBrier<=1);
  assert.ok(g.markets[m].circaNoVigBrier>=0 && g.markets[m].circaNoVigBrier<=1);
 }
});
test('quote after the frozen decision is strictly rejected even if pregame',()=>{
 const late=quote('spread',{capturedAt:'2026-11-19T22:06:00Z'});
 assert.equal(selectNhlExactCircaAsOf({frozen,observations:[late],market:'spread'}).status,'NOT_READY');
 assert.equal(gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[late],finalRows:[result(4,2)]}).markets.spread.pricedEvents,0);
});
test('wrong team/line/market/conflicting quote timestamp fail closed',()=>{
 for(const bad of [
  quote('spread',{awayId:29}),
  quote('spread',{quote:{home:{name:frozen.home_team,line:-1.5,price:175},
   away:{name:frozen.away_team,line:1.5,price:99}}}),
  quote('total',{quote:{over:{side:'Over',line:6,price:-110},
   under:{side:'Under',line:6.5,price:-110}}}),
  quote('spread',{marketRulesCertified:true}),
  quote('spread',{quote:{home:{name:'Another Team',line:-1.5,price:175},
   away:{name:frozen.away_team,line:1.5,price:-205}}})
 ]) assert.equal(selectNhlExactCircaAsOf({frozen,observations:[bad],market:bad.market}).status,'NOT_READY');
 const double=[quote('total'),quote('total',{quote:{
  over:{side:'Over',line:6.5,price:-110},under:{side:'Under',line:6.5,price:-110}}})];
 const uncertain=selectNhlExactCircaAsOf({frozen,observations:double,market:'total'});
 assert.equal(uncertain.reason,'CONTRADICTORY_SAME_TIME_QUOTES');
});
test('different frozen event IDs and missing actual finals cannot be graded',()=>{
 const other={...frozen,event_id:'nhl:2026020351'};
 const g=gradeNhlExactCircaCohort({frozenRows:[other],observations:[quote('total')],
  finalRows:[result(4,3)]});
 assert.equal(g.settledDistinctGames,0);assert.equal(g.markets.total.pricedEvents,0);
 const absent=gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[quote('total')],finalRows:[]});
 assert.equal(absent.markets.total.pricedEvents,1);
 assert.equal(absent.markets.total.graded,0);
});
test('conflicting historical outcomes or identities never generate apparent accuracy',()=>{
 const dup=gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[quote('total')],finalRows:[result(4,2),result(2,4)]});
 assert.equal(dup.settledDistinctGames,0);
 assert.equal(dup.markets.total.graded,0);
 const bad=gradeNhlExactCircaCohort({frozenRows:[frozen],
  observations:[quote('spread')],finalRows:[{...result(4,2),
   body:{...result(4,2).body,awayId:3}}]});
 assert.equal(bad.invalidResults,1);assert.equal(bad.markets.spread.graded,0);
});
test('new exact research endpoint only reads archived sources; V6 retains team names as of freeze',()=>{
 const route=fs.readFileSync('src/app/api/nhl/exact-circa-market-research/route.ts','utf8');
 const svc=fs.readFileSync('src/services/nhl-exact-circa-market-research.service.ts','utf8');
 const v6=fs.readFileSync('src/lib/nhl-late-v6-core.mjs','utf8');
 assert.match(svc,/nhl_free_runs_v1/);assert.match(svc,/marketQuotes:detail->marketQuoteObservations/);
 assert.match(svc,/nhl_challenger_shadow_v1/);assert.match(svc,/nhl_late_shadow_v6/);
 assert.match(svc,/MAX_MARKET_QUOTES=8000/);
 assert.match(v6,/frozenTeams:\{home:game.home,away:game.away\}/);
 assert.ok(!/\.(?:insert|update|upsert|delete)\(|\bfetch\(/.test(route+svc));
 assert.ok(!/\bthe_odds_api\b|\bODDS_API_KEY\b|\bplaceBet\b/.test(route+svc));
});

test('full-name accent, case and whitespace variants preserve numerical identity and market sides',()=>{
 const montreal={...frozen,home_team:'Montréal Canadiens',home_team_id:8};
 const observation=quote('spread',{home:'Montréal Canadiens',homeId:8,
  quote:{home:{name:'  mONTREAL   CANADIENS ',line:-1.5,price:175},
   away:{name:frozen.away_team,line:1.5,price:-205}}});
 const valid=selectNhlExactCircaAsOf({frozen:montreal,observations:[observation],market:'spread'});
 assert.equal(valid.status,'VALID_CIRCA_RESEARCH_QUOTE');
 for(const bad of [
  {...observation,homeId:5},
  {...observation,scheduledAt:'2026-11-20T01:01:00Z'},
  {...observation,quote:{...observation.quote,home:{...observation.quote.home,name:'MTL Canadiens'}}},
  {...observation,quote:{...observation.quote,home:{...observation.quote.home,name:frozen.away_team}}},
  {...observation,quote:{...observation.quote,away:{...observation.quote.away,line:-1.5}}},
 ])assert.equal(selectNhlExactCircaAsOf({frozen:montreal,observations:[bad],market:'spread'}).status,'NOT_READY');
});

test('all duplicate frozen events are excluded instead of inflating independent-game samples',()=>{
 const report=gradeNhlExactCircaCohort({frozenRows:[frozen,{...frozen}],
  observations:[quote('spread'),quote('total')],finalRows:[result(4,3)]});
 assert.equal(report.frozenRows,2);
 assert.equal(report.validFrozen,0);
 assert.equal(report.skippedFrozen,2);
 assert.equal(report.markets.total.graded,0);
 assert.equal(report.markets.spread.pricedEvents,0);
 assert.deepEqual(report.exclusions.map(x=>[x.eventId,x.market,x.reason,x.rows]),
  [[id,null,'DUPLICATE_FROZEN_EVENT',2]]);
});

test('a source received after freeze cannot validate an earlier archived market decision',()=>{
 const leaked={...frozen,source_completed_at:'2026-11-19T22:06:00Z'};
 const report=gradeNhlExactCircaCohort({frozenRows:[leaked],
  observations:[quote('spread'),quote('total')],finalRows:[result(4,3)]});
 assert.equal(report.skippedFrozen,1);
 assert.equal(report.markets.total.graded,0);
 assert.equal(report.exclusions[0].reason,'SOURCE_CAPTURE_AFTER_FREEZE');
 assert.equal(selectNhlExactCircaAsOf({frozen:leaked,observations:[quote('total')],market:'total'}).status,'NOT_READY');
});

test('a conflicting final body event ID or negative score cannot be graded',()=>{
 for(const bad of [
  {...result(4,3),body:{...result(4,3).body,eventId:'nhl:2026020999'}},
  result(-1,2),
 ]){
  const report=gradeNhlExactCircaCohort({frozenRows:[frozen],
   observations:[quote('spread'),quote('total')],finalRows:[bad]});
  assert.equal(report.invalidResults,1);
  assert.equal(report.settledDistinctGames,0);
  assert.equal(report.markets.total.graded,0);
  assert.ok(report.exclusions.some(x=>x.reason==='FINAL_IDENTITY_OR_TIME_INVALID'));
 }
});

test('same quote instant in different ISO formats still rejects contradictory lines',()=>{
 const observations=[quote('total'),quote('total',{capturedAt:'2026-11-19T22:03:00.000+00:00',
  quote:{over:{side:'Over',line:6.5,price:-110},under:{side:'Under',line:6.5,price:-110}}})];
 assert.equal(selectNhlExactCircaAsOf({frozen,observations,market:'total'}).reason,'CONTRADICTORY_SAME_TIME_QUOTES');
});

test('per-game market exclusions distinguish unavailable quote, pending final and total push',()=>{
 const pending=gradeNhlExactCircaCohort({frozenRows:[frozen],observations:[quote('total')],finalRows:[]});
 assert.ok(pending.exclusions.some(x=>x.eventId===id&&x.market===null&&x.reason==='FINAL_NOT_AVAILABLE'));
 assert.ok(pending.exclusions.some(x=>x.eventId===id&&x.market==='spread'&&x.reason==='NO_VERIFIED_MATCHED_ASOF_QUOTE'));
 const push=gradeNhlExactCircaCohort({frozenRows:[frozen],observations:[quote('total')],finalRows:[result(4,2)]});
 assert.ok(push.exclusions.some(x=>x.eventId===id&&x.market==='total'&&x.reason==='PUSH_EXCLUDED_FROM_WIN_LOSS'));
 assert.ok(push.exclusions.every(x=>typeof x.reasonLabel==='string'&&x.reasonLabel.length>0));
 assert.equal(push.markets.total.graded,0);
 assert.equal(push.markets.total.modelBrier,null);
 assert.equal(push.markets.total.pushes,1);
});
