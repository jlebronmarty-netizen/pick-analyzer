import test from 'node:test';
import assert from 'node:assert/strict';
import {enrichEvidence,periodRows,originalFor} from '../src/nba-evidence.mjs';
const key='2026-11-15T00:00:00Z',cut='2026-11-16T18:00:00Z',start='2026-11-17T00:00:00Z';
const report={readAt:cut,finals:[{gameId:'1',scheduledAt:key,homeScore:100,awayScore:94}],players:[{playerId:'45',recent:[]},{playerId:'46',recent:[]},{playerId:'47',recent:[]}]};
const box={id:'1',at:cut,start:key,home:1,away:2,scores:[100,94],players:[['45','1','25:30',8,5,1,2,0,0,1],['46','1','0',0,0,0,0,0,0,0]],periodAt:cut,periods:{45:{Q1:[2,0,null,0,0,0,0]}}};
test('Archivo temporal, participación real, DNP y ausencia',()=>{
 const a={games:[box],schedule:[]},e=enrichEvidence(report,a);
 assert.equal(e.players[0].recent[0].minutes_played,25.5);
 assert.equal(e.evidence['46']['1'].state,'DNP · 0 min registrados');assert.equal(e.evidence['47'],undefined);
 const [r]=periodRows(e.players[0].recent,e,'45','Q1');assert.equal(r.pts,2);assert.equal(r.reb,0);assert.equal(r.ast,null);assert.equal(r.minutes_played,null);
 assert.equal(periodRows(e.players[0].recent,e,'45','Q4')[0].pts,null);
 assert.equal(enrichEvidence({...report,readAt:key},a).players[0].recent.length,0);
 assert.equal(enrichEvidence(report,{...a,games:[{...box,scores:[99,94]}]}).players[0].recent.length,0);
});
test('Comparación pareada respeta momento, persona, período y línea firmada',()=>{
 const p={gameId:'7',recordedAt:cut,scheduledAt:start,market:'spread',side:'home',line:2};
 const o={gameId:'7',recordedAt:key,decisionAt:key,scheduledAt:start,market:'spread',period:'ft',side:'away',line:-2};
 assert.equal(originalFor(p,[o]),o);
 for(const fields of [{recordedAt:start},{decisionAt:start},{line:2},{period:'q1'},{playerId:'45'}])assert.equal(originalFor(p,[{...o,...fields}]),null);
 assert.equal(originalFor({...p,recordedAt:start},[o]),null);
});

test('Manual y Pick conservan el mismo denominador por contrato y condición',async()=>{
 const {pairedSummary}=await import('../src/nba-evidence.mjs');
 const base={market:'props',period:'Q1',statistic:'points',conditions:{Minutos:true},result:'Acierto',original:{result:'Fallo'}};
 const r=pairedSummary([base,{...base,result:'Fallo',original:{result:'Acierto'}},{...base,result:'Push'},{...base,original:null},{...base,period:'FT',conditions:{Minutos:null}}]);
 assert.deepEqual([r.paired,r.unmatched,r.unresolved],[3,1,1]);
 assert.deepEqual(r.groups.get('props · Q1 · points'),{n:2,manual:1,pick:1});
 assert.deepEqual(r.conditions.get('props · FT · points · Minutos · Sin evidencia'),{n:1,manual:1,pick:0});
});
