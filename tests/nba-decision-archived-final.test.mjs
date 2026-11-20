import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedArchivedPlayerFinal} from '../src/lib/nba/decision-archived-final-core.mjs';
import {settleNbaShadowForecast} from '../src/lib/nba/decision-learning-core.mjs';
const tip='2026-11-20T01:00:00Z',capture='2026-11-20T04:30:00Z';
const game={id:42,date:'2026-11-19',datetime:tip,status_state:'final',
  home_team_id:5,visitor_team_id:7,home_team_score:50,visitor_team_score:60,
  home_q1:12,home_q2:12,home_q3:13,home_q4:13,
  visitor_q1:15,visitor_q2:15,visitor_q3:15,visitor_q4:15};
function rows(){
  const result=[];
  for(let i=0;i<12;i++){
   const home=i<6,player=i+100,team=home?5:7,minute=i===0?'0':'24:24';
   const pts=i===0?0:home?10:10;
   result.push({player:{id:player,team_id:team},team:{id:team},game:{...game},
     min:minute,pts,reb:4,ast:2,fg3m:1});
  }
  return result;
}
const ctx=(data=rows(),at=capture)=>({provider_game_id:42,player_stats_captured_at:at,player_stats:{data}});
test('verifies exact game/team/score reconciled data and excludes DNP',()=>{
 const r=verifiedArchivedPlayerFinal({context:ctx(),final:game,providerGameId:42});
 assert.equal(r.playerCount,12);assert.equal(r.rows.size,11);
 assert.equal(r.rows.has(100),false);assert.equal(r.rows.get(101).pts,10);
 const f={forecast_id:'a',game_id:42,game_start_at:tip,game_date_local:game.date,
  market:'props',period:'ft',side:'over',statistic:'points_rebounds_assists',
  player_id:101,line:14.5,projection:17};
 const out=settleNbaShadowForecast(f,{game,sourceReceivedAt:capture,
   playerStat:r.rows.get(101),playerStatReceivedAt:r.capturedAt});
 assert.equal(out.statistical_result,'win');assert.equal(out.actual,16);
 assert.equal(settleNbaShadowForecast({...f,player_id:100},{game,sourceReceivedAt:capture,
   playerStat:r.rows.get(100),playerStatReceivedAt:r.capturedAt}),null);
});
test('rejects future/pregame capture, mismatched game and unknown player identity',()=>{
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(rows(),tip),final:game,providerGameId:42}),null);
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(),final:game,providerGameId:43}),null);
 const conflict=rows();conflict[0].game={...game,home_team_score:49};
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(conflict),final:game,providerGameId:42}),null);
 const duplicate=rows();duplicate[1].player.id=100;
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(duplicate),final:game,providerGameId:42}),null);
 const badTeam=rows();badTeam[1].team.id=99;
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(badTeam),final:game,providerGameId:42}),null);
});
test('rejects missing stats, incomplete totals, DNP disguised as playing and conflicting source',()=>{
 const incomplete=rows();incomplete[1].ast=null;
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(incomplete),final:game,providerGameId:42}),null);
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(rows()),final:{...game,home_team_score:51},providerGameId:42}),null);
 const invalidMinute=rows();invalidMinute[1].min='DNP';
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(invalidMinute),final:game,providerGameId:42}),null);
 const wrongPlayerTeam=rows();wrongPlayerTeam[2].player.team_id=7;
 assert.equal(verifiedArchivedPlayerFinal({context:ctx(wrongPlayerTeam),final:game,providerGameId:42}),null);
});
test('zero-network, read-only staged fallback retains core idempotent settlement',()=>{
 const service=readFileSync('src/services/nba-decision-learning.service.ts','utf8');
 assert.match(service,/verifiedArchivedPlayerFinal/);
 assert.match(service,/\.from\('nba_game_context_v2'\)/);
 assert.match(service,/\.limit\(16\)/);
 assert.match(service,/compact\?\?/);
 assert.match(service,/onConflict:id,ignoreDuplicates:true/);
 assert.match(service,/settleNbaShadowForecast/);
 assert.doesNotMatch(service,/fetch\(/);
});
