import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Regression for a post-capture ReferenceError that previously hid behind
// MULTISPORT_OPERATION_FAILED after already writing successful TT data.
const path='src/services/edge-lab-multi.service.mjs';
const code=fs.readFileSync(path,'utf8');
const start=code.indexOf('async function collectTt');
const end=code.indexOf('async function getMlb',start);
const tt=code.slice(start,end);
test('TT collector uses persisted summary.skipped outside prematch try block',()=>{
 assert.ok(start>=0&&end>start);
 assert.ok(tt.includes('summary.skipped=forecasts.skipped'));
 assert.ok(tt.includes("if(summary.skipped?.length)summary.warnings.push('SOME_EVENTS_NOT_VERIFIABLE')"));
 assert.ok(!tt.includes("if(forecasts.skipped.length)summary.warnings.push('SOME_EVENTS_NOT_VERIFIABLE')"));
});
test('TT correction does not touch provider quotas or other sports collectors',()=>{
 assert.ok(tt.includes("const recentPages=plan.backlog_events>10?0:plan.target?1:2"));
 assert.ok(tt.includes("return summary.warnings.length?'PARTIAL':'SUCCESS'"));
 assert.ok(code.includes("if(sport==='MLB' && process.env.MLB_OFFSEASON_PAUSED==='true')"));
});
