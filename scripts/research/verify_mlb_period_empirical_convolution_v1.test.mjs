import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
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

test('preserved artifact verifies source identity, complete probability evidence, settlement and monthly gates',()=>{
  const dir=new URL('../../artifacts/research/',import.meta.url);
  const summary=JSON.parse(fs.readFileSync(new URL('mlb_period_empirical_convolution_v1_result.json',dir),'utf8'));
  const full=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('mlb_period_empirical_convolution_v1_result.json.gz',dir))));
  const prior=JSON.parse(fs.readFileSync(new URL('mlb_period_poisson_v1_result.json',dir),'utf8'));
  assert.equal(summary.full_result_sha256,crypto.createHash('sha256').update(JSON.stringify(full)).digest('hex'));
  assert.equal(full.contract,contract.contract);assert.equal(full.probability_threshold,.75);
  assert.equal(full.external_opened,false);
  for(const key of ['provider_calls_made','odds_api_historical_credits_consumed','official_picks_writes'])assert.equal(full[key],0);
  for(const key of ['apostar_activation','production_promotion','tracker_modified'])assert.equal(full[key],false);
  for(const [period,v] of Object.entries(full.periods)){
    assert.equal(v.input_sha256,prior.periods[period].input_sha256);
    assert.equal(v.source_rows,prior.periods[period].source_rows);
    assert.equal(v.source_rows,v.eligible+v.excluded_insufficient_prior);
    assert.equal(v.eligible,v.predictions.length);
    const {predictions:rows,...expectedSummary}=v;
    assert.deepEqual(summary.periods[period],expectedSummary);
    for(const row of rows){
      for(const values of [row.home_pmf,row.away_pmf]){
        assert.equal(new Set(values.map(([x])=>x)).size,values.length);
        assert(values.every(([x,p])=>Number.isSafeInteger(x)&&x>=0&&Number.isFinite(p)&&p>=0));
        assert(Math.abs(values.reduce((sum,[,p])=>sum+p,0)-1)<1e-10);
      }
      const p=probabilities(new Map(row.home_pmf),new Map(row.away_pmf));
      assert.deepEqual(row.probabilities,p);
      assert(Math.abs(p.HOME+p.AWAY+p.DRAW-1)<1e-10);
      const ml=p.HOME+p.AWAY>0?p.HOME/(p.HOME+p.AWAY):null;
      assert.equal(row.ml_home_conditional,ml);
      assert.equal(row.ml_side,ml===null?null:ml>=.75?'HOME':ml<=.25?'AWAY':null);
      const best=Object.entries(p).sort((a,b)=>b[1]-a[1])[0];
      assert.equal(row.threeway_side,best[1]>=.75?best[0]:null);
    }
    for(const [market,key] of [['ML','ml_side'],['3WAY','threeway_side']]){
      const saved=v.markets[market],selected=rows.filter(r=>r[key]!==null);
      const decided=selected.filter(r=>market!=='ML'||r.truth!=='DRAW');
      const wins=decided.filter(r=>r[key]===r.truth).length,monthly={};
      for(const r of decided){const month=r.game_date.slice(0,7);monthly[month]??={n:0,wins:0};monthly[month].n++;monthly[month].wins+=Number(r[key]===r.truth);}
      for(const m of Object.values(monthly))m.accuracy=m.wins/m.n;
      const accuracy=decided.length?wins/decided.length:null;
      const worst=decided.length?Math.min(...Object.values(monthly).map(m=>m.accuracy)):null;
      assert.equal(saved.selected,selected.length);assert.equal(saved.nonpush,decided.length);
      assert.equal(saved.wins,wins);assert.equal(saved.losses,decided.length-wins);
      assert.equal(saved.pushes,selected.length-decided.length);assert.equal(saved.accuracy,accuracy);
      assert.equal(saved.coverage,rows.length?selected.length/rows.length:null);
      assert.deepEqual(saved.monthly,monthly);assert.equal(saved.worst_month_accuracy,worst);
      const g=contract.gates,pass=accuracy!==null&&accuracy>=g.accuracy&&decided.length>=g.min_n&&Object.keys(monthly).length>=g.min_months&&worst>=g.worst_month_accuracy;
      assert.equal(saved.development_gate_pass,pass);
      assert.equal(saved.state,pass?'DEVELOPMENT_GATE_PASS_EXTERNAL_NOT_OPENED':'DEVELOPMENT_GATE_FAILED_NO_EXTERNAL');
    }
  }
});
