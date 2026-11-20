import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleNbaPreferredRows} from '../src/lib/nba/decision-visible-core.mjs';

const preference={evidenceScope:'DESCRIPTIVE_SHADOW_NOT_PROBABILITY',numericGap:2.5,sortIndex:310,favorableCount:3};
const make=(id,changes={})=>({
 id,dataQuality:{status:'VALIDATED',issues:[]},gameId:'game1',market:'spread',period:'q2',selection:id,line:.5,
 classification:'VIGILAR',preference:{...preference},...changes
});
test('all six board tabs accept only validated favorable SHADOW preferences, not PASAR or raw rows',()=>{
 const tabs=['top','ml','spread','total','props','periods'];
 for(const tab of tabs){
  const valid=make(tab+'-valid',{market:tab==='props'?'props':tab==='ml'?'moneyline':tab==='total'?'total':'spread'});
  const result=visibleNbaPreferredRows([valid,make(tab+'-pass',{classification:'PASAR',line:1.5}),
   make(tab+'-raw',{preference:undefined,line:2.5}),
   make(tab+'-negative',{preference:{...preference,numericGap:-1},line:3.5})]);
  assert.deepEqual(result.map(r=>r.id),[valid.id],tab);
 }
});
test('Cuartos/Mitades removes opposing spreads from same period and preserves different periods',()=>{
 const good=make('minnesota',{line:.5,preference:{...preference,sortIndex:330}});
 const other=make('knicks',{line:-.5,preference:{...preference,sortIndex:310}});
 const q3=make('q3',{period:'q3',line:-.5});
 const input=[other,good,q3];const unchanged=structuredClone(input);
 const output=visibleNbaPreferredRows(input);
 assert.deepEqual(output.map(r=>r.id),['minnesota','q3']);
 assert.deepEqual(input,unchanged);
});
test('Moneyline, totals and player props suppress duplicate sides per contract without dropping distinct games or stats',()=>{
 const input=[
  make('ml-home',{market:'moneyline',line:null}),
  make('ml-away',{market:'moneyline',line:null,preference:{...preference,sortIndex:320}}),
  make('total-over',{market:'total',line:112.5}),
  make('total-under',{market:'total',line:112.5,preference:{...preference,sortIndex:320}}),
  make('p-over',{market:'props',playerId:14,statistic:'rebounds',line:8.5}),
  make('p-under',{market:'props',playerId:14,statistic:'rebounds',line:9.5}),
  make('p-points',{market:'props',playerId:14,statistic:'points',line:19.5}),
  make('other-game',{market:'moneyline',gameId:'game2',line:null})
 ];
 assert.deepEqual(visibleNbaPreferredRows(input).map(r=>r.id),
 ['ml-away','total-under','p-over','p-points','other-game']);
});
