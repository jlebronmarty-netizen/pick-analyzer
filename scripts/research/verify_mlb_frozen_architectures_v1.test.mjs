import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {evaluate as nrfi} from './evaluate_mlb_f1_nrfi_factorized_v1.mjs';
import {evaluate as period} from './evaluate_mlb_period_poisson_v1.mjs';

// Synthetic data exercises chronology only; never reported as model evidence.
const fixtures=Array.from({length:680},(_,i)=>{
  const date=new Date(Date.UTC(2025,2,1+Math.floor(i/4))).toISOString().slice(0,10);
  const cutoff=new Date(new Date(date).valueOf()-86400000).toISOString().slice(0,10);
  return [2025,100000+i,date,i%3===0?1:0,i%5===0?2:0,100+i%4,200+i%4,'T'+i%4,'U'+i%4,cutoff,'STATCAST_RETROSHEET_EXACT_F1',true,'HISTORICAL_SEEN_DEVELOPMENT'];
});
const asPeriod=rows=>rows.map(r=>[r[0],r[1],r[2],r[3],r[4],r[7],r[8],r[9],r[10],r[11],r[12]]);
const probabilityOnly=p=>p.map(({truth,truth_nrfi,correct,...x})=>x);

test('same-day outcomes cannot affect any same-day or earlier probability',()=>{
  for(const [evaluate,source] of [[nrfi,fixtures],[period,asPeriod(fixtures)]]){
    const base=evaluate(source); assert(base.predictions.length>100);
    const day=source[520][2],changed=structuredClone(source);
    for(const r of changed)if(r[2]===day){r[3]=9;r[4]=8;}
    const actual=evaluate(changed);
    assert.deepEqual(probabilityOnly(base.predictions.filter(r=>r.game_date<=day)),probabilityOnly(actual.predictions.filter(r=>r.game_date<=day)));
    assert.notDeepEqual(probabilityOnly(base.predictions.filter(r=>r.game_date>day)),probabilityOnly(actual.predictions.filter(r=>r.game_date>day)));
    assert.deepEqual(evaluate([...source].reverse()),base);
  }
});
test('fail closed on duplicate identities, missing cutoff and prospective rows',()=>{
  for(const [evaluate,source,cutoffIndex] of [[nrfi,fixtures,9],[period,asPeriod(fixtures),7]]){
    assert.throws(()=>evaluate([...source,source[0]]),/DUPLICATE/);
    const missing=structuredClone(source); missing[0][cutoffIndex]=null;assert.throws(()=>evaluate(missing),/CUTOFF/);
    const future=structuredClone(source);future[0][0]=2026;future[0][2]='2026-09-20';assert.throws(()=>evaluate(future),/DATE/);
    const sameDay=structuredClone(source);sameDay[0][cutoffIndex]=sameDay[0][2];assert.throws(()=>evaluate(sameDay),/CUTOFF/);
  }
});
test('new-season history never inherits previous-season outcomes',()=>{
  for(const [evaluate,source] of [[nrfi,fixtures],[period,asPeriod(fixtures)]]){
    const next=structuredClone(source[0]);next[0]=2026;next[1]=999999;next[2]='2026-03-25';next[evaluate===nrfi?9:7]='2026-03-24';
    assert.equal(evaluate([...source,next]).predictions.some(r=>r.game_pk===999999),false);
  }
});
test('preserved research artifacts reproduce counts, confidence, coverage and gates',()=>{
  for(const name of ['mlb_f1_nrfi_factorized_v1_result','mlb_period_poisson_v1_result']){
    const summary=JSON.parse(fs.readFileSync(`artifacts/research/${name}.json`,'utf8'));
    const full=JSON.parse(zlib.gunzipSync(fs.readFileSync(`artifacts/research/${name}.json.gz`)));
    assert.equal(summary.full_result_sha256,crypto.createHash('sha256').update(JSON.stringify(full)).digest('hex'));
    assert.equal(full.probability_threshold,.75);assert.equal(full.external_opened,false);
    for(const field of ['provider_calls_made','odds_api_historical_credits_consumed','official_picks_writes'])assert.equal(full[field],0);
    for(const field of ['apostar_activation','production_promotion','tracker_modified'])assert.equal(full[field],false);
    if(full.periods){
      for(const [p,v] of Object.entries(full.periods)){
        assert.equal(v.source_rows,v.eligible+v.excluded_insufficient_prior);assert.equal(v.eligible,v.predictions.length);
        for(const r of v.predictions){const q=r.probabilities;assert(Math.abs(q.HOME+q.AWAY+q.DRAW-1)<2e-10);assert.equal(r.ml_home_conditional,q.HOME/(q.HOME+q.AWAY));assert.equal(r.ml_side,r.ml_home_conditional>=.75?'HOME':r.ml_home_conditional<=.25?'AWAY':null);const best=Object.entries(q).sort((a,b)=>b[1]-a[1])[0];assert.equal(r.threeway_side,best[1]>=.75?best[0]:null);}
        for(const [market,key] of [['ML','ml_side'],['3WAY','threeway_side']]){
          const m=v.markets[market],sel=v.predictions.filter(r=>r[key]!==null),dec=sel.filter(r=>market!=='ML'||r.truth!=='DRAW');
          assert.equal(m.selected,sel.length);assert.equal(m.pushes,sel.length-dec.length);assert.equal(m.wins,dec.filter(r=>r[key]===r.truth).length);assert.equal(m.losses,dec.length-m.wins);assert.equal(m.accuracy,dec.length?m.wins/dec.length:null);assert.equal(m.coverage,sel.length/v.eligible);assert.equal(m.development_gate_pass,false);
          assert.deepEqual(summary.periods[p].markets[market],m);
        }
      }
    }else{
      assert.equal(full.source_rows,full.eligible+full.excluded_insufficient_prior);
      for(const r of full.predictions)assert.equal(r.side,r.p_nrfi>=.75?'NRFI':r.p_nrfi<=.25?'YRFI':null);
      assert.equal(full.predictions.filter(r=>r.side!==null).length,full.selected);assert.equal(full.selected,0);assert.equal(full.accuracy,null);
    }
  }
});
