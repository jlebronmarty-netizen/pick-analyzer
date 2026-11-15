import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeNhlHistoricalGoalieContext,buildNhlAsOfPregameContext,NHL_ASOF_CONTEXT_VERSION}
 from '../src/lib/nhl-asof-goalie-rest-core.mjs';
import {planNhlFrozenSlate} from '../src/lib/nhl-challenger-freeze-core.mjs';
const HOUR=3600000,DAY=86400000;
const now='2026-11-15T20:00:00Z',scheduledAt='2026-11-16T01:00:00Z';
const upcoming={eventId:'nhl:2026020500',scheduledAt,status:'SCHEDULED',
 homeId:8,awayId:9,home:'Home Test Team',away:'Away Test Team'};
const start=Date.parse('2026-10-05T20:00:00Z');
const finals=Array.from({length:38},(_,i)=>({
 eventId:'nhl:'+(2026020000+i),scheduledAt:new Date(start+i*DAY).toISOString(),
 capturedAt:new Date(start+i*DAY+5*HOUR).toISOString(),
 homeId:8,awayId:9,homeGoals:4,awayGoals:2
}));
const goalieBox=(id,at)=>({
 id,gameState:'OFF',gameType:2,startTimeUTC:at,
 homeTeam:{id:8,score:4},awayTeam:{id:9,score:2},
 playerByGameStats:{
  homeTeam:{goalies:[{playerId:101,toi:'60:00',starter:true,saves:27,goalsAgainst:2,shotsAgainst:29},
   {playerId:102,toi:'00:00',starter:false,saves:0,goalsAgainst:0,shotsAgainst:0}]},
  awayTeam:{goalies:[{playerId:201,toi:'60:00',starter:true,saves:30,goalsAgainst:4,shotsAgainst:34}]}
 }
});
const boxRows=finals.slice(-6).map(g=>({eventId:g.eventId,boxscore:goalieBox(Number(g.eventId.slice(4)),g.scheduledAt),capturedAt:g.capturedAt}));
test('Historical starters are extracted from official FINAL evidence only',()=>{
 const g=normalizeNhlHistoricalGoalieContext(boxRows[0]);
 assert.equal(g.home.starter.playerId,101);
 assert.equal(g.home.starter.savePct,Number((27/29).toFixed(4)));
 assert.equal(g.home.validGoalieRows,1);
 assert.equal(g.away.starter.playerId,201);
 assert.equal(g.away.starter.starterVerifiedForThisHistoricalGame,true);
 assert.equal(normalizeNhlHistoricalGoalieContext({...boxRows[0],capturedAt:boxRows[0].boxscore.startTimeUTC}),null);
});
test('Zero-minute goalie, bad team ID and non-final score cannot become historical evidence',()=>{
 const g=boxRows[0];
 assert.equal(normalizeNhlHistoricalGoalieContext({...g,boxscore:{...g.boxscore,gameState:'LIVE'}}),null);
 assert.equal(normalizeNhlHistoricalGoalieContext({...g,boxscore:{...g.boxscore,awayTeam:{id:8}}}),null);
 const bad={...g,boxscore:{...g.boxscore,playerByGameStats:{...g.boxscore.playerByGameStats,
  homeTeam:{goalies:[{playerId:101,toi:'00:00',starter:true,saves:0,goalsAgainst:0,shotsAgainst:0}]}}}};
 assert.equal(normalizeNhlHistoricalGoalieContext(bad).home.starter,null);
});
test('As-of goalie form and rest use only observations captured before decision',()=>{
 const c=buildNhlAsOfPregameContext({game:upcoming,asOf:now,finalScores:finals,boxscoreRows:boxRows});
 assert.equal(c.status,'RESEARCH_CONTEXT_ONLY');
 assert.equal(c.version,NHL_ASOF_CONTEXT_VERSION);
 assert.equal(c.coverage.historicalGoalieTeams,2);
 assert.equal(c.coverage.confirmedNextGameGoalieTeams,0);
 assert.equal(c.home.lastObservedHistoricalStarter.playerId,101);
 assert.equal(c.home.lastObservedHistoricalStarter.priorStartsForSameGoalie,5);
 assert.equal(c.home.lastObservedHistoricalStarter.priorSavePct,Number((27/29).toFixed(4)));
 assert.equal(c.home.upcomingGoalieConfirmed,false);
 assert.equal(c.home.powerPlayAsOfVerified,false);
 assert.equal(c.home.travelAsOfVerified,false);
 assert.match(c.sourceHash,/^[a-f0-9]{64}$/);
});
test('Never import a postgame goalie snapshot captured after the pregame cutoff',()=>{
 const delayed=boxRows.map(g=>({...g,capturedAt:'2026-11-17T00:00:00Z'}));
 const c=buildNhlAsOfPregameContext({game:upcoming,asOf:now,finalScores:finals,boxscoreRows:delayed});
 assert.equal(c.coverage.historicalGoalieTeams,0);
 assert.equal(c.home.lastObservedHistoricalStarter,null);
 assert.ok(c.home.hoursSincePreviousGame!==null);
 const late=buildNhlAsOfPregameContext({game:upcoming,asOf:'2026-11-16T00:30:00Z',finalScores:finals,boxscoreRows:boxRows});
 assert.equal(late.reason,'NOT_FROZEN_60M_BEFORE_START');
});
test('V2 evidence is frozen with existing V1 probabilities, no formula adjustment',()=>{
 const runs=finals.map(g=>({completed_at:g.capturedAt,games:[{eventId:g.eventId,status:'FINAL',
  scheduledAt:g.scheduledAt,homeId:8,awayId:9,homeScore:4,awayScore:2}]}));
 runs.push({completed_at:'2026-11-15T19:40:00Z',games:[upcoming]});
 const baseline=planNhlFrozenSlate({runs,alreadyFrozen:[],decisionAt:now,maxWrites:3});
 const extended=planNhlFrozenSlate({runs,alreadyFrozen:[],decisionAt:now,maxWrites:3,boxscoreRows:boxRows});
 assert.equal(extended.status,'READY_TO_FREEZE');
 assert.equal(extended.planned.length,1);
 const old=baseline.planned[0],next=extended.planned[0];
 assert.deepEqual(next.market_proxies,old.market_proxies);
 assert.deepEqual(next.projection,old.projection);
 assert.equal(next.features.pregameContextV2.coverage.historicalGoalieTeams,2);
 assert.equal(next.official_pick,false);
});
test('Writer captures from existing database with no extra NHL calls or unrelated model mutation',()=>{
 const writer=fs.readFileSync('src/services/nhl-challenger-freeze-writer.service.ts','utf8');
 const grader=fs.readFileSync('src/services/nhl-challenger-frozen-ledger-audit.service.ts','utf8');
 const core=fs.readFileSync('src/lib/nhl-challenger-freeze-core.mjs','utf8');
 assert.match(writer,/nhl_game_context_v2/);
 assert.match(writer,/boxscore_captured_at/);
 assert.match(writer,/GOALIE_CONTEXT_SCAN_CAP/);
 assert.match(core,/pregameContextV2:pregameContext/);
 assert.match(grader,/historicalGoalieIsNotNextGameStarter:true/);
 assert.ok(!/fetch\(|the_odds_api|model_weights|productionModel|sports_odds_snapshots/.test(writer));
});
