import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v2ReviewAccess} from '../src/lib/nba/decision-v2-review-access.mjs';
import {ledgerReview} from '../scripts/research/nba-v2/daily/review.mjs';
const archive=JSON.parse(readFileSync('docs/research/nba-v2/operations/prospective-report.json','utf8'));
const env={VERCEL_ENV:'production',VERCEL_URL:'pick-analyzer-tested.vercel.app',NBA_DECISION_BOARD_ENABLED:'true'};
const headers=values=>new Headers(values);

test('production V2 review requires the protected deployment and authenticated request, with live source only',()=>{
  const authenticated=headers({host:env.VERCEL_URL,'x-vercel-oidc-token':'test-authenticated-request'});
  assert.deepEqual(v2ReviewAccess(env,authenticated),{source:'ledger'});
  assert.equal(v2ReviewAccess(env,headers({host:env.VERCEL_URL})),null);
  assert.equal(v2ReviewAccess({...env,NBA_DECISION_BOARD_ENABLED:'false'},authenticated),null);
  assert.equal(v2ReviewAccess({...env,VERCEL_URL:'unexpected.invalid'},authenticated),null);
  assert.equal(v2ReviewAccess({...env,VERCEL_ENV:'development'},authenticated),null);
  assert.deepEqual(v2ReviewAccess(env,headers({host:'pick-analyzer.vercel.app'})),{redirect:'https://'+env.VERCEL_URL+'/nba-decision-v2'});
  assert.deepEqual(v2ReviewAccess({...env,NBA_DECISION_V2_PREVIEW_LEDGER:'off'},authenticated),{source:'ledger'});
  assert.deepEqual(v2ReviewAccess({VERCEL_ENV:'preview'},headers({})),{source:'archive'});
  assert.deepEqual(v2ReviewAccess({VERCEL_ENV:'preview',NBA_DECISION_V2_PREVIEW_LEDGER:'read'},headers({})),{source:'ledger'});
});

test('live review preserves the committed metrics and rejects a different model or incomplete report',()=>{
  const report={modelHash:archive.modelHash,scopes:archive.report,recentContracts:archive.contracts,asOf:archive.asOf};
  const snapshot={report,newForecasts:[],exclusions:{INCOMPLETE_HISTORY:912},capturedAt:archive.asOf};
  const before=JSON.stringify(snapshot);
  const view=ledgerReview(snapshot,archive);
  assert.equal(view.source,'ledger');assert.equal(view.approvedForBetting,false);
  assert.deepEqual(view.report,archive.report);
  assert.equal(view.report.at(-1).settledIndependentGames,3);
  assert.equal(view.report.at(-1).metrics.contracts,15);
  assert.deepEqual(view.exclusions,{INCOMPLETE_HISTORY:912});
  assert.equal(JSON.stringify(snapshot),before);
  assert.equal(ledgerReview({report:null},archive),null);
  assert.throws(()=>ledgerReview({...snapshot,report:{...report,modelHash:'wrong'}},archive),/REPORT_UNVERIFIED/);
  assert.throws(()=>ledgerReview({...snapshot,report:{...report,scopes:[]}},archive),/REPORT_UNVERIFIED/);
  assert.throws(()=>ledgerReview({...snapshot,newForecasts:null},archive),/REPORT_UNVERIFIED/);
});
