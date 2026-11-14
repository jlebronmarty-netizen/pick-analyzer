import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNbaPropsHistoryBackfillGame} from '../src/lib/nba/goat-props-history-core.mjs';
import {readFileSync} from 'node:fs';
const at=Date.parse('2026-11-14T02:00:00Z');
const g=(id,status='final',datetime='2026-11-12T02:00:00Z')=>({id,status_state:status,datetime,season:2026,postseason:false,postponed:false});
const snap=(at,games)=>({source_received_at:at,payload:{data:{games}}});
test('Only older final games without archived player truth are backfilled',()=>{
 const rows=[snap('2026-11-13T03:00:00Z',[g(10),g(11,'scheduled'),g(12,'in_progress')])];
 assert.equal(selectNbaPropsHistoryBackfillGame(rows,new Set([10]),at)?.providerGameId,undefined);
 assert.equal(selectNbaPropsHistoryBackfillGame(rows,new Set(),at)?.providerGameId,10);
});
test('A newer nonfinal snapshot must override older final evidence',()=>{
 const a=snap('2026-11-13T01:00:00Z',[g(90)]),b=snap('2026-11-13T02:00:00Z',[g(90,'in_progress')]);
 assert.equal(selectNbaPropsHistoryBackfillGame([a,b],new Set(),at),null);
});
test('Current season, future, postponed and postseason games are strictly excluded',()=>{
 const rows=[snap('2026-11-13T03:00:00Z',[{...g(50),season:2025},g(51,'final','2026-11-14T01:00:00Z'),{...g(52),postseason:true},{...g(53),postponed:true}])];
 assert.equal(selectNbaPropsHistoryBackfillGame(rows,new Set(),at),null);
});
test('Backfill chooses most recent eligible final, never overwrites existing player stats',()=>{
 const rows=[snap('2026-11-13T03:00:00Z',[g(40,'final','2026-11-12T01:00:00Z'),g(41,'final','2026-11-13T01:00:00Z')])];
 assert.equal(selectNbaPropsHistoryBackfillGame(rows,new Set(),at)?.providerGameId,41);
 assert.equal(selectNbaPropsHistoryBackfillGame(rows,new Set([41]),at)?.providerGameId,40);
});
test('Dedicated collector is opt-in, provider-bounded, isolated and cannot promote models',()=>{
 const service=readFileSync(new URL('../src/services/nba-goat-props-history-backfill.service.ts',import.meta.url),'utf8');
 const cron=readFileSync(new URL('../src/app/api/cron/nba-current-era-shadow/route.ts',import.meta.url),'utf8');
 assert.match(service,/NBA_PROPS_HISTORY_BACKFILL_ENABLED/);
 assert.match(service,/DAILY_PROVIDER_CALL_CAP=4/);
 assert.match(service,/per_page','100'/);
 assert.match(service,/is\('player_stats',null\)/);
 assert.match(service,/officialPickDelta:0,modelChanged:false/);
 assert.match(cron,/const propsHistory=await safe\(\(\)=>syncNbaPropsPlayerHistory\(\)/);
 assert.ok(cron.indexOf('const propsHistory=')>cron.indexOf('const shadow='));
});
