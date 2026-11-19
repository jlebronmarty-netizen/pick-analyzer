import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nhlGoalieSameAbbreviatedIdentity,nhlGoalieAsOfSide,nhlPairedGoalieAsOfEvidence}
 from '../src/lib/nhl-goalie-prior-form-asof-v7.mjs';
const now='2026-11-19T22:08:00Z';
const game={eventId:'nhl:2026020355',scheduledAt:'2026-11-20T01:00:00Z',
 homeId:20,awayId:30};
const evidence={status:'PREGAME_PROBABLE_SOURCE_ONLY',observedAt:'2026-11-19T22:07:20Z',
 confirmedHome:false,confirmedAway:false,
 home:{displayName:'Michael DiPietro'},away:{displayName:'Darcy Kuemper'}};
const goalie=(id,name,shots,goals)=>({
 playerId:id,name:{default:name},shotsAgainst:shots,goalsAgainst:goals,
 position:'G',toi:'59:10'});
const box=(id,when,seen,home,away,homeGoalies,awayGoalies)=>({
 eventId:id,capturedAt:seen,boxscore:{id:Number(id.slice(4)),season:20262027,gameType:2,
  gameState:'OFF',startTimeUTC:when,
  homeTeam:{id:home},awayTeam:{id:away},
  playerByGameStats:{homeTeam:{goalies:homeGoalies},awayTeam:{goalies:awayGoalies}}}
});
const prior=[
 box('nhl:2026020321','2026-11-15T01:00:00Z','2026-11-15T05:30:00Z',20,30,
  [goalie(8480022,'M. DiPietro',32,2)], [goalie(8475311,'D. Kuemper',31,3)]),
 box('nhl:2026020328','2026-11-17T01:00:00Z','2026-11-17T05:30:00Z',20,30,
  [goalie(8480022,'M. DiPietro',30,1)], [goalie(8475311,'D. Kuemper',34,1)])
];
test('exact team-qualified goalie identity maps full ESPN name to abbreviated NHL boxscore',()=>{
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Michael DiPietro','M. DiPietro'),true);
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Darcy Kuemper','D. Kuemper'),true);
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Lukasz Bladziak','L. Bladziak'),true);
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Michael DiPietro','D. DiPietro'),false);
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Michael DiPietro','M. Dietro'),false);
 assert.equal(nhlGoalieSameAbbreviatedIdentity('Michael DiPietro','M. D.'),false);
});
test('two prior official boxscore games give independent goalie form but no starter claim',()=>{
 const x=nhlPairedGoalieAsOfEvidence({game,goalieEvidence:evidence,decisionAt:now,boxscoreRows:prior});
 assert.equal(x.status,'BOTH_PRIOR_FORMS_AVAILABLE');
 assert.equal(x.home.goalieNhlIdCandidate,8480022);
 assert.equal(x.home.priorShots,62);assert.equal(x.home.priorGoalsAgainst,3);
 assert.ok(Math.abs(x.home.priorSavePct-(1-3/62))<.00001);
 assert.equal(x.away.goalieNhlIdCandidate,8475311);
 assert.equal(x.away.priorShots,65);assert.equal(x.away.priorGoalsAgainst,4);
 assert.equal(x.confirmedStartingGoalies,0);
 assert.equal(x.independentlyVerifiedCrosswalk,false);
 assert.equal(x.modelGoalieAdjustmentApplied,false);
 assert.equal(x.home.actualStartingGoalieConfirmed,false);
});
test('future NHL game boxscore and same-game final NEVER enter pregame goalie form',()=>{
 const impossible=box(game.eventId,game.scheduledAt,'2026-11-20T05:10:00Z',20,30,
  [goalie(8480022,'M. DiPietro',40,1)],[goalie(8475311,'D. Kuemper',40,0)]);
 const x=nhlPairedGoalieAsOfEvidence({game,goalieEvidence:evidence,
  decisionAt:now,boxscoreRows:[...prior,impossible]});
 assert.equal(x.home.priorShots,62);assert.equal(x.away.priorShots,65);
 const onlyFuture=nhlPairedGoalieAsOfEvidence({game,goalieEvidence:evidence,
  decisionAt:now,boxscoreRows:[impossible]});
 assert.equal(onlyFuture.status,'PARTIAL_PRIOR_GOALIE_FORM');
 assert.equal(onlyFuture.home.status,'NOT_READY');
});
test('wrong team historical goalie cannot be assigned to a current probable',()=>{
 const traded=prior.map(x=>({...x,boxscore:{...x.boxscore,
  homeTeam:{id:54},awayTeam:{id:55}}}));
 const x=nhlPairedGoalieAsOfEvidence({game,goalieEvidence:evidence,
  decisionAt:now,boxscoreRows:traded});
 assert.equal(x.home.reason,'NO_UNAMBIGUOUS_PRIOR_TEAM_GOALIE_ID');
 assert.equal(x.away.reason,'NO_UNAMBIGUOUS_PRIOR_TEAM_GOALIE_ID');
});
test('two NHL IDs under same team and abbreviated name are ambiguous, not merged',()=>{
 const conflict=box('nhl:2026020319','2026-11-13T00:00:00Z','2026-11-13T04:10:00Z',20,30,
  [goalie(8000001,'M. DiPietro',39,2)], [goalie(8475311,'D. Kuemper',40,2)]);
 const x=nhlPairedGoalieAsOfEvidence({game,goalieEvidence:evidence,
  decisionAt:now,boxscoreRows:[...prior,conflict]});
 assert.equal(x.status,'PARTIAL_PRIOR_GOALIE_FORM');
 assert.equal(x.home.reason,'MULTIPLE_GOALIE_IDS_FOR_SAME_TEAM_NAME');
 assert.equal(x.home.nhlCrosswalkCertified,false);
 assert.equal(x.away.status,'PRIOR_FORM_EVIDENCE');
});
test('a prior goalie with fewer than 50 shots remains insufficient, no fallback guess',()=>{
 const x=nhlGoalieAsOfSide({teamId:20,fullName:'Michael DiPietro',
  decisionAt:now,gameEventId:game.eventId,boxscoreRows:[prior[0]],minShots:50});
 assert.equal(x.status,'INSUFFICIENT_PRIOR_SHOTS');assert.equal(x.priorShots,32);
 assert.equal(x.goalieAdjustmentApplied,false);
});
test('duplicate official game archived snapshots are discarded, no doubled goalie saves',()=>{
 const dup=nhlGoalieAsOfSide({teamId:20,fullName:'Michael DiPietro',
  decisionAt:now,gameEventId:game.eventId,boxscoreRows:[...prior,prior[0]]});
 assert.equal(dup.priorShots,30);
 assert.equal(dup.status,'INSUFFICIENT_PRIOR_SHOTS');
});
test('V6 writer reads existing NHL boxscores without new vendor calls and no goalie score weights',()=>{
 const writer=fs.readFileSync('src/services/nhl-late-v6-freeze-writer.service.ts','utf8');
 const core=fs.readFileSync('src/lib/nhl-late-v6-core.mjs','utf8');
 const readiness=fs.readFileSync('src/services/nhl-late-v6-readiness.service.ts','utf8');
 assert.ok(writer.includes("db.from('nhl_game_context_v2')"));
 assert.ok(writer.includes("boxscoreRows"));
 assert.ok(writer.includes("providerCalls:0"));
 assert.ok(!/\bfetch\(|the_odds_api|oddsapi|modifyModel|savePrediction/i.test(writer));
 assert.ok(core.includes("historicalFormV7:goalieHistoryV7"));
 assert.ok(core.includes("goalieAdjustmentApplied:false"));
 assert.ok(core.includes("official_pick:false"));
 assert.ok(readiness.includes("pairedWithMinimum50PriorShots"));
 assert.ok(readiness.includes("goalieModelAdjustmentApplied:false"));
});
