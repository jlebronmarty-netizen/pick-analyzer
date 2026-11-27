import test from 'node:test';
import assert from 'node:assert/strict';
import {inBand,rankThresholds,teamWindow} from '../src/app/nhl-cheat-sheets/windows.mjs';
const history=Array.from({length:10},(_,id)=>({id,score:3,against:2,opp:'B'}));
const home={history,abbrev:'A'};
const away={history:history.map(g=>({...g,opp:'A',score:2,against:3})),abbrev:'B'};
const fixtures=[{id:'fixture',fixture:{teams:{home,away}}}];
const quote={id:'fixture',market:'total',side:'over',price:-251,line:5};
test('American price boundaries remain disjoint',()=>{
  for(const p of [-651,-650,-251,-250,-110,125])assert.equal(inBand(p,'all'),inBand(p,'standard')||inBand(p,'heavy'));
  assert.deepEqual([-651,-650,-251,-250,-110,125].map(p=>inBand(p,'heavy')),[false,true,true,false,false,false]);
});
test('missing games block a window and H2H restricts opponents',()=>{
  assert.equal(teamWindow({history:[null,...history]},'5','B').length,0);
  assert.equal(teamWindow(home,'h2h','C').length,0);
  assert.equal(teamWindow(home,'5','B').length,5);
});
test('totals count each unique final and keep exact thresholds in denominator',()=>{
  const [r]=rankThresholds(fixtures,[quote],'total','heavy','10');
  assert.deepEqual([r.n,r.hits,r.ties],[10,0,10]);
  assert.equal(rankThresholds(fixtures,[quote],'total','standard','10').length,0);
  assert.equal(rankThresholds(fixtures,[{...quote,side:'under',line:5.5}],'total','heavy','5')[0].hits,5);
});
