import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import NhlDashboard from '../../src/components/dashboard/NhlDashboard.tsx';
import {rankNhlQuoteTargets,mergeNhlQuoteSnapshots,nhlQuoteCoverage} from '../../src/lib/nhl-quotes.ts';
import {readNhlDirectoryCache} from '../../src/lib/nhl-directory-cache.ts';
import {freezeNhlForecast,reconcileFreeNhl,freeNhlMetrics} from '../../src/lib/nhl-free.ts';
const at='2026-11-07T20:00:00Z',tip='2026-11-08T00:00:00.000Z';
const game=(i=1)=>({eventId:'nhl:'+i,eventName:'Away @ Home',scheduledAt:tip,status:'SCHEDULED',away:'Away',home:'Home',awayId:9,homeId:7,awayScore:null,homeScore:null});
const published={awayName:'Away',homeName:'Home',scheduledAt:tip,awayProbability:.4,homeProbability:.6,detailUrl:'https://www.dratings.com/predictor/nhl-hockey-predictions/abcd',rawRow:'fixture'};
const forecast=(i=1,time=at,price=null)=>freezeNhlForecast(game(i),published,time,price);
const prices={awayOdds:120,homeOdds:-135};
test('limited-budget price selection rotates missed and failed targets instead of repeating first games',()=>{
 const candidates=Array.from({length:12},(_,i)=>forecast(i+1));
 const attempts=candidates.slice(0,7).map(f=>({eventId:f.eventId,capturedAt:'2026-11-07T19:37:00Z',status:'NO_PAIR',sourceId:'s'}));
 assert.deepEqual(rankNhlQuoteTargets(candidates,[],attempts,at).slice(0,5).map(f=>f.eventId),['nhl:10','nhl:11','nhl:12','nhl:8','nhl:9']);
 const older=forecast(1,'2026-11-07T18:00:00Z',prices),fresh=forecast(2,'2026-11-07T19:40:00Z',prices);
 assert.equal(rankNhlQuoteTargets([forecast(2),forecast(1)],[fresh,older],[],at)[0].eventId,'nhl:1');
 assert.deepEqual(candidates.map(f=>f.awayOdds),Array(12).fill(null));
});
test('quoted fallback carries the entire simultaneous snapshot without relabeling a later probability',()=>{
 const current={...forecast(),awayProbability:.45,homeProbability:.55},quote=forecast(1,'2026-11-07T19:40:00Z',prices);
 const merged=mergeNhlQuoteSnapshots([current],[quote],[game()],at);assert.equal(merged[0],quote);assert.equal(merged[0].homeProbability,.6);assert.equal(current.homeProbability,.55);assert.equal(current.homeOdds,null);
 for(const q of [{...quote,capturedAt:'2026-11-07T18:00:00Z'},{...quote,capturedAt:'2026-11-07T20:01:00Z'},{...quote,homeId:99},{...quote,scheduledAt:'2026-11-08T00:01:00.000Z'}])assert.equal(mergeNhlQuoteSnapshots([current],[q],[game()],at)[0],current);
 assert.equal(mergeNhlQuoteSnapshots([current],[quote],[{...game(),status:'LIVE'}],at)[0],current);
});
test('pair coverage is distinct from model coverage; stale, started and unpriced records cannot inflate it',()=>{
 const games=[game(),game(2),{...game(3),status:'LIVE'}];
 const r=nhlQuoteCoverage([forecast(1,at,prices),forecast(2),forecast(3,at,prices)],games,at);
 assert.equal(r.paired,1);assert.equal(r.eligible,2);assert.equal(r.missing.length,1);
 assert.equal(nhlQuoteCoverage([forecast(1,'2026-11-07T18:00:00Z',prices)],games,at).paired,0);
});
test('a later price observation never changes original accuracy, ROI, frozen odds or settlement',()=>{
 const original=forecast(),before=JSON.stringify(original),later=forecast(1,'2026-11-07T20:01:00Z',prices),final={eventId:original.eventId,scheduledAt:tip,awayId:9,homeId:7,awayScore:1,homeScore:3,capturedAt:'2026-11-08T04:00:00Z'};
 mergeNhlQuoteSnapshots([original],[later],[game()],'2026-11-07T20:01:00Z');
 const p=reconcileFreeNhl(original,[final]),metrics=freeNhlMetrics([p]);assert.equal(JSON.stringify(original),before);assert.equal(p.settlement.outcome,'WIN');assert.equal(p.settlement.profitUnits,null);assert.equal(metrics.accuracyPct,100);assert.equal(metrics.staked,0);assert.equal(metrics.roiPct,null);
});
test('team directory cache saves requests only for intact successful snapshots less than 24h old',()=>{
 const raw=Buffer.from(JSON.stringify({data:[{id:9,triCode:'OTT',fullName:'Ottawa Senators'}]}));
 const row={id:'source',captured_at:'2026-11-07T19:00:00Z',body:{http_status:200,encoding:'gzip/base64',raw:gzipSync(raw).toString('base64'),sha256:createHash('sha256').update(raw).digest('hex')}};
 assert.equal(readNhlDirectoryCache(row,Date.parse(at)).directory.get(9).name,'Ottawa Senators');
 assert.equal(readNhlDirectoryCache({...row,captured_at:'2026-11-06T19:00:00Z'},Date.parse(at)),null);
 assert.equal(readNhlDirectoryCache({...row,captured_at:'2026-11-07T21:00:00Z'},Date.parse(at)),null);
 assert.throws(()=>readNhlDirectoryCache({...row,body:{...row.body,sha256:'bad'}},Date.parse(at)));
 assert.throws(()=>readNhlDirectoryCache({...row,body:{...row.body,http_status:403}},Date.parse(at)));
});
test('UI distinguishes quote coverage and later prices without changing headline history metrics',()=>{
 const f=forecast(),p=reconcileFreeNhl(f,[]),coverage=nhlQuoteCoverage([forecast(1,at,prices)],[game()],at);
 const report={schema:'NHL_FREE_DIRECT_V1',source:'PICK_ANALYZER',status:'AVAILABLE',readAt:at,date:'2026-11-07',health:{status:'PASS',latestRunAt:at,coverage:1,eligible:1,issues:[],runStatus:'PASS'},summary:freeNhlMetrics([p]),forecasts:[forecast(1,at,prices)],history:[p],quoteCoverage:coverage,laterPriceObservations:[{predictionId:p.id,eventId:p.eventId,odds:-135,capturedAt:at,book:'CIRCA'}],warning:'SHADOW'};
 const html=renderToStaticMarkup(React.createElement(NhlDashboard,{report}));for(const s of ['Cuotas Circa pareadas recientes','1/1','Sin cuota','Cuota posterior observada','No reemplaza la original ni entra en su ROI','favorito puede pagar demasiado poco'])assert.ok(html.includes(s),s);
 assert.equal(report.summary.roiPct,null);
});
test('even a fresh quoted forecast cannot enter edge after official LIVE status or with a future capture clock',async()=>{
 const {nhlOpportunities}=await import('../../src/lib/nhl-view.ts');
 const f=forecast(1,at,prices),r={readAt:at,health:{status:'PASS',latestRunAt:at},forecasts:[f],games:[game()]};assert.ok(nhlOpportunities(r).length>0);
 assert.equal(nhlOpportunities({...r,games:[{...game(),status:'LIVE'}]}).length,0);
 assert.equal(nhlOpportunities({...r,forecasts:[{...f,capturedAt:'2026-11-07T20:01:00Z'}]}).length,0);
});
