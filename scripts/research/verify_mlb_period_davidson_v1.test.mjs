import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from './evaluate_mlb_period_davidson_v1.mjs';
import {parseCsv} from './audit_mlb_public_snapshot_v1.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const rows=Array.from({length:680},(_,i)=>{const date=new Date(Date.UTC(2025,2,1+Math.floor(i/4))).toISOString().slice(0,10);return [2025,100000+i,date,i%3===0?1:0,i%5===0?2:0,'T'+i%4,'U'+i%4,new Date(Date.parse(date)-86400000).toISOString().slice(0,10),'STATCAST_RETROSHEET_EXACT_F1',true,'HISTORICAL_SEEN_DEVELOPMENT'];});
const probs=ps=>ps.map(({truth,...p})=>p);
test('daily batching prevents current-day/future outcomes changing earlier forecasts',()=>{
  const base=evaluate(rows,1),mut=structuredClone(rows),date=rows[520][2];
  for(const r of mut)if(r[2]===date){r[3]=9;r[4]=8;}
  const changed=evaluate(mut,1);
  assert.deepEqual(probs(base.predictions.filter(r=>r.game_date<=date)),probs(changed.predictions.filter(r=>r.game_date<=date)));
  assert.notDeepEqual(probs(base.predictions.filter(r=>r.game_date>date)),probs(changed.predictions.filter(r=>r.game_date>date)));
  assert.deepEqual(evaluate([...rows].reverse(),1),base);
});
test('duplicate, cutoff, period and external fail closed; seasons reset',()=>{
  assert.throws(()=>evaluate([...rows,rows[0]],1),/DUPLICATE/);
  assert.throws(()=>evaluate(rows,3),/LINEAGE/);
  const bad=structuredClone(rows);bad[0][7]=bad[0][2];assert.throws(()=>evaluate(bad,1),/CUTOFF/);
  bad[0][0]=2026;bad[0][2]='2026-09-20';assert.throws(()=>evaluate(bad,1),/DATE/);
  const next=[...rows[0]];next[0]=2026;next[1]=999999;next[2]='2026-03-25';next[7]='2026-03-24';
  assert.equal(evaluate([...rows,next],1).predictions.some(r=>r.game_pk===999999),false);
});
test('CSV commas, quoted newlines and escaped quotes remain in the correct fields',()=>{
  assert.deepEqual(parseCsv('a,b\r\n"x,y","line1\nline2"\r\n"a""b",z\r\n'),[{a:'x,y',b:'line1\nline2'},{a:'a"b',b:'z'}]);
  assert.throws(()=>parseCsv('a,b\nx,y,z\n'),/WIDTH/);
});
test('preserved outcome ratings reproduce probabilities, settlements and unchanged gates',()=>{
  const summary=JSON.parse(fs.readFileSync('artifacts/research/mlb_period_davidson_v1_result.json'));
  const full=JSON.parse(zlib.gunzipSync(fs.readFileSync('artifacts/research/mlb_period_davidson_v1_result.json.gz')));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(full)).digest('hex'),summary.full_result_sha256);
  assert.equal(full.external_opened,false);assert.equal(full.odds_api_historical_credits_consumed,0);
  for(const [period,v] of Object.entries(full.periods)){
    assert.equal(v.source_rows,v.eligible+v.excluded_insufficient_prior);
    for(const r of v.predictions){
      const a=10**((r.rating_home-r.rating_away)/400),t=2*r.prior_draw_rate/(1-r.prior_draw_rate)*Math.sqrt(a),den=a+1+t;
      assert(Math.abs(r.probabilities.HOME-a/den)<1e-12);assert(Math.abs(r.probabilities.AWAY-1/den)<1e-12);assert(Math.abs(r.probabilities.DRAW-t/den)<1e-12);
      assert.equal(r.ml_side,r.ml_home_conditional>=.75?'HOME':r.ml_home_conditional<=.25?'AWAY':null);
      const best=Object.entries(r.probabilities).sort((a,b)=>b[1]-a[1])[0];assert.equal(r.threeway_side,best[1]>=.75?best[0]:null);
    }
    for(const [market,key] of [['ML','ml_side'],['3WAY','threeway_side']]){
      const m=v.markets[market],sel=v.predictions.filter(r=>r[key]!==null),dec=sel.filter(r=>market!=='ML'||r.truth!=='DRAW');
      assert.equal(m.selected,sel.length);assert.equal(m.pushes,sel.length-dec.length);assert.equal(m.wins,dec.filter(r=>r[key]===r.truth).length);assert.equal(m.losses,dec.length-m.wins);
      assert.equal(m.accuracy,dec.length?m.wins/dec.length:null);assert.equal(m.coverage,sel.length/v.eligible);
      const months={};for(const r of dec){const k=r.game_date.slice(0,7);months[k]??=[];months[k].push(r[key]===r.truth);}
      const worst=dec.length?Math.min(...Object.values(months).map(rs=>rs.filter(Boolean).length/rs.length)):null;
      assert.equal(m.worst_month_accuracy,worst);assert.equal(m.development_gate_pass,m.accuracy!==null&&m.accuracy>=.75&&dec.length>=60&&Object.keys(months).length>=5&&worst>=.65);
      assert.deepEqual(summary.periods[period].markets[market],m);
    }
  }
  // High overall accuracy must not bypass a failed month.
  assert(full.periods[7].markets.ML.accuracy>.75);assert.equal(full.periods[7].markets.ML.development_gate_pass,false);
});
