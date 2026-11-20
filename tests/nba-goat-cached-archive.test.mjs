import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveCachedBoxscores, validCacheBatch, verifiedCacheSource } from '../src/lib/nba/goat-cached-archive.mjs';

const game = {id: 91, season: 2026, date: '2026-11-17', datetime: '2026-11-18T04:00:00Z',
  status_state: 'final', postponed:false, postseason:false, home_team_score:10, visitor_team_score:15,
  home_team_id:1, visitor_team_id:2};
const data = Array.from({length:10},(_,i)=>{
  const team=i<5?1:2;
  return {game, player:{id:i+1,team_id:team}, team:{id:team}, min:'12:00', pts:team===1?2:3, ast:0, fg3m:0, reb:0};
});
const context={provider:'balldontlie',provider_game_id:91,player_stats:{data},player_stats_captured_at:'2026-11-18T07:00:00Z'};
const receipt={source_received_at:'2026-11-18T08:00:00Z',payload:{data:{games:[game]}}};
const now=Date.parse('2026-11-20T00:00:00Z');

test('cache jobs validate their bounded list before writing',()=>{
  assert.ok(validCacheBatch([91,92]));
  for(const invalid of [[],[91,91],['91'],[0],[-1],Array.from({length:11},(_,i)=>i+1)]) assert.equal(validCacheBatch(invalid),false);
});
test('requires final identity, complete points and the original source time',()=>{
  assert.equal(verifiedCacheSource(context,receipt,91,now).capturedAt,context.player_stats_captured_at);
  assert.equal(verifiedCacheSource(context,receipt,92,now),null);
  assert.equal(verifiedCacheSource({...context,provider:'unknown'},receipt,91,now),null);
  assert.equal(verifiedCacheSource(context,{...receipt,source_received_at:game.datetime},91,now),null);
  assert.equal(verifiedCacheSource(context,receipt,91,Date.parse(game.datetime)),null);
  assert.equal(verifiedCacheSource({...context,player_stats:{data:data.slice(1)}},receipt,91,now),null);
});
test('already indexed games require no reads and late tips use both date partitions',async()=>{
  const tables=[],saved=[];
  const db={from(table){
    tables.push(table);
    const query={select(){return this},eq(){return this},
      in(column,dates){assert.equal(column,'date_local');assert.deepEqual(dates,['2026-11-17','2026-11-18']);return this},
      contains(){return this},order(){return this},limit(){return this},
      async maybeSingle(){return {data:table==='nba_game_context_v2'?context:receipt}}};
    return query;
  }};
  const result=await archiveCachedBoxscores({db,ids:[90,91],completed:new Set(['90:player_stats']),
    save:async(...args)=>saved.push(args)});
  assert.deepEqual(tables,['nba_game_context_v2','nba_market_schedules_v1']);
  assert.deepEqual(result.map(x=>x.status),['ALREADY_INDEXED','ARCHIVED']);
  assert.deepEqual(saved,[[game,'player_stats',data,context.player_stats_captured_at]]);
});
