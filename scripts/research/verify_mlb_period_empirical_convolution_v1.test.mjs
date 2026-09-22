import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,histogram,smoothedPmf,probabilities,contract} from './evaluate_mlb_period_empirical_convolution_v1.mjs';

// Synthetic chronology/count fixtures only; no real development source is read.
const fixtures=Array.from({length:600},(_,i)=>{
  const date=new Date(Date.UTC(2025,2,1+Math.floor(i/4))).toISOString().slice(0,10);
  const cutoff=new Date(new Date(date).valueOf()-86400000).toISOString().slice(0,10);
  return [2025,100000+i,date,i%7,i%3,'H'+i%4,'A'+i%4,cutoff,'STATCAST_EXACT_F5',true,'HISTORICAL_SEEN_DEVELOPMENT'];
});
const onlyPrediction=({truth,...r})=>r;

test('nonparametric convolution preserves zero mass and exact unbounded integer support',()=>{
  const league=histogram([0,0,1000,1000]);
  const p=smoothedPmf([0,1000],league,4);
  assert.deepEqual([...p],[[0,.5],[1000,.5]]);
  assert.deepEqual(probabilities(p,p),{HOME:.25,AWAY:.25,DRAW:.5});
  assert.deepEqual(probabilities(new Map([[0,1]]),new Map([[0,1]])),{HOME:0,AWAY:0,DRAW:1});
  assert.throws(()=>histogram([1.2]),/INVALID_RUN/);
});
test('same-day and future outcomes cannot affect any earlier probability; source order is irrelevant',()=>{
  const base=evaluate(fixtures,5),day=fixtures[400][2],changed=structuredClone(fixtures);
  assert(base.eligible>100);
  for(const r of changed)if(r[2]===day){r[3]=50;r[4]=40;}
  const actual=evaluate(changed,5);
  assert.deepEqual(base.predictions.filter(r=>r.game_date<=day).map(onlyPrediction),actual.predictions.filter(r=>r.game_date<=day).map(onlyPrediction));
  assert.notDeepEqual(base.predictions.filter(r=>r.game_date>day).map(onlyPrediction),actual.predictions.filter(r=>r.game_date>day).map(onlyPrediction));
  assert.deepEqual(evaluate([...fixtures].reverse(),5),base);
  assert(base.predictions.every(r=>r.home_history_games===30&&r.away_history_games===30));
});
test('source integrity fails closed and histories reset at season boundary',()=>{
  assert.throws(()=>evaluate([...fixtures,fixtures[0]],5),/DUPLICATE/);
  assert.throws(()=>evaluate(fixtures,3),/PERIOD_LINEAGE/);
  for(const [idx,value,pattern] of [[7,null,/CUTOFF/],[7,fixtures[0][2],/CUTOFF/],[9,false,/LINEAGE/],[3,-1,/IDENTITY_OR_TARGET/]]){
    const bad=structuredClone(fixtures);bad[0][idx]=value;assert.throws(()=>evaluate(bad,5),pattern);
  }
  const future=structuredClone(fixtures);future[0][0]=2026;future[0][2]='2026-09-20';assert.throws(()=>evaluate(future,5),/DATE/);
  const next=structuredClone(fixtures[0]);next[0]=2026;next[1]=999999;next[2]='2026-03-25';next[7]='2026-03-24';
  assert(!evaluate([...fixtures,next],5).predictions.some(r=>r.game_pk===999999));
});
test('all-zero scores abstain in conditional ML, settle 3-way draws, and report frozen gates',()=>{
  const zero=fixtures.map(r=>{const x=[...r];x[3]=0;x[4]=0;return x;});
  const result=evaluate(zero,5);
  assert(result.predictions.every(r=>r.ml_home_conditional===null&&r.ml_side===null&&r.threeway_side==='DRAW'));
  assert.equal(result.markets.ML.selected,0);assert.equal(result.markets.ML.accuracy,null);
  assert.equal(result.markets['3WAY'].wins,result.eligible);assert.equal(result.markets['3WAY'].accuracy,1);
  for(const m of Object.values(result.markets)){
    assert.equal(m.selected,m.wins+m.losses+m.pushes);
    const g=contract.gates;
    assert.equal(m.development_gate_pass,m.accuracy!==null&&m.accuracy>=g.accuracy&&m.nonpush>=g.min_n&&Object.keys(m.monthly).length>=g.min_months&&m.worst_month_accuracy>=g.worst_month_accuracy);
  }
  assert.equal(contract.probability_threshold,.75);
});
