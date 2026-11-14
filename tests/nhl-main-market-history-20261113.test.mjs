import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectNhlMainMarketHistoryTarget,nhlOfficialHistoryResponseValid} from '../src/lib/nhl-main-market-history-core.mjs';
const now=Date.parse('2026-11-14T12:00:00Z');
const g=(suffix='0300',status='FINAL',scheduledAt='2026-11-11T23:00:00Z')=>({
 eventId:'nhl:202602'+suffix,status,scheduledAt,homeId:5,awayId:6,homeScore:3,awayScore:2
});
const run=(at,games)=>({completed_at:at,detail:{games}});
test('A verified older regular-season final not already stored is selected',()=>{
 const x=selectNhlMainMarketHistoryTarget({runDetails:[run('2026-11-12T03:00:00Z',[g('0300'),g('0301')])],
  knownEventIds:new Set(['nhl:2026020301']),nowMs:now});
 assert.equal(x.eventId,'nhl:2026020300');assert.equal(x.gameId,2026020300);
});
test('A newer not-final state takes precedence; no stale schedule final override',()=>{
 const rows=[run('2026-11-12T03:00:00Z',[g('0300')]),run('2026-11-13T04:00:00Z',[g('0300','LIVE')])];
 assert.equal(selectNhlMainMarketHistoryTarget({runDetails:rows,knownEventIds:new Set(),nowMs:now}),null);
});
test('No future, tied, malformed, playoff or scheduled games can enter history',()=>{
 const bad=[g('0300','FINAL','2026-11-14T11:00:00Z'),g('0301','SCHEDULED'),
  {...g('0302'),homeScore:2,awayScore:2},{...g('0303'),eventId:'nhl:2026030303'},
  {...g('0304'),homeId:6,awayId:6},{...g('0305'),homeScore:null}];
 assert.equal(selectNhlMainMarketHistoryTarget({runDetails:[run('2026-11-14T11:30:00Z',bad)],knownEventIds:new Set(),nowMs:now}),null);
});
test('Select latest eligible final and exclude already stored games',()=>{
 const rows=[run('2026-11-12T03:00:00Z',[g('0300','FINAL','2026-11-09T22:00:00Z'),g('0301','FINAL','2026-11-11T22:00:00Z')])];
 assert.equal(selectNhlMainMarketHistoryTarget({runDetails:rows,knownEventIds:new Set(),nowMs:now}).eventId,'nhl:2026020301');
 assert.equal(selectNhlMainMarketHistoryTarget({runDetails:rows,knownEventIds:new Set(['nhl:2026020301']),nowMs:now}).eventId,'nhl:2026020300');
});
test('NHL gamecenter response identity and final are mandatory',()=>{
 const candidate=selectNhlMainMarketHistoryTarget({runDetails:[run('2026-11-12T03:00:00Z',[g('0300')])],knownEventIds:new Set(),nowMs:now});
 const boxscore={id:2026020300,gameType:2,gameState:'OFF',homeTeam:{id:5,score:3},awayTeam:{id:6,score:2},playerByGameStats:{homeTeam:{goalies:[{playerId:1,toi:'60:00'}]}}};
 const pbp={id:2026020300,gameType:2,gameState:'OFF',plays:Array.from({length:10},()=>({typeDescKey:'faceoff'}))};
 assert.equal(nhlOfficialHistoryResponseValid({candidate,boxscore,pbp}),true);
 assert.equal(nhlOfficialHistoryResponseValid({candidate,boxscore:{...boxscore,awayTeam:{id:7,score:2}},pbp}),false);
 assert.equal(nhlOfficialHistoryResponseValid({candidate,boxscore,pbp:{...pbp,plays:[]}}),false);
 assert.equal(nhlOfficialHistoryResponseValid({candidate,boxscore:{...boxscore,gameType:3},pbp}),false);
});
test('History collector never runs without explicit opt-in and enforces a small budget',()=>{
 const s=fs.readFileSync('src/services/nhl-main-market-history-backfill.service.ts','utf8');
 assert.match(s,/NHL_MAIN_MARKET_HISTORY_ENABLED/);
 assert.match(s,/DAILY_ATTEMPT_CAP=4/);
 assert.match(s,/getUTCHours\(\)%6/);
 assert.match(s,/providerCalls=2/);
 assert.match(s,/SCAN_LIMIT_REVIEW_REQUIRED/);
 assert.match(s,/insert\(\{/);
 assert.match(s,/nhl_game_context_v2/);
 assert.ok(!/savePrediction|model_weights|official_pick|model_probability/.test(s));
});
test('NHL cron composes main pipeline unchanged before opt-in history, with no new cron declaration',()=>{
 const cron=fs.readFileSync('src/app/api/cron/nhl-free/route.ts','utf8');
 const a=cron.indexOf('const core=await runNhlFree()'),b=cron.indexOf('const learning=await runNhlCausalLearning()'),c=cron.indexOf('const researchHistory=await syncNhlMainMarketHistory()');
 assert.ok(a>=0&&b>a&&c>b);
 const json=fs.readFileSync('vercel.json','utf8');assert.equal((json.match(/\/api\/cron\/nhl-free/g)||[]).length,1);
});
