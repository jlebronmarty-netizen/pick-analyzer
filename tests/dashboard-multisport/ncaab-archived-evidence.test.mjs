import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildNcaabArchivedEvidence,parseArchivedAmericanOdds,ncaabArchiveDates} from '../../src/lib/ncaab-archived-evidence.ts';
import {readNcaabArchivedEvidence} from '../../src/services/ncaab-archived-evidence.service.ts';
import NcaabArchivedEvidence from '../../src/components/dashboard/NcaabArchivedEvidence.tsx';
import NcaabDashboard from '../../src/components/dashboard/NcaabDashboard.tsx';
import {getNcaabCheckpoint} from '../../src/services/ncaab-checkpoint-read.service.ts';
import {archiveForecast,archiveReceipt,archiveAsOf,archiveDate} from '../fixtures/ncaab-archived-evidence.mjs';
const parse=(receipts=[archiveReceipt()],forecasts=[archiveForecast()],asOf=archiveAsOf)=>buildNcaabArchivedEvidence({forecasts,receipts,asOf,dates:[archiveDate]});
const event=r=>r.events['espn:1234'];
const competition=r=>r.body.events[0].competitions[0];
test('archived pairs retain true book, both prices, neutral venue and knowledge time without eligibility',()=>{
  const inputReceipt=archiveReceipt(),inputForecast=archiveForecast();
  const frozen=JSON.stringify([inputReceipt,inputForecast]);
  const result=parse([inputReceipt],[inputForecast]),e=event(result);
  assert.equal(result.quotedEvents,1);assert.equal(e.quotes.length,3);
  assert.equal(e.neutralSite,true);assert.equal(e.knownAtOriginalEmission,true);
  const ml=e.quotes.find(q=>q.market==='MONEYLINE');
  assert.equal(ml.sportsbook,'DraftKings');assert.equal(ml.first.americanOdds,-140);assert.equal(ml.second.americanOdds,120);
  assert.equal(e.operatorTimestamp,null);assert.equal(e.currentExecutable,false);
  assert.equal(e.expectedValue,null);assert.equal(e.validatedProbability,null);assert.equal(e.eligible,false);
  assert.equal(e.contractVerified,false);assert.equal(result.providerCalls,0);assert.equal(result.databaseWrites,0);
  assert.equal(JSON.stringify([inputReceipt,inputForecast]),frozen);
});
test('receipt captured after prediction is explicitly not emission-time price evidence',()=>{
  const r=archiveReceipt();r.captured_at='2026-11-21T19:00:00Z';
  assert.equal(event(parse([r])).knownAtOriginalEmission,false);
  assert.ok(event(parse([r])).reasons.includes('PRICE_CAPTURED_AFTER_FORECAST'));
});
test('latest menu removal cannot revive an older price or missing event',()=>{
  const old=archiveReceipt(),latest=archiveReceipt();latest.id='latest';latest.captured_at='2026-11-21T19:00:00Z';
  competition(latest).odds=[];
  assert.equal(event(parse([old,latest])).quotes.length,0);
  latest.body.events=[];
  assert.deepEqual(event(parse([latest,old])).reasons,['EVENT_ABSENT_FROM_LATEST_RECEIPT']);
});
test('invalid or oversized latest receipt cannot fall back to a valid earlier receipt',()=>{
  const old=archiveReceipt(),latest={...archiveReceipt(),id:'latest',captured_at:'2026-11-21T19:00:00Z',body:null};
  assert.equal(event(parse([old,latest])).status,'BLOCKED');
  assert.equal(parse([old,latest]).status,'PARTIAL');
  latest.body={events:Array(1000).fill({})};
  assert.ok(event(parse([old,latest])).reasons.includes('INVALID_OR_TRUNCATED_RECEIPT'));
});
test('different latest receipts at the same time are quarantined irrespective of input order',()=>{
  const a=archiveReceipt(),b={...archiveReceipt(),id:'different'};
  for(const inputs of [[a,b],[b,a]])assert.deepEqual(event(parse(inputs)).reasons,['CONFLICTING_LATEST_RECEIPTS']);
});
test('same receipt identity with conflicting payload cannot select a price by row order',()=>{
  const a=archiveReceipt(),b=archiveReceipt();competition(b).odds[0].moneyline.home.close.odds='-200';
  for(const inputs of [[a,b],[b,a]]){
    assert.deepEqual(event(parse(inputs)).reasons,['CONFLICTING_LATEST_RECEIPTS']);
    assert.equal(event(parse(inputs)).quotes.length,0);
  }
  assert.equal(event(parse([a,structuredClone(a)])).quotes.length,3);
});
test('ambiguous or invalid receipt times block older references and invalid cutoffs are rejected',()=>{
  for(const value of ['2026-11-21T19:00:00','2026-02-30T19:00:00Z','bad-time']){
    const bad={...archiveReceipt(),id:'invalid-newer',captured_at:value};
    for(const inputs of [[archiveReceipt(),bad],[bad,archiveReceipt()]]){
      assert.deepEqual(event(parse(inputs)).reasons,['INVALID_RECEIPT_ORDER']);
      assert.equal(event(parse(inputs)).quotes.length,0);
    }
    assert.throws(()=>ncaabArchiveDates(value));
  }
  const forecast={...archiveForecast(),created_at:'2026-11-21T18:00:00'};
  assert.equal(event(parse([archiveReceipt()],[forecast])).status,'BLOCKED');
});
test('future receipts are unavailable as of the requested cutoff',()=>{
  const r=archiveReceipt();r.captured_at='2026-11-21T21:00:00Z';
  assert.equal(parse([r]).status,'UNAVAILABLE');assert.equal(event(parse([r])).quotes.length,0);
});
test('team swaps, competition ambiguity and schedule changes fail closed',()=>{
  for(const mutate of [c=>c.competitors.reverse().forEach(t=>t.homeAway=t.homeAway==='home'?'away':'home'),
    c=>c.competitors[0].team.id='77',c=>c.date='2026-11-22T01:30:00Z',c=>c.timeValid=false,c=>c.id='777']){
    const r=archiveReceipt();mutate(competition(r));assert.equal(event(parse([r])).status,'BLOCKED');
    assert.equal(event(parse([r])).quotes.length,0);
  }
  const r=archiveReceipt();r.body.events[0].competitions.push(structuredClone(competition(r)));
  assert.deepEqual(event(parse([r])).reasons,['AMBIGUOUS_EVENT']);
});
test('live/final or post-start latest receipt does not advertise its stale pregame menu',()=>{
  for(const mutate of [r=>competition(r).status.type={state:'in',name:'STATUS_IN_PROGRESS',completed:false},
    r=>r.captured_at='2026-11-22T00:31:00Z']){
    const r=archiveReceipt();mutate(r);
    assert.deepEqual(event(parse([r],[archiveForecast()],'2026-11-22T01:00:00Z')).reasons,['NOT_A_PREGAME_RECEIPT']);
  }
});
test('conflicting event-level schedule or state cannot be hidden by the competition fields',()=>{
  const rescheduled=archiveReceipt();rescheduled.body.events[0].date='2026-11-22T01:30:00Z';
  assert.deepEqual(event(parse([rescheduled])).reasons,['UNVERIFIED_OR_CHANGED_SCHEDULE']);
  const live=archiveReceipt();live.body.events[0].status={type:{state:'in',name:'STATUS_IN_PROGRESS',completed:false}};
  assert.deepEqual(event(parse([live])).reasons,['NOT_A_PREGAME_RECEIPT']);
});
test('null, booleans, zero, decimals, Infinity and malformed American prices never become odds',()=>{
  for(const value of [null,undefined,true,false,'',0,'0',99,-99,'-110.5',Infinity,NaN,' -110','1e3'])assert.equal(parseArchivedAmericanOdds(value),null);
  assert.equal(parseArchivedAmericanOdds('+100'),100);assert.equal(parseArchivedAmericanOdds(-100),-100);
  const r=archiveReceipt();competition(r).odds[0].moneyline.away.close.odds=null;
  assert.ok(!event(parse([r])).quotes.some(q=>q.market==='MONEYLINE'));
});
test('conflicting duplicates block that book and market; identical duplicates deduplicate',()=>{
  const r=archiveReceipt(),q=competition(r).odds[0];competition(r).odds.push(structuredClone(q));
  assert.equal(event(parse([r])).quotes.length,3);
  competition(r).odds[1].moneyline.home.close.odds='-155';
  assert.equal(event(parse([r])).quotes.length,2);
  assert.ok(event(parse([r])).reasons.includes('CONFLICTING_QUOTE_PAIRS'));
  competition(r).odds[1].homeTeamOdds.team.id='77';
  assert.equal(event(parse([r])).quotes.length,0);
});
test('spread sides must sum to zero and total sides must use the same positive line',()=>{
  const r=archiveReceipt(),q=competition(r).odds[0];q.pointSpread.away.close.line='+4.5';q.total.under.close.line='u148.5';
  assert.deepEqual(event(parse([r])).quotes.map(q=>q.market),['MONEYLINE']);
});
test('duplicate forecasts and review-required identity cannot create historical price claims',()=>{
  const f=archiveForecast();assert.equal(event(parse([archiveReceipt()],[f,f])).status,'BLOCKED');
  assert.equal(event(parse([archiveReceipt()],[{...f,review_required:true}])).status,'BLOCKED');
  for(const event_id of ['__proto__','constructor','prototype']){
    const result=parse([archiveReceipt()],[{...f,event_id}]);
    assert.deepEqual(Object.keys(result.events),[]);
    assert.equal(Object.getPrototypeOf(result.events),Object.prototype);
  }
});
test('PR date window is explicit, missing neutral venue remains unknown and history is not broadly declared absent',()=>{
  assert.deepEqual(ncaabArchiveDates('2026-11-22T02:00:00Z'),['2026-11-20','2026-11-21','2026-11-22']);
  assert.throws(()=>ncaabArchiveDates('bad-time'));
  const r=archiveReceipt();delete competition(r).neutralSite;
  assert.equal(event(parse([r])).neutralSite,null);
  assert.equal(parse([r]).matchedEvents,1);
  const f={...archiveForecast(),scheduled_at:'2026-11-19T22:00:00Z'};
  assert.equal(Object.keys(parse([r],[f]).events).length,0);
});
test('bounded archive reader performs SELECT only, continues after one failure, and never fetches a provider',async()=>{
  const actions=[],client={from(table){assert.equal(table,'ncaab_daily_source_v1');let url;const q={
    select(v){actions.push(['select',v]);return q},eq(k,v){assert.equal(k,'source_url');url=v;return q},
    lte(k,v){assert.equal(k,'captured_at');assert.equal(v,archiveAsOf);return q},order(){return q},
    limit(n){assert.equal(n,2);return q},abortSignal(signal){assert.equal(signal instanceof AbortSignal,true);return q},
    then(resolve,reject){return Promise.resolve(url.includes('20261120')?{data:null,error:{message:'synthetic failure'}}:
      {data:url.includes('20261121')?[archiveReceipt()]:[],error:null}).then(resolve,reject)},
  };return q}};
  const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('PROVIDER_CALL_FORBIDDEN')};
  try{const r=await readNcaabArchivedEvidence([archiveForecast()],archiveAsOf,client);
    assert.equal(actions.length,3);assert.equal(r.status,'PARTIAL');assert.equal(r.quotedEvents,1);
    assert.ok(r.sourceErrors.some(x=>x.startsWith('ARCHIVE_READ_FAILED')));
  }finally{globalThis.fetch=oldFetch;}
});
test('presentation explains receipt time, actual sportsbook, neutral site and absent validation',()=>{
  const r=archiveReceipt();r.captured_at='2026-11-21T19:00:00Z';
  const html=renderToStaticMarkup(React.createElement(NcaabArchivedEvidence,{evidence:event(parse([r]))}));
  for(const text of ['DraftKings','neutral','después del pronóstico','Hora propia del operador: sin verificar','reglas de prórroga sin confirmar','Sin EV ni recomendación'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('FanDuel'));assert.ok(!html.includes('JUGADA'));
});
test('existing NCAAB dashboard integrates references without altering forecasts or claiming daily injury inputs',()=>{
  const report=structuredClone(getNcaabCheckpoint());assert.equal(report.status,'AVAILABLE');
  report.data.observations=[archiveForecast()];report.data.archivedEvidence=parse();
  // Regression for the real /ncaab RSC boundary: JSON could serialize a
  // null-prototype map, but Next rejects it when passing props to this client.
  assert.equal(Object.getPrototypeOf(report.data.archivedEvidence.events),Object.prototype);
  assert.deepEqual(JSON.parse(JSON.stringify(report)),report,'Dashboard props must remain plain transport DTOs');
  const before=JSON.stringify(report.data.observations);
  const html=renderToStaticMarkup(React.createElement(NcaabDashboard,{report}));
  for(const text of ['Cuotas y contexto archivados','DraftKings','no incorpora lesiones, quintetos ni forma reciente']){
    assert.ok(html.includes(text),text);
  }
  assert.equal(JSON.stringify(report.data.observations),before);
});
