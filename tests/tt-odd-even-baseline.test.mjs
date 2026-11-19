import test from 'node:test';
import assert from 'node:assert/strict';
import {ttOddEvenBaseline} from '../src/lib/edge-lab/tt-odd-even-baseline.mjs';

const row=(event,selection,outcome)=>({
 sport:'TT',market:'SETS_ODD_EVEN',status:'FORECAST',event_id:event,selection,
 outcome:{status:outcome}
});
test('always ODD baseline evaluated on identical settled events',()=>{
 const input=[row('a','ODD','W'),row('b','EVEN','L'),row('c','EVEN','W'),row('d','ODD','L')];
 const r=ttOddEvenBaseline(input);
 assert.equal(r.games,4);assert.equal(r.modelWins,2);
 assert.equal(r.alwaysOddWins,2);assert.equal(r.oddSelected,2);assert.equal(r.evenSelected,2);
});
test('exclude unmatched, pending, abstain and duplicate results',()=>{
 const input=[row('a','ODD','W'),row('a','ODD','W'),row('b','ODD','PENDING'),
 {...row('c','ODD','W'),status:'ABSTAIN'}, {...row('d','ODD','W'),market:'MONEYLINE'}];
 const r=ttOddEvenBaseline(input);
 assert.equal(r.games,1);assert.equal(r.alwaysOddWins,1);
});
test('empty cohort does not imply winning probability',()=>{
 const r=ttOddEvenBaseline([]);
 assert.equal(r.modelAccuracy,null);assert.equal(r.alwaysOddAccuracy,null);
 assert.equal(r.classification,'DESCRIPTIVE_NO_BETTING_EDGE');
});
