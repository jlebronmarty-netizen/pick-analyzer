import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {buildResearchPropEnvelopes,propScope,collectCursorPages,historyDateRange,normalizeHistoryGamePages,finalPlayerStatsComplete} from '../src/lib/nba/goat-research-capture-core.mjs';

const game={id:21718131,date:'2026-11-18',datetime:'2026-11-19T00:00:00Z',season:2026,status:'8:00 PM ET',status_state:'scheduled',period:0,postponed:false,home_team:{id:6,abbreviation:'CLE',full_name:'Cleveland Cavaliers'},visitor_team:{id:15,abbreviation:'MEM',full_name:'Memphis Grizzlies'}};
const received='2026-11-18T17:00:00Z';
const prop={id:100,game_id:game.id,player_id:22,vendor:'fanduel',prop_type:'points',line_value:'20.5',market:{type:'over_under',over_odds:-105,under_odds:-115},updated_at:'2026-11-18T16:59:00Z'};
const normalize=data=>buildResearchPropEnvelopes({game,payload:{data},receivedAt:received,requestUrl:'https://api.balldontlie.io/nba/v2/odds/player_props?game_id='+game.id,runId:'audit-run'});

test('Full game, Q1, first three minutes and future unknown provider types stay distinct',()=>{
 assert.equal(propScope('points').period,'FULL_GAME_LABEL_OT_UNVERIFIED');assert.equal(propScope('points_1q').period,'Q1');assert.equal(propScope('points_first3min').period,'FIRST_3_MINUTES');
 assert.equal(propScope('points_new_period').period,'PROVIDER_PERIOD_UNVERIFIED');
 const p=normalize([prop,{...prop,id:101,prop_type:'points_1q'},{...prop,id:102,prop_type:'points_first3min'}])[0];
 assert.equal(p.data.quotes.length,6);assert.equal(new Set(p.data.quotes.map(q=>q.quote_id)).size,6);assert.equal(p.meta.coverage.full_fanduel_catalog_verified,false);
 assert.ok(p.data.quotes.every(q=>q.model_probability===null&&q.expected_value===null&&q.execution_available===false));
});
test('Milestones preserve yes contract and raw source without fabricating an Under',()=>{
 const row={...prop,prop_type:'double_double',line_value:'1',market:{type:'milestone',odds:175}},p=normalize([row])[0];
 assert.equal(p.data.quotes.length,1);assert.equal(p.data.quotes[0].side,'yes');assert.equal(p.data.quotes[0].contract,'PROVIDER_MILESTONE_UNVERIFIED');assert.deepEqual(p.meta.raw_provider_response,{data:[row]});
});
test('Exact O/U side prices, zero vs missing, vendor and game identity fail safely',()=>{
 const p=normalize([prop,{...prop,id:101,game_id:1},{...prop,id:102,vendor:'draftkings'},{...prop,id:103,line_value:null},{...prop,id:104,line_value:' '},{...prop,id:105,line_value:false},{...prop,id:106,line_value:0}])[0];
 assert.equal(p.data.quotes.length,4);assert.deepEqual(p.data.quotes.slice(0,2).map(q=>[q.side,q.american_odds]),[['over',-105],['under',-115]]);assert.equal(p.data.quotes.at(-1).line,0);assert.equal(p.meta.raw_provider_response.data.length,7);assert.equal(p.meta.coverage.rejected_records.length,5);
});
test('Repeated capture keeps quote identity, while changed price/period changes identity',()=>{
 const a=normalize([prop])[0],b=normalize([prop])[0],c=normalize([{...prop,market:{...prop.market,over_odds:105}}])[0];
 assert.equal(a.data.quotes[0].quote_id,b.data.quotes[0].quote_id);assert.notEqual(a.data.quotes[0].quote_id,c.data.quotes[0].quote_id);
});
test('Pagination follows all cursors, caps incomplete results and rejects loops',async()=>{
 const cursors=[],r=await collectCursorPages(async cursor=>{cursors.push(cursor);return cursor===null?{data:[1],meta:{next_cursor:8}}:{data:[2],meta:{next_cursor:null}};},{maxPages:3});
 assert.deepEqual(cursors,[null,8]);assert.deepEqual(r.data,[1,2]);assert.equal(r.complete,true);
 assert.equal((await collectCursorPages(async()=>({data:[1],meta:{next_cursor:5}}),{maxPages:1})).complete,false);
 await assert.rejects(()=>collectCursorPages(async()=>({data:[],meta:{next_cursor:5}}),{maxPages:3}),/REPEATED/);
});
test('History bounds exclude today and excessive windows',()=>{
 assert.deepEqual(historyDateRange('2026-10-20','2026-11-17',new Date(received)),{startDate:'2026-10-20',endDate:'2026-11-17'});
 assert.throws(()=>historyDateRange('2026-01-01','2026-11-17',new Date(received)),/RANGE/);assert.throws(()=>historyDateRange('2026-11-01','2026-11-18',new Date(received)),/RANGE/);
});
test('Provider date and Puerto Rico day remain separate; history does not produce live schedule envelopes',()=>{
 const final={...game,date:'2026-11-17',datetime:'2026-11-18T04:00:00Z',status_state:'final',status:'Final',home_q1:0,visitor_q1:null,home_ot1:9};
 const r=normalizeHistoryGamePages({pages:[{data:[final],meta:{next_cursor:null}}],receivedAt:received,requestUrl:'https://api.balldontlie.io/v1/games',runId:'run',startDate:'2026-10-20',endDate:'2026-11-17'});
 assert.equal(r.games[0].provider_date,'2026-11-17');assert.equal(r.games[0].date_local_pr,'2026-11-18');assert.equal(r.games[0].game.home_q1,0);assert.equal(r.games[0].game.visitor_q1,null);assert.equal(r.games[0].game.home_ot1,9);assert.equal(r.meta,undefined);assert.equal(r.source_scope,'NBA_GAME_HISTORY_NOT_SPORTSBOOK_ODDS');
});
test('Final player truth requires exact players and team score reconciliation',()=>{
 const final={...game,status_state:'final',home_team_score:100,visitor_team_score:105};
 const stats=Array.from({length:10},(_,i)=>({game:final,player:{id:i+1},team:{id:i<5?6:15},min:'48',pts:i<5?20:21,reb:1,ast:1,fg3m:1,stl:0,blk:0,turnover:0}));
 assert.equal(finalPlayerStatsComplete(stats,final),true);assert.equal(finalPlayerStatsComplete(stats.slice(1),final),false);
 assert.equal(finalPlayerStatsComplete(stats.map((s,i)=>i===0?{...s,pts:null}:s),final),false);assert.equal(finalPlayerStatsComplete(stats.map((s,i)=>i===0?{...s,pts:19}:s),final),false);
 assert.equal(finalPlayerStatsComplete([...stats,{game:final,player:{id:11},team:{id:6},min:'0:00',pts:null}],final),true);
});
test('NBA weight read preserves stored learned weights and never calls upsert',async()=>{
 let writes=0;const db={from:()=>({upsert:async()=>{writes++;return {};},select:()=>({eq:async()=>({data:[{factor:'homeAwayAdvantage',weight:1.2345}],error:null})})})};
 const source=fs.readFileSync('src/services/model-learning.service.ts','utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(js,{exports,require:name=>name==='@/lib/supabase-admin'?{supabaseAdmin:db}:{},console});
 const result=await exports.getModelWeights('basketball_nba',{initialize:false});assert.equal(writes,0);assert.equal(result.homeAwayAdvantage,1.2345);assert.equal(result.injuryImpact,1.3);
 const engine=fs.readFileSync('src/services/nba-prediction-engine.service.ts','utf8');assert.match(engine,/getModelWeights\(NBA_SPORT_KEY, \{initialize: false\}\)/);
});
