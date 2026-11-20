import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {buildNbaDecisionBoard,buildPlayerProjection} from '../src/lib/nba/decision-board-core.mjs';
import {planNbaShadowFreeze} from '../src/lib/nba/decision-learning-core.mjs';
import {archivedCalendar} from '../src/lib/nba/decision-calendar.mjs';
import {indexEvidence,playerWindow,marketQuality} from '../src/lib/nba/decision-integrity.mjs';
import {hasValidatedInputs} from '../src/lib/data-quality/window.mjs';

import {inputs,id,target,q,before,after} from './fixtures/nba-shead-inputs.mjs';
const board=(asOf)=>buildNbaDecisionBoard(inputs(asOf));
const windowOf=x=>playerWindow(indexEvidence(x),target,id,['ast']);
test('Shead, Nov 20: three archived games were materialized after 19:03 PR; immutable replay and updated board',()=>{
  const missing=inputs(before);
  const oldInputs=missing.playerHistory.filter(r=>Date.parse(r.materialized_at)<=Date.parse(before));
  const old=buildPlayerProjection(q,oldInputs,Date.parse(target.datetime),Date.parse(before));
  assert.deepEqual([old.l5,old.l10,old.projection],[8.8,7.1,8.21]);
  const historicalFreeze=Object.freeze(JSON.parse(readFileSync(new URL('./fixtures/nba-shead-frozen-20261120.json',import.meta.url))));
  assert.deepEqual([Number(historicalFreeze.l5),Number(historicalFreeze.l10),Number(historicalFreeze.projection)],[old.l5,old.l10,old.projection]);
  const snapshot=structuredClone(historicalFreeze);
  for(const subset of [oldInputs,oldInputs.slice(0,5),missing.playerHistory]){
    const previous=buildNbaDecisionBoard({...missing,playerHistory:subset});
    const row=previous.rows.props[0], history=previous.historyEvidence[row.historyKey].player;
    assert.equal(row.dataQuality.status,'INCOMPLETE_HISTORY');
    assert.deepEqual(history.issues.filter(v=>v.reason==='PLAYER_ROW_MISSING_AT_CUTOFF').slice(0,3).map(v=>v.id),[21718136,21718126,21718114]);
    assert.deepEqual([row.l5,row.l10,row.projection,row.classification],[null,null,null,'PASAR']);
    assert.deepEqual(previous.top25,[]);assert.deepEqual(planNbaShadowFreeze(previous,before).rows,[]);
  }
  const corrected=board(after),row=corrected.rows.props[0],hist=corrected.historyEvidence[row.historyKey].player;
  assert.deepEqual([row.l5,row.l10,row.projection,row.line,row.odds],[5.4,7.2,6.03,4.5,-158]);
  assert.equal(hist.included.length,10);assert.equal(hist.lastGame.id,21718136);
  assert.ok(row.dataQuality.issues.some(i=>i.reason==='OVERTIME_RULE_UNVERIFIED'));
  assert.ok(!row.dataQuality.issues.some(i=>i.reason==='QUOTE_RECEIPT_MISMATCH'));
  assert.equal(corrected.top25.length,0);assert.equal(row.classification,'PASAR');
  assert.deepEqual(historicalFreeze,snapshot);
  assert.deepEqual(board(before).rows.props[0].projection,null);
});
test('duplicates, null vs zero, transfer, bad digest, late receipt, wrong season, missing calendar, corrected stat',()=>{
  for(const [change,expected] of [
    [x=>x.playerHistory.push({...x.playerHistory[0]}),'DUPLICATE_DATA'],
    [x=>{x.playerHistory[0].ast=null},'PARTIAL'],
    [x=>{x.playerHistory[0].team_id=14},'IDENTITY_MISMATCH'],
    [x=>{x.manifests[0].response_sha256='x'},'PARTIAL'],
    [x=>{x.playerHistory[0].source_captured_at='2026-11-21T06:00Z'},'INCOMPLETE_HISTORY'],
    [x=>{x.playerHistory[0].season=2025},'INCOMPLETE_HISTORY'],
    [x=>{x.calendar.issues=['MISSING_CALENDAR']},'SOURCE_UNAVAILABLE'],
  ]){
    const x=inputs();change(x);const r=buildNbaDecisionBoard(x).rows.props[0];
    assert.equal(r.dataQuality.status,expected);assert.equal(r.projection,null);assert.equal(r.classification,'PASAR');
  }
  const x=inputs(),e=indexEvidence(x);
  // Adapter scenarios use explicit in-memory original rows; the date/ID/AST fixture above is observed data.
  for(const r of x.playerHistory){
    const seconds=Math.round(r.minutes_played*60);
    e.boxes.set(r.provider_game_id,new Map([[id,[{team:{id:28},ast:r.ast,min:Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}]]]));
  }
  assert.equal(playerWindow(e,target,id,['ast']).status,'VALIDATED');
  e.boxes.get(21718136).get(id)[0].ast=0;
  assert.ok(playerWindow(e,target,id,['ast']).issues.some(i=>i.reason==='ORIGINAL_BOX_DISAGREES'));
  x.playerHistory[0].ast=0;
  assert.equal(playerWindow(e,target,id,['ast']).status,'VALIDATED');
  e.boxes.get(21718136).get(id)[0].min='0';x.playerHistory[0].minutes_played=0;
  assert.equal(playerWindow(e,target,id,['ast']).excluded[0].reason,'DNP');
  e.boxes.get(21718136).get(id)[0].min='9:59';x.playerHistory[0].minutes_played=9.983;
  assert.equal(playerWindow(e,target,id,['ast']).excluded[0].reason,'UNDER_TEN_MINUTES');
  x.calendar.games[0].game.postponed=true;
  assert.equal(playerWindow(e,target,id,['ast']).excluded[0].reason,'POSTPONED_OR_CANCELLED');
});
test('quote recapture cannot freshen an old operator price; unverified OT and insufficient sample block ranking',()=>{
  const x=inputs(),e=indexEvidence(x),window=windowOf(x);
  const result=marketQuality({...q,provider_updated_at:'2026-11-19T12:00Z'},target,e,[window]);
  assert.ok(result.issues.some(i=>i.status==='STALE'));assert.ok(result.issues.some(i=>i.status==='CONTRACT_UNVERIFIED'));
  x.calendar.games=x.calendar.games.slice(0,4);x.playerHistory=x.playerHistory.slice(0,4);
  assert.equal(buildNbaDecisionBoard(x).rows.props[0].projection,null);
  assert.equal(hasValidatedInputs({eligible:true}),false);
});
test('PR calendar day may differ from both UTC date and provider date; an absent calendar receipt blocks the window',()=>{
  const day='2026-11-20',at='2026-11-21T03:30:00Z',game={...target,date:'2026-11-19',datetime:'2026-11-20T04:15:00Z'};
  const s={date_local:day,source_received_at:at,payload:{meta:{date_local:day,source_received_at:at,
    snapshot_id:'a'.repeat(64),status:'SCHEDULE_RETRIEVED',provider:'BALLDONTLIE',id_namespace:'balldontlie',
    sportsbook:'FanDuel',contract_version:'NBA_MARKET_DATA_V1'},data:{games:[game]}}};
  const cap={provider_date_range:{startDate:day,endDate:day},complete:true,received_at:at,raw_provider_responses:[{data:[]}]};
  assert.deepEqual(archivedCalendar(cap,[s],at).issues,[]);
  assert.ok(archivedCalendar(cap,[],at).issues.length);
  assert.equal(buildNbaDecisionBoard({...inputs(),scheduleGames:[game],asOf:at}).summary.games,1);
});
