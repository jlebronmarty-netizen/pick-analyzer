import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cycleSlot,runDaily,holdoutFrom} from '../scripts/research/nba-v2/daily/runner.mjs';
import {pairFromBoard} from '../scripts/research/nba-v2/daily/benchmarks.mjs';
import {evaluateForward} from '../scripts/research/nba-v2/forward-metrics.mjs';
import {scoreForward} from '../scripts/research/nba-v2/forward-score.mjs';
import {makeBoard,model,at} from './fixtures/nba-v2-cycle.mjs';
const read=p=>JSON.parse(readFileSync('docs/research/nba-v2/'+p+'.json'));
const batch=read('forward-20261120'),out=read('outcomes-20261120');
test('existing PR slots, bounded retries, no cold start without a slot',()=>{
 assert.equal(cycleSlot('freeze',at),'2026-11-22T15:35:00.000Z');
 assert.equal(cycleSlot('freeze','2026-11-22T23:55:59Z'),'2026-11-22T23:35:00.000Z');
 assert.equal(cycleSlot('settle','2026-11-22T12:15:01Z'),'2026-11-22T12:15:00.000Z');
 assert.throws(()=>cycleSlot('freeze','2026-11-22T23:56:00Z'));
});
test('dry-run evaluates stored board, logs each exclusion and pairs matching sides only',async()=>{
 const board=makeBoard(),r=await runDaily({kind:'freeze',model,board,clock:()=>at});
 assert.equal(r.write,false);assert.equal(r.batch.records.length,1);
 assert.equal(r.batch.diagnostics.considered,r.batch.records.length+r.batch.diagnostics.discarded.length);
 const f=r.batch.records[0];assert.ok(f.benchmark.probability>0);
 for(const patch of [{line:55},{quoteId:f.quoteId},{capturedAt:at},{dataQuality:{status:'STALE'}},{playerId:1}]){
  const b=makeBoard();Object.assign(b.rows.periods[1],patch);assert.equal(pairFromBoard(f,b),null);
 }
 const dup=makeBoard();dup.rows.periods.push({...dup.rows.periods[1]});assert.equal(pairFromBoard(f,dup),null);
});
test('all 15 original lines grade against four quarter sums including the half, independent of the predicted probability',()=>{
 const e=read('operations/evidence-20261120');assert.equal(out.pending.length,0);
 assert.equal(new Set(out.outcomes.map(x=>x.forecastId)).size,15);
 for(const f of batch.rows){
  const g=e.games[f.gameId],p=g.periods,idx=Number(f.period[1])-1;
  const actual=f.period==='h1'?p.home[0]+p.home[1]+p.away[0]+p.away[1]:p.home[idx]+p.away[idx];
  const y=out.outcomes.find(r=>r.forecastId===f.forecastId);
  assert.equal(y.actual,actual);assert.equal(y.result,actual>f.line?'win':'loss');
  assert.ok(g.finalSnapshots>=2 && g.distinctScoreVersions===1);
 }
 const combined=read('operations/prospective-report').report.at(-1);
 assert.equal(combined.settledIndependentGames,3);assert.equal(combined.metrics.wins,6);assert.equal(combined.metrics.losses,9);
 assert.equal(combined.metrics.pairedBinaryGames,3);assert.equal(combined.metrics.bootstrapReplicates,27);
 assert.ok(Math.abs(combined.metrics.accuracy-11/15)<1e-12);
 assert.equal(combined.pending,25);
 assert.ok(Math.abs(combined.metrics.archivedDecimalRoi+0.24133333333333332)<1e-10);
 assert.equal(combined.metrics.positiveEvGames,3);
 assert.ok(combined.metrics.positiveEvRoi<0 && combined.metrics.positiveEvRoi95[1]>0);
});
test('a subsequent missing final suspends an outcome; concordant receipts restore it; changed scores remain disputed',()=>{
 const y=out.outcomes[0],scope=batch.rows.find(f=>f.forecastId===y.forecastId).scope;
 const evidence={...out,checkedAt:'2026-11-22T12:15:00Z',outcomes:[],pending:[{forecastId:y.forecastId,reason:'AWAITING_RECONCILED_FINAL'}]};
 const query=s=>evaluateForward(model,[batch],s,{holdoutFrom,asOf:'2026-11-24T12:15:00Z'}).find(x=>x.scope===scope);
 assert.equal(query([out,evidence]).metrics.games,2);
 assert.equal(query([evidence,{...out,checkedAt:'2026-11-23T12:15:00Z'},out]).metrics.games,3);
 const changed={...out,checkedAt:'2026-11-23T12:15:00Z',outcomes:[{...y,actual:y.actual+1}]};
 assert.equal(query([out,changed]).disputed,1);
});
test('bootstrap samples whole games, preserves pushes as refunds, suppresses intervals for one game',()=>{
 const win={game:1,y:2,line:1,p:.6,push:0,mu:2,odds:100,book:.52};
 const a=scoreForward([win,{...win,game:2,y:0}]),b=scoreForward([...Array(9).fill(win),{...win,game:2,y:0}]);
 assert.ok(Math.abs(a.brier-b.brier)<1e-12);assert.deepEqual(a.intervals95.simulatedRoi,b.intervals95.simulatedRoi);
 const push=scoreForward([{...win,y:1}]);assert.equal(push.simulatedRoi,0);assert.equal(push.accuracy,null);
 assert.equal(push.intervals95.simulatedRoi,null);assert.equal(scoreForward([]).meanEv,null);
});
import {runOptionalNbaV2} from '../src/services/nba-decision-v2-hook.mjs';
test('turning the optional hook off avoids the database; observe and failures are isolated',async()=>{
 const db=new Proxy({}, {get:()=>{throw Error('UNEXPECTED_DATABASE_CALL');}});
 assert.equal((await runOptionalNbaV2('freeze',db,null,{mode:'off'})).status,'DISABLED');
 assert.equal((await runOptionalNbaV2('freeze',db,makeBoard(),{mode:'observe',clock:()=>at})).eligible,1);
 assert.equal((await runOptionalNbaV2('freeze',db,makeBoard(),{mode:'shadow',clock:()=>at})).status,'V2_FAILED');
});
test('tampering with a benchmark excludes it while preserving the settled statistical result',()=>{
 const benchmarks=structuredClone(read('operations/evidence-20261120').benchmarks);
 const suspect=benchmarks[0];suspect.probability=.99;
 const reports=evaluateForward(model,[batch],[out],{holdoutFrom,asOf:out.checkedAt,benchmarks,includeCombined:true});
 const scope=batch.rows.find(r=>r.forecastId===suspect.forecastId).scope;
 assert.equal(reports.find(r=>r.scope===scope).metrics.pairedBinaryGames,2);
 assert.equal(reports.find(r=>r.scope===scope).settledIndependentGames,3);
});
