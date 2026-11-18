import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCapturedGameContexts,mergeCapturedGoatFacts} from '../src/lib/nba/nba-props-context-fallback.mjs';
const game={id:21718118,datetime:'2026-11-17T00:00:00Z',status_state:'final'};
const entry=n=>({game,player:{id:n+100},min:'20:30',pts:11+n,reb:4,ast:3,fg3m:2});
const wrapper={provider_game_id:game.id,player_stats:{data:Array.from({length:20},(_,i)=>entry(i))},
 player_stats_captured_at:'2026-11-17T03:00:00Z'};
test('captured operational GOAT becomes compact as-of facts without altering capture time',()=>{
 const rows=compactCapturedGameContexts([wrapper]);
 assert.equal(rows.length,20);assert.equal(rows[0].source_captured_at,'2026-11-17T03:00:00.000Z');
 assert.equal(rows[0].minutes_played,20.5);assert.equal(rows[0].projection_eligible,true);
 assert.equal(rows[0].source_kind,'CAPTURED_OPERATIONAL_GOAT_BOXSCORE');
});
test('invalid identities and nonfinal game are never ingested as facts',()=>{
 const invalid={...wrapper,player_stats:{data:[...wrapper.player_stats.data.slice(0,19),entry(19)]}};
 invalid.player_stats.data[19]={...invalid.player_stats.data[19],game:{...game,id:999}};
 assert.equal(compactCapturedGameContexts([invalid]).length,0);
 const live={...wrapper,player_stats:{data:wrapper.player_stats.data.map(v=>({...v,game:{...game,status_state:'in_progress'}}))}};
 assert.equal(compactCapturedGameContexts([live]).length,0);
});
test('DNP facts cannot be used as historical features',()=>{
 const data=wrapper.player_stats.data.map(v=>({...v}));
 data[0].min='DNP';
 const rows=compactCapturedGameContexts([{...wrapper,player_stats:{data}}]);
 assert.equal(rows[0].projection_eligible,false);
});
test('duplicate game-player source identities are rejected',()=>{
 assert.throws(()=>compactCapturedGameContexts([wrapper,wrapper]),/DUPLICATE_OPERATIONAL_CONTEXT_IDENTITY/);
});
test('merging research and operational copies preserves earliest observed capture',()=>{
 const op=compactCapturedGameContexts([wrapper]);
 const base={...op[0],source_captured_at:'2026-11-18T01:00:00Z',source_kind:'GOAT_STORAGE'};
 const merged=mergeCapturedGoatFacts([base],op);
 assert.equal(merged.length,20);
 assert.equal(merged[0].source_captured_at,op[0].source_captured_at);
});
test('only already-captured operational GOAT is used by private research API',async()=>{
 const {readFileSync}=await import('node:fs');
 const route=readFileSync('src/app/api/market-data/nba/props-shadow/route.ts','utf8');
 assert.match(route,/compactCapturedGameContexts/);
 assert.match(route,/mergeCapturedGoatFacts/);
 assert.match(route,/\.not\('player_stats','is',null\)/);
 assert.match(route,/CAPTURED_OPERATIONAL_CONTEXT_BOUND_REVIEW/);
 assert.doesNotMatch(route,/\.(insert|upsert|update|delete)\(/);
});
