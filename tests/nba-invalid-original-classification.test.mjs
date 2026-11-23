import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedArchivedPlayerFinal} from '../src/lib/nba/decision-archived-final-core.mjs';
import {indexEvidence,playerWindow,readableWindow} from '../src/lib/nba/decision-integrity.mjs';
import {buildNbaDecisionBoard} from '../src/lib/nba/decision-board-core.mjs';
import {planNbaShadowFreeze} from '../src/lib/nba/decision-learning-core.mjs';
import {inputs,id,target,q,after} from './fixtures/nba-shead-inputs.mjs';

test('observed MIA-CLE receipt has a real 12-point gap and remains rejected',()=>{
  const f=JSON.parse(readFileSync(new URL('./fixtures/nba-miami-cle-incomplete-20261113.json',import.meta.url)));
  const data=f.rows.map(row=>({...row,game:f.game}));
  const sums=Object.fromEntries([6,16].map(team=>[team,data.filter(row=>row.team.id===team).reduce((sum,row)=>sum+(row.pts??0),0)]));
  assert.deepEqual(sums,{6:109,16:133});
  assert.equal(f.game.visitor_team_score,121);
  assert.equal(f.game.home_team_score,133);
  assert.equal(verifiedArchivedPlayerFinal({context:{provider_game_id:f.provider_game_id,
    player_stats_captured_at:f.captured_at,player_stats:{data}},final:f.game,
    providerGameId:f.provider_game_id,allowPartialComponents:true}),null);
});

function completeSyntheticInputs(){
  // Corroborating receipts are synthetic integration fixtures, not operator terms or historical results.
  const x=inputs();
  x.goatPropQuotes=[{...q,period:'FULL_GAME_INCLUDING_OT',payload:{...q.payload,
    period:'FULL_GAME_INCLUDING_OT',overtime_rule:'INCLUDES_OVERTIME'}}];
  x.pregame={captured_at:after,game_ids:[target.id],coverage:{injuriesComplete:true,projectedLineupsComplete:true},
    injuries:{data:[]},projected_lineups:{data:[{game_id:target.id,team_id:28,status:'confirmed',
      updated_at:after,lineup:[{player:{id}}]}]}};
  for(const {game,capturedAt} of x.calendar.games){
    const history=x.playerHistory.find(row=>row.provider_game_id===game.id);
    game.home_team_score=100;game.visitor_team_score=95;
    const seconds=Math.round(history.minutes_played*60);
    const min=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    const data=[game.home_team.id,game.visitor_team.id].flatMap((team,side)=>Array.from({length:5},(_,i)=>{
      const player=team===28&&i===0?id:team*100+i;
      return {player:{id:player,team_id:team},team:{id:team},game,min:player===id?min:'30:00',
        pts:side===0?20:19,reb:2,ast:player===id?history.ast:3,fg3m:1};
    }));
    x.contexts.push({provider_game_id:game.id,player_stats_captured_at:capturedAt,player_stats:{data}});
  }
  return x;
}

test('an unverified whole box reports PARTIAL and still blocks projection, ranking and freeze',()=>{
  const x=completeSyntheticInputs();
  assert.equal(buildNbaDecisionBoard(x).rows.props[0].dataQuality.status,'VALIDATED');
  const context=x.contexts[0];
  context.player_stats.data.find(row=>row.team.id!==28).pts-=12;
  const audit=playerWindow(indexEvidence(x),target,id,['ast']);
  assert.equal(audit.status,'PARTIAL');
  assert.ok(audit.issues.some(item=>item.reason==='ORIGINAL_BOX_NOT_VERIFIED'));
  assert.equal(audit.issues.some(item=>item.status==='IDENTITY_MISMATCH'),false);
  assert.equal(readableWindow(audit),false);
  const board=buildNbaDecisionBoard(x),row=board.rows.props[0];
  assert.deepEqual([row.l5,row.l10,row.projection,row.classification],[null,null,null,'PASAR']);
  assert.deepEqual(board.top25,[]);
  assert.deepEqual(planNbaShadowFreeze(board,after).rows,[]);
});

test('a verified box placing the player on the other team still reports IDENTITY_MISMATCH',()=>{
  const x=completeSyntheticInputs(),context=x.contexts[0],rows=context.player_stats.data;
  const player=rows.find(row=>row.player.id===id),opponent=rows.find(row=>row.team.id!==28);
  [player.player.id,opponent.player.id]=[opponent.player.id,player.player.id];
  const audit=playerWindow(indexEvidence(x),target,id,['ast']);
  assert.equal(audit.status,'IDENTITY_MISMATCH');
  assert.ok(audit.issues.some(item=>item.reason==='ORIGINAL_BOX_OR_IDENTITY_DISAGREES'));
  const board=buildNbaDecisionBoard(x);
  assert.equal(board.rows.props[0].projection,null);
  assert.equal(board.rows.props[0].classification,'PASAR');
  assert.deepEqual(planNbaShadowFreeze(board,after).rows,[]);
});
