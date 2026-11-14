import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 NHL_CHALLENGER_VERSION,extractNhlFrozenFinalScores,
 nhlScoreDistribution,forecastNhlChallenger,
 walkForwardNhlChallenger,pairedNhlChallengerBenchmark
} from '../src/lib/nhl-challenger-poisson-core.mjs';
const day=86400000,epoch=Date.parse('2026-10-05T18:00:00Z');
const fakeGame=i=>{
 const start=new Date(epoch+i*day).toISOString();
 return {eventId:'nhl:'+(2026020000+i),status:'FINAL',scheduledAt:start,
  homeId:5,awayId:6,homeScore:4,awayScore:2};
};
const fakeRuns=Array.from({length:39},(_,i)=>({
 completed_at:new Date(epoch+i*day+4*3600000).toISOString(),
 games:[fakeGame(i)]
}));
const extracted=extractNhlFrozenFinalScores(fakeRuns,'2026-12-01T00:00:00Z').games;
test('Historical NHL archive rows are de-duplicated at earliest available FINAL timestamps',()=>{
 const first=fakeRuns[0];
 const results=extractNhlFrozenFinalScores([...fakeRuns,first],'2026-12-01T00:00:00Z');
 assert.equal(results.games.length,39);
 assert.equal(results.games[0].capturedAt,first.completed_at);
 assert.equal(results.conflicts,0);
});
test('Reject contradictory later official finals instead of silently picking a winning answer',()=>{
 const wrong={completed_at:new Date(epoch+10*day).toISOString(),
  games:[{...fakeGame(0),homeScore:2,awayScore:4}]};
 const data=extractNhlFrozenFinalScores([...fakeRuns,wrong],'2026-12-01T00:00:00Z');
 assert.equal(data.conflicts,1);assert.equal(data.games.length,38);
});
test('Exclude final status before scheduled time, live games, tied, playoff game ID, invalid teams',()=>{
 const now='2026-12-01T00:00:00Z';
 const fixtures=[{...fakeGame(1),status:'LIVE'},{...fakeGame(2),homeScore:2,awayScore:2},
  {...fakeGame(3),eventId:'nhl:2026030003'},{...fakeGame(4),awayId:5},
  {...fakeGame(5),scheduledAt:'2026-12-02T00:00:00Z'}];
 assert.equal(extractNhlFrozenFinalScores([{completed_at:now,games:fixtures}],now).games.length,0);
});
test('Poisson score mass is bounded, has symmetric ML when teams equal, and settles test lines mathematically',()=>{
 const d=nhlScoreDistribution(3,3);
 assert.ok(Math.abs(d.homeMoneylineProxy-.5)<.001);
 assert.ok(Math.abs(d.homeMoneylineProxy+d.awayMoneylineProxy-1)<.0001);
 assert.ok(Math.abs(d.homePucklineCoverProxy+d.awayPucklineCoverProxy+d.homePucklinePushProxy-1)<.0002);
 assert.ok(Math.abs(d.overGoalsProxy+d.underGoalsProxy+d.totalPushProxy-1)<.0002);
 assert.equal(d.fullGameOTSOResolved,false);assert.equal(d.confirmedBookContract,false);
 assert.equal(nhlScoreDistribution(-1,3),null);
});
test('Forward-only challenger outputs 3 market probabilities as non-certified research, without bookmaker signals',()=>{
 const t=new Date(epoch+40*day).toISOString();
 const p=forecastNhlChallenger({homeId:5,awayId:6,scheduledAt:t,
  asOf:new Date(epoch+39*day).toISOString(),finalScores:extracted});
 assert.equal(p.status,'UNVALIDATED_SHADOW_CHALLENGER');
 assert.equal(p.version,NHL_CHALLENGER_VERSION);
 assert.equal(p.projection.homeGoals,4);assert.equal(p.projection.awayGoals,2);
 assert.ok(p.markets.homeMoneylineProxy>.5);
 assert.ok(p.markets.homePucklineCoverProxy>0);
 assert.ok(p.markets.overGoalsProxy>0);
 assert.equal(p.modelProbability,null);assert.equal(p.expectedValue,null);assert.equal(p.edge,null);
 assert.equal(p.calibrated,false);assert.equal(p.officialPick,false);
 assert.equal(p.features.confirmedStartingGoalie,false);
});
test('Do not fabricate a history available at an earlier pregame time',()=>{
 const at=new Date(epoch+25*day).toISOString(),t=new Date(epoch+26*day).toISOString();
 const r=forecastNhlChallenger({homeId:5,awayId:6,scheduledAt:t,asOf:at,
  finalScores:extracted.map(x=>({...x,capturedAt:new Date(epoch+38*day).toISOString()}))});
 assert.equal(r.status,'NOT_READY');assert.equal(r.reason,'INSUFFICIENT_LEAGUE_HISTORY');
 const early=forecastNhlChallenger({homeId:5,awayId:6,scheduledAt:t,asOf:t,finalScores:extracted});
 assert.equal(early.reason,'PREGAME_CUTOFF_FAILED');
});
test('First 25 games are correctly withheld from walk-forward without future leakage',()=>{
 const x=walkForwardNhlChallenger(extracted);
 assert.ok(x.evaluatedGames>0&&x.evaluatedGames<39);
 assert.ok(x.brier.moneyline>=0&&x.brier.moneyline<=1);
 assert.ok(x.mae.totalGoals>=0);
 assert.equal(x.independentHoldoutPassed,false);
 assert.equal(x.approvedForOfficialUse,false);
});
test('Like-for-like comparison must match frozen opponent, event and first-known score evidence',()=>{
 const x=extracted.at(-1);
 const before=new Date(Date.parse(x.scheduledAt)-3600000).toISOString();
 const quote={eventId:x.eventId,scheduledAt:x.scheduledAt,capturedAt:before,homeId:x.homeId,awayId:x.awayId,
  homeProbability:.6,awayProbability:.4,homeOdds:-150,awayOdds:125,sportsbook:'CIRCA'};
 const r=pairedNhlChallengerBenchmark(extracted,[quote]);
 assert.equal(r.pairedChallengerAndDratings,1);
 assert.equal(r.pairedWithCircaMarket,1);
 assert.ok(r.brierOnPricedGames.circaNoVig!==null);
 assert.equal(r.validationPassed,false);
 const invalid=pairedNhlChallengerBenchmark(extracted,[{...quote,awayId:99}]);
 assert.equal(invalid.pairedChallengerAndDratings,0);assert.equal(invalid.invalidSourcePairs,1);
});
test('Service and public route are strictly read-only; not coupled to GOAT or official NHL model',()=>{
 const service=fs.readFileSync('src/services/nhl-poisson-challenger-audit.service.ts','utf8');
 const route=fs.readFileSync('src/app/api/nhl/challenger-research/route.ts','utf8');
 assert.match(service,/extractNhlFrozenFinalScores/);
 assert.match(service,/walkForwardNhlChallenger/);
 assert.match(service,/pairedNhlChallengerBenchmark/);
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(|fetch\(|model_weights|recommended_pick/i.test(service+route));
 assert.match(route,/getNhlPoissonChallengerAudit/);
});
