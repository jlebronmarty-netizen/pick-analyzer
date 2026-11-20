import test from 'node:test';
import assert from 'node:assert/strict';
import {ttOddEvenTemporalAudit} from '../src/lib/edge-lab/tt-odd-even-temporal-audit.mjs';
const make=(id,selection,outcome,date='2026-11-10T12:00:00Z')=>({
 sport:'TT',market:'SETS_ODD_EVEN',status:'FORECAST',event_id:id,
 selection,scheduled_at:date,emitted_at:'2026-11-09T11:00:00Z',outcome:{status:outcome}
});
test('dated retrospective split on identical valid pregame events',()=>{
 const x=ttOddEvenTemporalAudit([
  make('a','ODD','W'),
  make('b','EVEN','W','2026-11-13T11:00:00Z'),
  make('c','EVEN','L','2026-11-13T11:00:00Z')
 ]);
 assert.equal(x.all.games,3);assert.equal(x.all.modelHits,2);
 assert.equal(x.all.alwaysOddHits,2);assert.equal(x.early.games,1);assert.equal(x.later.games,2);
 assert.equal(x.status,'DESCRIPTIVE_RETROSPECTIVE_NO_BETTING_EDGE');
});
test('exclude late, pending and duplicate; quarantine contradictory results',()=>{
 const rows=[make('a','ODD','W'),make('a','ODD','W'),
  make('b','ODD','W'),make('b','EVEN','W'),make('b','ODD','L'),
  {...make('c','ODD','W'),emitted_at:'2026-11-10T13:00:00Z'},
  make('d','ODD','PENDING')];
 const x=ttOddEvenTemporalAudit(rows);
 assert.equal(x.all.games,1);assert.equal(x.duplicates,1);
 assert.equal(x.conflicts,2);assert.equal(x.ignored,2);
});
test('empty data never fabricate performance',()=>{
 const x=ttOddEvenTemporalAudit([]);
 assert.equal(x.all.modelAccuracy,null);assert.equal(x.later.alwaysOddAccuracy,null);
});
