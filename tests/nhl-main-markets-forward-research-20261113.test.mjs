import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 normalizeNhlStoredFinal,buildNhlTeamPregameForm,buildNhlMainMarketResearchPreview,
 compareNhlFrozenMoneylineBenchmark,NHL_MAIN_MARKETS,NHL_MAIN_MARKETS_RESEARCH_VERSION
} from '../src/lib/nhl-main-markets-research-core.mjs';
const at='2026-11-13T12:00:00Z',scheduledAt='2026-11-13T23:00:00Z';
const box=(id,day)=>{
 const start='2026-11-'+String(day).padStart(2,'0')+'T02:00:00Z';
 return {id,gameType:2,gameState:'OFF',startTimeUTC:start,
  awayTeam:{id:10,score:2,sog:27},homeTeam:{id:20,score:4,sog:32},
  playerByGameStats:{awayTeam:{goalies:[{playerId:123,toi:'60:00',saves:28,shotsAgainst:32,savePctg:.875}]},
   homeTeam:{goalies:[{playerId:456,toi:'60:00',saves:25,shotsAgainst:27,savePctg:.926}]}}
 };
};
const rows=Array.from({length:5},(_,i)=>{
 const day=i+1;return normalizeNhlStoredFinal({eventId:'nhl:'+(100+i),boxscore:box(100+i,day),capturedAt:'2026-11-'+String(day).padStart(2,'0')+'T07:00:00Z'});
});
test('Only three major markets and a research-only version',()=>{
 assert.deepEqual(NHL_MAIN_MARKETS,['moneyline','spread','total']);assert.match(NHL_MAIN_MARKETS_RESEARCH_VERSION,/RESEARCH/);
});
test('Only complete official regular-season final boxscores are materialized',()=>{
 const good=normalizeNhlStoredFinal({eventId:'nhl:100',boxscore:box(100,1),capturedAt:'2026-11-01T08:00:00Z'});
 assert.equal(good.gameId,100);assert.equal(good.away.shots,27);assert.equal(good.home.goals,4);
 assert.equal(good.home.actualGoalie.id,456);
 for(const bad of [{...box(100,1),gameState:'LIVE'},{...box(100,1),gameType:3},{...box(100,1),homeTeam:{id:20,score:2,sog:32}}])
  assert.equal(normalizeNhlStoredFinal({eventId:'nhl:100',boxscore:bad,capturedAt:'2026-11-01T08:00:00Z'}),null);
 assert.equal(normalizeNhlStoredFinal({eventId:'nhl:999',boxscore:box(100,1),capturedAt:'2026-11-01T08:00:00Z'}),null);
});
test('Historical rolling statistics require five fully observed distinct games',()=>{
 const form=buildNhlTeamPregameForm(20,rows,at);
 assert.equal(form.status,'HISTORICAL_FORM_AVAILABLE');assert.equal(form.priorGames,5);
 assert.equal(form.recent5.goalsFor,4);assert.equal(form.recent5.goalsAgainst,2);
 assert.equal(form.recent5.shotsFor,32);assert.equal(form.historicalGoalie.id,456);
 assert.equal(form.startingGoalieConfirmed,false);assert.equal(form.injuriesVerified,false);
 assert.equal(buildNhlTeamPregameForm(20,rows.slice(0,4),at).reason,'INSUFFICIENT_PRIOR_TEAM_GAMES');
 assert.equal(buildNhlTeamPregameForm(20,rows,at,1).reason,'UNSAFE_SAMPLE_MINIMUM');
});
test('Exclude backfilled-after-decision, future and incomplete games even if final truth later exists',()=>{
 const late=[...rows.slice(0,4),{...rows[4],capturedAt:'2026-11-13T13:00:00Z'}];
 assert.equal(buildNhlTeamPregameForm(20,late,at).reason,'INSUFFICIENT_PRIOR_TEAM_GAMES');
 const future=[...rows.slice(0,4),{...rows[4],startTime:'2026-11-14T12:00:00Z'}];
 assert.equal(buildNhlTeamPregameForm(20,future,at).reason,'INSUFFICIENT_PRIOR_TEAM_GAMES');
 const duplicated=[rows[0],rows[0],rows[1],rows[2],rows[3]];
 assert.equal(buildNhlTeamPregameForm(20,duplicated,at).reason,'INSUFFICIENT_PRIOR_TEAM_GAMES');
});
test('A historical descriptive game-total baseline makes no 3-way betting claims',()=>{
 const preview=buildNhlMainMarketResearchPreview({homeId:20,awayId:10,scheduledAt,asOf:at,finals:rows});
 assert.equal(preview.status,'DESCRIPTIVE_SHADOW_ONLY');
 assert.deepEqual(preview.unadjustedGoals,{home:4,away:2,total:6,homeMargin:2});
 assert.deepEqual(preview.marketProbabilities,{moneyline:null,spread:null,total:null});
 assert.equal(preview.recommendedPick,false);assert.equal(preview.productionEligible,false);
 assert.equal(preview.projectedGoalieConfirmed,false);
});
test('Fail closed for cutoff or incomplete team context',()=>{
 assert.equal(buildNhlMainMarketResearchPreview({homeId:20,awayId:10,scheduledAt,asOf:scheduledAt,finals:rows}).reason,'PREGAME_CUTOFF_FAILED');
 assert.equal(buildNhlMainMarketResearchPreview({homeId:20,awayId:99,scheduledAt,asOf:at,finals:rows}).reason,'HISTORICAL_TEAM_COVERAGE_INCOMPLETE');
});
test('No-vig market comparison uses only same settled, pregame priced Circa cohort',()=>{
 const a={eventId:'nhl:900',scheduledAt:'2026-11-11T22:00:00Z',capturedAt:'2026-11-11T13:00:00Z',awayProbability:.4,homeProbability:.6,
  awayId:10,homeId:20,awayOdds:125,homeOdds:-145,sportsbook:'CIRCA'};
 const b={...a,eventId:'nhl:901',homeOdds:null,awayOdds:null,sportsbook:null};
 const c={...a,eventId:'nhl:902',capturedAt:'2026-11-11T23:00:00Z'};
 const outcomes=[
  {eventId:'nhl:900',scheduledAt:a.scheduledAt,capturedAt:'2026-11-12T00:30:00Z',awayId:10,homeId:20,awayScore:2,homeScore:4},
  {eventId:'nhl:901',scheduledAt:a.scheduledAt,capturedAt:'2026-11-12T00:30:00Z',awayId:10,homeId:20,awayScore:2,homeScore:4},
  {eventId:'nhl:902',scheduledAt:a.scheduledAt,capturedAt:'2026-11-12T00:30:00Z',awayId:10,homeId:20,awayScore:2,homeScore:4}
 ];
 const r=compareNhlFrozenMoneylineBenchmark([a,b,c],outcomes);
 assert.equal(r.status,'DESCRIPTIVE_COMPARISON');
 assert.equal(r.totalSettled,2);assert.equal(r.invalidRecords,1);
 assert.equal(r.pairedFrozenPriceGames,1);assert.equal(r.unpricedSettled,1);
 assert.equal(r.modelBrierPaired,0.16);assert.ok(r.noVigMarketBrierPaired>0);
 assert.equal(r.statisticalValidation,false);assert.equal(r.pricingJurisdictionCertified,false);
});
test('Research service/route are read only and never mutate champion models or existing crons',()=>{
 const s=fs.readFileSync('src/services/nhl-main-markets-research.service.ts','utf8');
 const a=fs.readFileSync('src/app/api/nhl/main-markets-research/route.ts','utf8');
 assert.match(s,/normalizeNhlStoredFinal/);assert.match(s,/compareNhlFrozenMoneylineBenchmark/);
 assert.ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(|fetch\(|model_weights|savePrediction/i.test(s+a));
 assert.match(a,/getNhlMainMarketsResearchAudit/);
 assert.equal((fs.readFileSync('vercel.json','utf8').match(/\/api\/cron\/nhl-free/g)||[]).length,1);
});
