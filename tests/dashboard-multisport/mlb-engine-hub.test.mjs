import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarizeQualifiedPlays, readQualifiedSnapshot } from '../../src/lib/qualified-plays.ts';
import { filterEngineHub, engineTotals } from '../../src/lib/mlb-engine-hub.ts';
import MlbEngineHub from '../../src/components/dashboard/MlbEngineHub.tsx';
const at='2026-10-14T12:00:00Z';
const row=(id,extra={})=>({id,season:2026,season_phase:'REGULAR_SEASON',engine:'PICK_ANALYZER',model_id:'test_model',contract_id:null,market:'batter_doubles',line:'0.5',direction:'UNDER',evidence_class:'REGULAR_SEASON_FORWARD_APPROVED_PROP_EXACT_LINE',result:'WIN',freeze_timestamp:'2026-09-13T16:00:00Z',scheduled_at:'2026-09-13T20:00:00Z',settled_at:at,updated_at:at,source_relation:'test_source',source_row_id:id,research_only:true,production_eligible:false,official_picks_eligible:false,apostar_enabled:false,target_date:'2026-09-13',game_pk:123,selection:'Test player',projection:0.1,actual_value:'0',actual_label:null,...extra});
const report=()=>summarizeQualifiedPlays([row('a'),row('b',{result:'LOSS'}),row('c',{engine:'PICK_EDGE',model_id:'PE_ML_V1'}),row('d',{engine:'EQUILIZER',model_id:'E2'}),row('e',{result:null,settled_at:null,target_date:'2026-10-14'}),row('f',{season_phase:'POSTSEASON',evidence_class:'POSTSEASON_SHADOW_DOMAIN_SHIFT',target_date:'2026-10-14'})],at,at,true);
const base={view:'GENERAL',phase:'REGULAR_SEASON',formula:'ALL',date:'',outcome:'ALL'};
test('sanitized details are opt-in and omit private metadata, raw sources, odds and probability',()=>{
  const r=row('a',{metadata:{private:'never send'},model_probability:0.9,odds:-1000});
  assert.equal(summarizeQualifiedPlays([r],at,at).entries,undefined);
  const detail=summarizeQualifiedPlays([r],at,at,true).entries[0];
  assert.equal(detail.actual,'0');assert.equal(detail.selection,'Test player');
  for(const key of ['metadata','source_relation','source_row_id','model_probability','odds'])assert.equal(detail[key],undefined);
});
test('invalid detail and partial snapshots fail closed instead of displaying plausible history',async()=>{
  for(const bad of [{target_date:'2026-02-30'},{selection:null},{game_pk:0},{projection:Infinity},{actual_value:'NaN'}])assert.throws(()=>summarizeQualifiedPlays([row('a',bad)],at,at,true));
  const r=await readQualifiedSnapshot(async()=>({count:1,updatedAt:at}),async()=>[row('a',{target_date:'bad'})],true);
  assert.equal(r.status,'UNAVAILABLE');assert.equal(r.entries,undefined);
});
test('engine, exact formula, phase, date and outcome filters intersect; formulas do not duplicate rows',()=>{
  const r=report(); assert.equal(filterEngineHub(r,base).entries.length,5);
  assert.equal(filterEngineHub(r,{...base,view:'FORMULAS'}).entries.length,5);
  assert.equal(filterEngineHub(r,{...base,view:'PICK_EDGE'}).entries.length,1);
  assert.equal(filterEngineHub(r,{...base,phase:'POSTSEASON'}).entries.length,1);
  assert.equal(filterEngineHub(r,{...base,date:'2026-10-14',outcome:'OPEN'}).entries.length,1);
  assert.equal(filterEngineHub(r,{...base,date:'2026-10-14',outcome:'WIN'}).entries.length,0);
  const g=r.groups.find(g=>g.engine==='EQUILIZER');
  assert.equal(filterEngineHub(r,{...base,formula:g.key}).entries.length,1);
});
test('engine weighted accuracy excludes open, push and void and never averages formula percentages',()=>{
  const r=summarizeQualifiedPlays([row('a'),row('b',{result:'LOSS'}),row('c',{model_id:'another'}),row('d',{result:null}),row('e',{result:'VOID'}),row('f',{result:'PUSH'})],at,at);
  const t=engineTotals(r.groups);assert.equal(t.accuracy,2/3);assert.equal(t.open,1);assert.equal(t.voids,1);assert.equal(t.pushes,1);
  assert.equal(engineTotals([]).accuracy,null);
});
test('OPEN history cannot expose a postgame actual or settlement timestamp',()=>{
 const r=summarizeQualifiedPlays([row('a',{result:null,actual_value:'99',actual_label:'later outcome',settled_at:at})],at,at,true);
 assert.equal(r.entries[0].actual,null);assert.equal(r.entries[0].settledAt,null);
});
test('render includes independent official/research metrics, phase controls, formulas and settlement history',()=>{
 const html=renderToStaticMarkup(React.createElement(MlbEngineHub,{research:report(),official:{available:true,wins:19,losses:23,pending:0,accuracy:19/42},today:'2026-10-14'}));
 for(const text of ['MLB general','Equilizer','Edge','Fórmulas','45.24%','Predicciones y resultados','Accuracy por fórmula','No es probabilidad','no representa partidos independientes','modelo'])assert.ok(html.toLowerCase().includes(text.toLowerCase()),text);
 assert.ok(html.includes('WIN'));assert.ok(html.includes('LOSS'));assert.ok(html.includes('OPEN'));
});
