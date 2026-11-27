import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePeriods} from '../src/lib/nba/sheet-lab/periods.mjs';
const g={period:5,home_team_score:2,visitor_team_score:0,home_ot1:2,visitor_ot1:0};
for(let i=1;i<5;i++)g['home_q'+i]=g['visitor_q'+i]=0;
const p={player:{id:8},min:'1:23',pts:2,reb:0,ast:null,fg3m:0,stl:0,blk:0,turnover:0};
const events=Array.from({length:4},(_,i)=>({order:i,period:i+1,type:'End Period',home_score:0,away_score:0}));
events.push({order:5,period:5,type:'Shot',participants:[8],scoring_play:true,score_value:2},{order:6,period:5,type:'End Period',clock:'0:00',home_score:2,away_score:0});
test('OT belongs to second half; unknown assist and absent regulation participation stay missing',()=>{
 const r=reconcilePeriods(g,[p],events)[8];assert.deepEqual(r.OT,[2,0,null,0,0,0,0]);assert.deepEqual(r['2H'],r.OT);assert.equal(r.Q1,undefined);
});
test('truncation, duplicate order, wrong intermediate and final scores block every segment',()=>{
 for(const v of [events.slice(0,-1),[...events,events[0]],events.map((e,i)=>i===1?{...e,home_score:1}:e),events.map((e,i)=>i===5?{...e,away_score:3}:e)])assert.deepEqual(reconcilePeriods(g,[p],v),{});
});
