import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 reconstructNhlRegulationFinal,extractNhlRegulationAsOf,
 nhlRegulationToFinalScoreDistribution,forecastNhlRegulationV8,
 gradeNhlRegulationV8Retrospective
} from '../src/lib/nhl-regulation-shootout-v8-research.mjs';
import {nhlScoreDistribution} from '../src/lib/nhl-challenger-poisson-core.mjs';

const now='2026-11-19T22:08:00Z';
const mk=(n,kind='REG',scheduled='2026-11-13T00:00:00Z',capture='2026-11-13T04:30:00Z')=>{
 const id='nhl:'+String(2026020000+n),score=kind==='REG'?[4,2]:kind==='OT'?[4,3]:[3,2];
 return {eventId:id,capturedAt:capture,boxscore:{
  id:Number(id.slice(4)),season:20262027,gameType:2,gameState:'OFF',
  regPeriods:3,startTimeUTC:scheduled,
  homeTeam:{id:1,score:score[0]},awayTeam:{id:2,score:score[1]},
  gameOutcome:{lastPeriodType:kind,...(kind==='OT'?{otPeriods:1}:{})},
  periodDescriptor:{number:kind==='REG'?3:kind==='OT'?4:5,
   periodType:kind,maxRegulationPeriods:3}
 }};
};
test('read official regular-season final period type and reconstruct regulation goals',()=>{
 const reg=reconstructNhlRegulationFinal(mk(1,'REG'));
 const ot=reconstructNhlRegulationFinal(mk(2,'OT'));
 const so=reconstructNhlRegulationFinal(mk(3,'SO'));
 assert.equal(reg.status,'VERIFIED_REGULATION_RECONSTRUCTION');
 assert.equal(reg.regulationHomeGoals,4);assert.equal(reg.regulationAwayGoals,2);
 assert.equal(ot.regulationHomeGoals,3);assert.equal(ot.regulationAwayGoals,3);
 assert.equal(so.regulationHomeGoals,2);assert.equal(so.regulationAwayGoals,2);
 assert.equal(ot.resultKind,'OT');assert.equal(so.resultKind,'SO');
 assert.equal(so.originalForecastsChanged,false); // source evidence cannot change V1/V6
});
test('reconstruction refuses inconsistent periods, playoff, mismatched IDs and OT margin',()=>{
 const raw=mk(4,'OT');
 for(const bad of [
  {...raw,boxscore:{...raw.boxscore,id:2026021234}},
  {...raw,boxscore:{...raw.boxscore,gameType:3}},
  {...raw,boxscore:{...raw.boxscore,periodDescriptor:{number:5,periodType:'OT',maxRegulationPeriods:3}}},
  {...raw,boxscore:{...raw.boxscore,homeTeam:{id:1,score:5},awayTeam:{id:2,score:3}}},
  {...raw,capturedAt:'2026-11-12T20:00:00Z'},
  {...raw,boxscore:{...raw.boxscore,gameOutcome:{lastPeriodType:'REG'}}}
 ])assert.equal(reconstructNhlRegulationFinal(bad).status,'NOT_READY');
});
test('a historical final first captured after decision cannot inform an earlier forecast',()=>{
 const source=[mk(1,'REG'),mk(2,'OT','2026-11-13T00:00:00Z','2026-11-20T04:00:00Z')];
 const r=extractNhlRegulationAsOf({boxscoreRows:source,decisionAt:now});
 assert.equal(r.games.length,1);assert.equal(r.excluded.NOT_KNOWN_BEFORE_DECISION,1);
});
test('two copies of same archived game are excluded rather than doubling scoring history',()=>{
 const row=mk(12,'REG');
 const x=extractNhlRegulationAsOf({boxscoreRows:[row,row],decisionAt:now});
 assert.equal(x.games.length,0);assert.equal(x.conflictedEventIds,1);
});
test('regular-time tie moves final-score total by one goal in OT/SO approximation',()=>{
 const original=nhlScoreDistribution(3,3,{totalLine:6,puckLine:-1.5});
 const adjusted=nhlRegulationToFinalScoreDistribution(3,3,{totalLine:6,puckLine:-1.5});
 assert.ok(adjusted.overGoalsProxy>original.overGoalsProxy);
 assert.ok(adjusted.totalPushProxy<original.totalPushProxy);
 assert.equal(adjusted.homeMoneylineProxy,0.5);
 assert.ok(adjusted.regulationTieProbability>0.1);
 assert.equal(adjusted.officialPick,false);
 assert.equal(adjusted.calibrated,false);
});
test('score distribution respects precise half/integer lines and both puck sides',()=>{
 for(const totalLine of [5.5,6,6.5])for(const puckLine of [-1.5,1.5]){
  const r=nhlRegulationToFinalScoreDistribution(3.2,2.8,{totalLine,puckLine});
  assert.ok(r.homeMoneylineProxy>0&&r.homeMoneylineProxy<1);
  assert.ok(r.overGoalsProxy>=0&&r.totalPushProxy>=0);
  assert.ok(Math.abs(r.overGoalsProxy+r.underGoalsProxy+r.totalPushProxy-1)<.0015);
  assert.ok(Math.abs(r.homePucklineCoverProxy+r.awayPucklineCoverProxy+r.homePucklinePushProxy-1)<.0015);
  assert.equal(r.sportsbookRulesCertified,false);
 }
});
test('enough preceding official reconstructed regulation games can forecast independent V8 research',()=>{
 const start=Date.parse('2026-10-05T20:00:00Z');
 const history=Array.from({length:40},(_,i)=>
  mk(i,i%3===0?'REG':i%3===1?'OT':'SO',
   new Date(start+i*86400000).toISOString(),
   new Date(start+i*86400000+5*3600000).toISOString()));
 const game={eventId:'nhl:2026020999',homeId:1,awayId:2,
  scheduledAt:'2026-11-20T00:00:00Z'};
 const x=forecastNhlRegulationV8({game,decisionAt:now,boxscoreRows:history});
 assert.equal(x.status,'UNVALIDATED_REGULATION_CHALLENGER');
 assert.equal(x.priorLeagueGames,40);
 assert.equal(x.priorHomeGames,5);assert.equal(x.priorAwayGames,5);
 assert.ok(x.fullGameResearchProxies.regulationTieProbability>0);
 assert.equal(x.officialPick,false);assert.equal(x.holdoutValidated,false);
 assert.equal(x.goalieAdjusted,false);assert.equal(x.modelPromoted,false);
});
test('no new vendor calls, model coefficients, wagers, Official Picks or cron triggers',()=>{
 const s=fs.readFileSync('src/lib/nhl-regulation-shootout-v8-research.mjs','utf8');
 assert.ok(!/\bfetch\(|the_odds_api|paidRead|\.upsert\(|\.insert\(|savePrediction|placeBet/.test(s));
 assert.match(s,/captured<=scheduled/);assert.match(s,/stamp\(f.capturedAt\)>now/);
 assert.match(s,/holdoutValidated:false/);assert.match(s,/officialPick:false/);
});

test('retrospective paired scoring never alters V1 originals or claims holdout',()=>{
 const start=Date.parse('2026-10-05T20:00:00Z');
 const history=Array.from({length:40},(_,i)=>mk(i,i%3===0?'REG':i%3===1?'OT':'SO',
  new Date(start+i*86400000).toISOString(),
  new Date(start+i*86400000+5*3600000).toISOString()));
 const gameId='nhl:2026020999',tip='2026-11-20T00:00:00Z',frozenAt=now;
 const frozen={event_id:gameId,model_version:'NHL_SCORES_POISSON_SHADOW_V1',
  home_team_id:1,away_team_id:2,scheduled_at:tip,frozen_at:frozenAt,
  official_pick:false,production_eligible:false,
  market_proxies:{homeMoneylineProxy:0.55,overGoalsProxy:0.51}};
 const outcome={event_id:gameId,observed_at:'2026-11-20T03:30:00Z',
  body:{eventId:gameId,scheduledAt:tip,homeId:1,awayId:2,
   homeScore:4,awayScore:2}};
 const x=gradeNhlRegulationV8Retrospective({
  frozenRows:[frozen],boxscoreRows:history,outcomeRows:[outcome]});
 assert.equal(x.pairedGames,1);
 assert.ok(x.brier.regulationMoneyline>=0);
 assert.equal(x.holdoutPassed,false);
 assert.equal(x.officialPicksChanged,false);
 assert.equal(x.modelPromotionAllowed,false);
 assert.equal(frozen.market_proxies.homeMoneylineProxy,0.55);
 const ungraded=gradeNhlRegulationV8Retrospective({
  frozenRows:[frozen],boxscoreRows:history,
  outcomeRows:[{...outcome,observed_at:'2026-11-19T21:00:00Z'}]});
 assert.equal(ungraded.pairedGames,0);
 assert.equal(ungraded.invalidRecords,1);
});
